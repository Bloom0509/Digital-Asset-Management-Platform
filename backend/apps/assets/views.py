import mimetypes
import uuid
from io import BytesIO
from pathlib import Path

from django.core.files.base import ContentFile
from django.http import FileResponse, HttpResponse
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.tenants.models import Membership, Tenant
from apps.tenants.activity import record_activity
from apps.tenants.permissions import WorkspaceRolePermission

from .models import Asset, compute_file_hash
from .serializers import AssetSerializer, AssetUploadSerializer, BulkAssetMetadataSerializer


class OptionalJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:
            return None


class AssetViewSet(viewsets.ModelViewSet):
    serializer_class = AssetSerializer

    def get_authenticators(self):
        if self.request.method == 'GET':
            if self.request.path.rstrip('/').endswith('/trash'):
                return [SessionAuthentication(), JWTAuthentication()]
            return [OptionalJWTAuthentication()]
        return [SessionAuthentication(), JWTAuthentication()]

    def get_queryset(self):
        if self.request.user.is_authenticated:
            queryset = Asset.objects.filter(tenant=self.request.user.active_tenant)
            if self.action == 'trash':
                return queryset.filter(deleted_at__isnull=False)
            if self.action in ('restore', 'permanent_delete'):
                return queryset.filter(deleted_at__isnull=False)
            if self.action == 'file':
                return queryset
            return queryset.filter(deleted_at__isnull=True)
        return Asset.objects.none()

    def get_permissions(self):
        if self.request.method == 'GET' and self.action == 'list' and not self.request.user.is_authenticated:
            return [AllowAny()]
        return [WorkspaceRolePermission()]

    def perform_update(self, serializer):
        previous_name = serializer.instance.name
        previous_metadata = {
            field: getattr(serializer.instance, field)
            for field in ("tags", "description", "alt_text", "creator", "campaign", "license", "custom_fields")
        }
        asset = serializer.save()
        if asset.name != previous_name:
            record_activity(asset.tenant, self.request.user, f'Renamed asset “{previous_name}” to “{asset.name}”.')
        elif any(getattr(asset, field) != value for field, value in previous_metadata.items()):
            record_activity(asset.tenant, self.request.user, f'Updated metadata for “{asset.name}”.')

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=['deleted_at', 'updated_at'])
        record_activity(instance.tenant, self.request.user, f'Moved “{instance.name}” to trash.')

    @action(detail=False, methods=['get'])
    def trash(self, request):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        asset = self.get_object()
        asset.deleted_at = None
        asset.save(update_fields=['deleted_at', 'updated_at'])
        record_activity(asset.tenant, request.user, f'Restored “{asset.name}” from trash.')
        return Response(self.get_serializer(asset).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path='permanent-delete')
    def permanent_delete(self, request, pk=None):
        asset = self.get_object()
        record_activity(asset.tenant, request.user, f'Permanently deleted “{asset.name}”.')
        if asset.file:
            asset.file.delete(save=False)
        asset.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='duplicate')
    def duplicate(self, request, pk=None):
        asset = self.get_object()
        metadata_payload = request.data.get('metadata', {}) if hasattr(request.data, 'get') else {}
        if metadata_payload is None:
            metadata_payload = {}
        if not isinstance(metadata_payload, dict):
            return Response({'detail': 'Metadata must be an object.'}, status=status.HTTP_400_BAD_REQUEST)

        metadata_serializer = AssetSerializer(data=metadata_payload, partial=True)
        metadata_serializer.is_valid(raise_exception=True)

        asset_fields = {
            'metadata': {**asset.metadata},
            'size_bytes': asset.size_bytes,
            'tags': getattr(asset, 'tags', []),
            'description': getattr(asset, 'description', ''),
            'alt_text': getattr(asset, 'alt_text', ''),
            'creator': getattr(asset, 'creator', ''),
            'campaign': getattr(asset, 'campaign', ''),
            'license': getattr(asset, 'license', ''),
            'custom_fields': getattr(asset, 'custom_fields', {}),
        }
        asset_fields.update(metadata_serializer.validated_data)

        duplicate_asset = Asset(
            tenant=asset.tenant,
            uploaded_by=request.user,
            name=asset.name,
            content_type=asset.content_type,
            size_bytes=asset_fields['size_bytes'],
            file_hash=asset.file_hash,
            metadata=asset_fields['metadata'],
            tags=asset_fields['tags'],
            description=asset_fields['description'],
            alt_text=asset_fields['alt_text'],
            creator=asset_fields['creator'],
            campaign=asset_fields['campaign'],
            license=asset_fields['license'],
            custom_fields=asset_fields['custom_fields'],
        )

        if asset.file:
            original_name = Path(asset.file.name).name
            file_stem = Path(original_name).stem or 'asset'
            file_suffix = Path(original_name).suffix or '.bin'
            duplicate_name = f"{file_stem}-{uuid.uuid4().hex[:8]}{file_suffix}"
            with asset.file.open('rb') as source_file:
                duplicate_asset.file.save(duplicate_name, ContentFile(source_file.read()), save=False)
            duplicate_asset.object_key = duplicate_asset.file.name

        duplicate_asset.save()
        record_activity(
            asset.tenant,
            request.user,
            f'Created a new asset copy from “{asset.name}”.',
        )
        return Response(self.get_serializer(duplicate_asset).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='bulk-metadata')
    def bulk_metadata(self, request):
        bulk_serializer = BulkAssetMetadataSerializer(data=request.data)
        bulk_serializer.is_valid(raise_exception=True)
        asset_ids = bulk_serializer.validated_data['asset_ids']
        metadata = bulk_serializer.validated_data['metadata']
        per_asset_metadata = bulk_serializer.validated_data['per_asset_metadata']
        assets = list(self.get_queryset().filter(pk__in=asset_ids))
        if len(assets) != len(asset_ids):
            return Response(
                {'detail': 'One or more selected assets are unavailable in this workspace.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        with transaction.atomic():
            updated_assets = []
            for asset in assets:
                asset_metadata = {
                    **metadata,
                    **per_asset_metadata.get(str(asset.pk), {}),
                }
                serializer = AssetSerializer(
                    asset,
                    data=asset_metadata,
                    partial=True,
                    context=self.get_serializer_context(),
                )
                serializer.is_valid(raise_exception=True)
                updated_assets.append(serializer.save())
            record_activity(
                request.user.active_tenant,
                request.user,
                f'Updated metadata for {len(updated_assets)} assets.',
            )

        return Response({
            'updated': len(updated_assets),
            'assets': AssetSerializer(updated_assets, many=True, context=self.get_serializer_context()).data,
        })

    @action(
        detail=False,
        methods=['post'],
        url_path='upload',
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload(self, request):
        upload_serializer = AssetUploadSerializer(data=request.data)
        upload_serializer.is_valid(raise_exception=True)
        uploaded_file = upload_serializer.validated_data['file']
        tenant = request.user.active_tenant
        if tenant is None:
            return Response({'detail': 'No active workspace is selected.'}, status=status.HTTP_400_BAD_REQUEST)

        extension = Path(uploaded_file.name).suffix.lower()
        content_type = mimetypes.guess_type(uploaded_file.name)[0] or 'application/octet-stream'
        file_hash = compute_file_hash(uploaded_file)
        duplicate_asset = Asset.objects.filter(tenant=tenant, file_hash=file_hash).exclude(deleted_at__isnull=False).first()
        if duplicate_asset is not None:
            duplicate_message = f'This file already exists in this workspace as “{duplicate_asset.name}”.'
            record_activity(tenant, request.user, duplicate_message, event_type='error')
            return Response({'detail': duplicate_message}, status=status.HTTP_409_CONFLICT)

        asset = Asset(
            tenant=tenant,
            uploaded_by=request.user,
            name=upload_serializer.validated_data['name'],
            object_key=f'pending/{uuid.uuid4().hex}',
            content_type=content_type,
            size_bytes=uploaded_file.size,
            file_hash=file_hash,
            metadata={'original_filename': Path(uploaded_file.name).name, 'type': extension.lstrip('.').upper()},
            tags=upload_serializer.validated_data['tags'],
            description=upload_serializer.validated_data.get('description', ''),
            alt_text=upload_serializer.validated_data.get('alt_text', ''),
            creator=upload_serializer.validated_data.get('creator', ''),
            campaign=upload_serializer.validated_data.get('campaign', ''),
            license=upload_serializer.validated_data.get('license', ''),
            custom_fields=upload_serializer.validated_data['custom_fields'],
            file=uploaded_file,
        )
        asset.save()
        asset.object_key = asset.file.name
        asset.save(update_fields=['object_key'])
        record_activity(tenant, request.user, f'Uploaded “{asset.name}” ({asset.size_bytes} bytes).')
        return Response(self.get_serializer(asset).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='file')
    def file(self, request, pk=None):
        asset = self.get_object()
        if not asset.file:
            return Response({'detail': 'This asset does not have a stored file.'}, status=status.HTTP_404_NOT_FOUND)

        if request.query_params.get('thumbnail') == '1':
            if not asset.content_type.startswith('image/'):
                return Response({'detail': 'Thumbnails are available for images only.'}, status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)
            try:
                from PIL import Image, ImageOps

                output = BytesIO()
                with asset.file.open('rb') as source_file:
                    with Image.open(source_file) as image:
                        if image.width * image.height > 20_000_000:
                            return Response({'detail': 'Image dimensions are too large to preview.'}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
                        image = ImageOps.exif_transpose(image)
                        image.thumbnail((640, 480))
                        if image.mode not in ('RGB', 'L'):
                            image = image.convert('RGB')
                        elif image.mode == 'L':
                            image = image.convert('RGB')
                        image.save(output, format='JPEG', quality=78, optimize=True)
                response = HttpResponse(output.getvalue(), content_type='image/jpeg')
            except (OSError, ValueError, Image.DecompressionBombError):
                return Response({'detail': 'Unable to generate an image preview.'}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
            response['X-Content-Type-Options'] = 'nosniff'
            response['Content-Security-Policy'] = "default-src 'none'; sandbox"
            response['Cache-Control'] = 'private, no-store'
            return response

        safe_inline_types = {
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
            'video/mp4', 'video/webm', 'video/quicktime',
        }
        response = FileResponse(
            asset.file.open('rb'),
            as_attachment=asset.content_type not in safe_inline_types,
            filename=Path(asset.name).name,
            content_type=asset.content_type,
        )
        response['X-Content-Type-Options'] = 'nosniff'
        response['Content-Security-Policy'] = "default-src 'none'; sandbox"
        response['Cache-Control'] = 'private, no-store'
        return response

    def perform_create(self, serializer):
        if not self.request.user.is_authenticated:
            return

        tenant = self.request.user.active_tenant
        if tenant is None:
            tenant = Tenant.objects.create(
                name=f"{self.request.user.username}'s workspace",
                slug=f"{self.request.user.username.lower()}-workspace-{uuid.uuid4().hex[:8]}",
            )
            Membership.objects.get_or_create(tenant=tenant, user=self.request.user, defaults={"role": "admin"})
            self.request.user.active_tenant = tenant
            self.request.user.save(update_fields=["active_tenant"])

        asset = serializer.save(tenant=tenant, uploaded_by=self.request.user)
        record_activity(tenant, self.request.user, f'Added asset “{asset.name}”.')
