import json
import mimetypes
import uuid
from datetime import timedelta
from io import BytesIO
from pathlib import Path

from django.core.files.base import ContentFile
from django.db.models import Count, Max, Sum
from django.db.models.functions import TruncDate, TruncMonth, TruncWeek
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

from .models import Asset, AssetAuditEvent, AssetVersion, compute_file_hash
from .serializers import AssetAuditEventSerializer, AssetSerializer, AssetUploadSerializer, AssetVersionSerializer, BulkAssetMetadataSerializer


class OptionalJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:
            return None


class AssetViewSet(viewsets.ModelViewSet):
    serializer_class = AssetSerializer

    def _snapshot_asset(self, asset, user):
        if not asset.file:
            return None

        latest_version = asset.versions.aggregate(max_number=Max("version_number"))["max_number"] or 0
        version = AssetVersion(
            asset=asset,
            version_number=latest_version + 1,
            uploaded_by=user,
            name=asset.name,
            content_type=asset.content_type,
            size_bytes=asset.size_bytes,
            file_hash=asset.file_hash,
            metadata=asset.metadata,
            tags=asset.tags,
            description=asset.description,
            alt_text=asset.alt_text,
            creator=asset.creator,
            campaign=asset.campaign,
            license=asset.license,
            custom_fields=asset.custom_fields,
        )
        with asset.file.open("rb") as current_file:
            version.file.save(Path(asset.file.name).name, current_file, save=False)
        version.save()
        return version

    @staticmethod
    def _delete_file_after_commit(storage, file_name):
        if file_name:
            transaction.on_commit(lambda: storage.delete(file_name))

    @staticmethod
    def _record_asset_audit(asset, actor, action, details=None):
        return AssetAuditEvent.objects.create(
            asset=asset,
            actor=actor,
            action=action,
            details=details or {},
        )

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
        metadata_changed = any(getattr(asset, field) != value for field, value in previous_metadata.items())
        asset_changed = asset.name != previous_name or metadata_changed
        if asset_changed and asset.approval_status != Asset.ApprovalStatus.DRAFT:
            self._reset_approval(asset)
        if asset.name != previous_name:
            record_activity(asset.tenant, self.request.user, f'Renamed asset “{previous_name}” to “{asset.name}”.')
        elif metadata_changed:
            record_activity(asset.tenant, self.request.user, f'Updated metadata for “{asset.name}”.')

    @staticmethod
    def _reset_approval(asset):
        asset.approval_status = Asset.ApprovalStatus.DRAFT
        asset.submitted_by = None
        asset.submitted_at = None
        asset.reviewed_by = None
        asset.reviewed_at = None
        asset.review_note = ""
        asset.save(update_fields=[
            'approval_status', 'submitted_by', 'submitted_at', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at',
        ])

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=['deleted_at', 'updated_at'])
        record_activity(instance.tenant, self.request.user, f'Moved “{instance.name}” to trash.')

    @action(detail=True, methods=['get'], url_path='audit')
    def audit(self, request, pk=None):
        asset = self.get_object()
        events = asset.audit_events.select_related('actor').all()
        return Response(AssetAuditEventSerializer(events, many=True).data)

    @action(detail=True, methods=['post'])
    def share(self, request, pk=None):
        asset = self.get_object()
        self._record_asset_audit(asset, request.user, AssetAuditEvent.Action.SHARED, {'scope': 'workspace'})
        record_activity(asset.tenant, request.user, f'Shared a workspace link to “{asset.name}”.')
        return Response({'detail': 'Workspace share recorded.'}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='storage-usage')
    def storage_usage(self, request):
        tenant = request.user.active_tenant
        if tenant is None:
            return Response({'detail': 'No active workspace is selected.'}, status=status.HTTP_400_BAD_REQUEST)

        periods = {
            '7d': (7, TruncDate('created_at')),
            '30d': (30, TruncDate('created_at')),
            '90d': (90, TruncWeek('created_at')),
            '365d': (365, TruncMonth('created_at')),
        }
        period = request.query_params.get('period', '30d')
        if period not in periods:
            return Response(
                {'period': ['Choose one of: 7d, 30d, 90d, 365d.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        period_days, bucket_expression = periods[period]
        stored_assets = Asset.objects.filter(tenant=tenant, file__isnull=False).exclude(file='')
        totals = stored_assets.aggregate(total_bytes=Sum('size_bytes'), asset_count=Count('id'))
        type_totals = stored_assets.values('content_type').annotate(
            total_bytes=Sum('size_bytes'),
            asset_count=Count('id'),
        ).order_by('-total_bytes', 'content_type')
        by_type = []
        for item in type_totals:
            content_type = item['content_type'] or 'application/octet-stream'
            extension = mimetypes.guess_extension(content_type, strict=False)
            type_label = extension.lstrip('.').upper() if extension else content_type.split('/')[-1].upper()
            if type_label in ('JPE', 'JPEG'):
                type_label = 'JPG'
            by_type.append({
                'type': type_label,
                'content_type': content_type,
                'total_bytes': item['total_bytes'] or 0,
                'asset_count': item['asset_count'],
            })

        start_date = timezone.localdate() - timedelta(days=period_days - 1)
        period_assets = stored_assets.filter(created_at__date__gte=start_date)
        timeline_rows = period_assets.annotate(bucket=bucket_expression).values('bucket').annotate(
            total_bytes=Sum('size_bytes'),
            asset_count=Count('id'),
        ).order_by('bucket')
        timeline = []
        for item in timeline_rows:
            bucket = item['bucket']
            if hasattr(bucket, 'date'):
                bucket = bucket.date()
            timeline.append({
                'date': bucket.isoformat(),
                'total_bytes': item['total_bytes'] or 0,
                'asset_count': item['asset_count'],
            })

        period_totals = period_assets.aggregate(
            total_bytes=Sum('size_bytes'),
            asset_count=Count('id'),
        )
        return Response({
            'workspace': {'id': str(tenant.pk), 'name': tenant.name},
            'period': period,
            'total_bytes': totals['total_bytes'] or 0,
            'asset_count': totals['asset_count'],
            'period_bytes': period_totals['total_bytes'] or 0,
            'period_asset_count': period_totals['asset_count'],
            'by_type': by_type,
            'timeline': timeline,
        })

    @action(detail=False, methods=['get'])
    def trash(self, request):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        asset = self.get_object()
        asset.deleted_at = None
        asset.save(update_fields=['deleted_at', 'updated_at'])
        self._record_asset_audit(asset, request.user, AssetAuditEvent.Action.RESTORED, {'source': 'trash'})
        record_activity(asset.tenant, request.user, f'Restored “{asset.name}” from trash.')
        return Response(self.get_serializer(asset).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path='permanent-delete')
    def permanent_delete(self, request, pk=None):
        asset = self.get_object()
        record_activity(asset.tenant, request.user, f'Permanently deleted “{asset.name}”.')
        for version in asset.versions.all():
            if version.file:
                version.file.delete(save=False)
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

    @action(detail=True, methods=['get'], url_path='versions')
    def versions(self, request, pk=None):
        asset = self.get_object()
        serializer = AssetVersionSerializer(asset.versions.all(), many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=['post'],
        url_path='replace-file',
        parser_classes=[MultiPartParser, FormParser],
    )
    def replace_file(self, request, pk=None):
        asset = self.get_object()
        uploaded_file = request.data.get('file')
        if uploaded_file is None:
            return Response({'file': ['A replacement file is required.']}, status=status.HTTP_400_BAD_REQUEST)

        upload_serializer = AssetUploadSerializer(data={'file': uploaded_file, 'name': asset.name})
        upload_serializer.is_valid(raise_exception=True)
        uploaded_file = upload_serializer.validated_data['file']
        metadata_payload = {}
        raw_metadata = request.data.get('metadata')
        if raw_metadata:
            try:
                metadata_payload = json.loads(raw_metadata) if isinstance(raw_metadata, str) else raw_metadata
            except (TypeError, json.JSONDecodeError) as exc:
                return Response({'metadata': ['Provide valid JSON metadata.']}, status=status.HTTP_400_BAD_REQUEST)
            if not isinstance(metadata_payload, dict):
                return Response({'metadata': ['Provide a JSON object.']}, status=status.HTTP_400_BAD_REQUEST)
        metadata_serializer = AssetSerializer(
            asset,
            data=metadata_payload,
            partial=True,
            context=self.get_serializer_context(),
        )
        metadata_serializer.is_valid(raise_exception=True)
        file_hash = compute_file_hash(uploaded_file)
        duplicate = Asset.objects.filter(
            tenant=asset.tenant,
            file_hash=file_hash,
            deleted_at__isnull=True,
        ).exclude(pk=asset.pk).first()
        if duplicate:
            return Response(
                {'detail': f'This file already exists in this workspace as “{duplicate.name}”.'},
                status=status.HTTP_409_CONFLICT,
            )

        old_file_name = asset.file.name if asset.file else None
        old_storage = asset.file.storage if asset.file else None
        extension = Path(uploaded_file.name).suffix.lower()
        content_type = mimetypes.guess_type(uploaded_file.name)[0] or 'application/octet-stream'

        with transaction.atomic():
            self._snapshot_asset(asset, request.user)
            asset.file.save(uploaded_file.name, uploaded_file, save=False)
            asset.object_key = asset.file.name
            asset.content_type = content_type
            asset.size_bytes = uploaded_file.size
            asset.file_hash = file_hash
            asset.approval_status = Asset.ApprovalStatus.DRAFT
            asset.submitted_by = None
            asset.submitted_at = None
            asset.reviewed_by = None
            asset.reviewed_at = None
            asset.review_note = ""
            for field, value in metadata_serializer.validated_data.items():
                setattr(asset, field, value)
            asset.size_bytes = uploaded_file.size
            asset.metadata = {
                **(asset.metadata or {}),
                'original_filename': Path(uploaded_file.name).name,
                'type': extension.lstrip('.').upper(),
            }
            asset.save(update_fields=[
                'file', 'object_key', 'content_type', 'size_bytes', 'file_hash', 'metadata', 'approval_status',
                'submitted_by', 'submitted_at', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at',
            ])
            self._delete_file_after_commit(old_storage, old_file_name)

        record_activity(asset.tenant, request.user, f'Replaced the file for “{asset.name}”.')
        self._record_asset_audit(
            asset,
            request.user,
            AssetAuditEvent.Action.REPLACED,
            {'filename': Path(uploaded_file.name).name, 'content_type': content_type, 'size_bytes': uploaded_file.size},
        )
        return Response(self.get_serializer(asset).data)

    @action(detail=True, methods=['post'], url_path='submit-for-review')
    def submit_for_review(self, request, pk=None):
        asset = self.get_object()
        if asset.approval_status not in (
            Asset.ApprovalStatus.DRAFT,
            Asset.ApprovalStatus.CHANGES_REQUESTED,
        ):
            return Response(
                {'detail': 'Only draft assets or assets with requested changes can be submitted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        asset.approval_status = Asset.ApprovalStatus.IN_REVIEW
        asset.submitted_by = request.user
        asset.submitted_at = timezone.now()
        asset.reviewed_by = None
        asset.reviewed_at = None
        asset.review_note = ""
        asset.save(update_fields=[
            'approval_status', 'submitted_by', 'submitted_at', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at',
        ])
        record_activity(asset.tenant, request.user, f'Submitted “{asset.name}” for review.')
        return Response(self.get_serializer(asset).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if request.workspace_membership.role != Membership.Role.ADMIN:
            return Response({'detail': 'Only workspace admins can approve assets.'}, status=status.HTTP_403_FORBIDDEN)
        asset = self.get_object()
        if asset.approval_status != Asset.ApprovalStatus.IN_REVIEW:
            return Response({'detail': 'Only assets in review can be approved.'}, status=status.HTTP_400_BAD_REQUEST)

        asset.approval_status = Asset.ApprovalStatus.APPROVED
        asset.reviewed_by = request.user
        asset.reviewed_at = timezone.now()
        asset.review_note = ""
        asset.save(update_fields=['approval_status', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at'])
        record_activity(asset.tenant, request.user, f'Approved “{asset.name}”.')
        return Response(self.get_serializer(asset).data)

    @action(detail=True, methods=['post'], url_path='request-changes')
    def request_changes(self, request, pk=None):
        if request.workspace_membership.role != Membership.Role.ADMIN:
            return Response({'detail': 'Only workspace admins can request changes.'}, status=status.HTTP_403_FORBIDDEN)
        asset = self.get_object()
        if asset.approval_status != Asset.ApprovalStatus.IN_REVIEW:
            return Response({'detail': 'Only assets in review can have changes requested.'}, status=status.HTTP_400_BAD_REQUEST)

        note = request.data.get('note', '').strip()
        if not note:
            return Response({'note': ['Provide a reason for the requested changes.']}, status=status.HTTP_400_BAD_REQUEST)
        if len(note) > 2000:
            return Response({'note': ['Review notes must be 2000 characters or fewer.']}, status=status.HTTP_400_BAD_REQUEST)

        asset.approval_status = Asset.ApprovalStatus.CHANGES_REQUESTED
        asset.reviewed_by = request.user
        asset.reviewed_at = timezone.now()
        asset.review_note = note
        asset.save(update_fields=['approval_status', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at'])
        record_activity(asset.tenant, request.user, f'Requested changes for “{asset.name}”: {note[:180]}')
        return Response(self.get_serializer(asset).data)

    @action(
        detail=True,
        methods=['get'],
        url_path=r'versions/(?P<version_id>[^/.]+)/file',
    )
    def version_file(self, request, pk=None, version_id=None):
        asset = self.get_object()
        version = asset.versions.filter(pk=version_id).first()
        if version is None:
            return Response({'detail': 'Asset version not found.'}, status=status.HTTP_404_NOT_FOUND)

        safe_inline_types = {
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
            'video/mp4', 'video/webm', 'video/quicktime',
        }
        response = FileResponse(
            version.file.open('rb'),
            as_attachment=version.content_type not in safe_inline_types,
            filename=Path(version.name).name,
            content_type=version.content_type,
        )
        response['X-Content-Type-Options'] = 'nosniff'
        response['Content-Security-Policy'] = "default-src 'none'; sandbox"
        response['Cache-Control'] = 'private, no-store'
        return response

    @action(
        detail=True,
        methods=['post'],
        url_path=r'versions/(?P<version_id>[^/.]+)/restore',
    )
    def restore_version(self, request, pk=None, version_id=None):
        asset = self.get_object()
        version = asset.versions.filter(pk=version_id).first()
        if version is None:
            return Response({'detail': 'Asset version not found.'}, status=status.HTTP_404_NOT_FOUND)

        old_file_name = asset.file.name if asset.file else None
        old_storage = asset.file.storage if asset.file else None
        with transaction.atomic():
            self._snapshot_asset(asset, request.user)
            with version.file.open('rb') as version_file:
                asset.file.save(Path(version.file.name).name, version_file, save=False)
            for field in (
                'name', 'content_type', 'size_bytes', 'file_hash', 'metadata', 'tags', 'description',
                'alt_text', 'creator', 'campaign', 'license', 'custom_fields',
            ):
                setattr(asset, field, getattr(version, field))
            asset.object_key = asset.file.name
            asset.save(update_fields=[
                'file', 'object_key', 'name', 'content_type', 'size_bytes', 'file_hash', 'metadata', 'tags',
                'description', 'alt_text', 'creator', 'campaign', 'license', 'custom_fields', 'updated_at',
            ])
            if asset.approval_status != Asset.ApprovalStatus.DRAFT:
                self._reset_approval(asset)
            self._delete_file_after_commit(old_storage, old_file_name)

        record_activity(
            asset.tenant,
            request.user,
            f'Restored version {version.version_number} of “{asset.name}”.',
        )
        self._record_asset_audit(
            asset,
            request.user,
            AssetAuditEvent.Action.RESTORED,
            {'source': 'version', 'version_number': version.version_number},
        )
        return Response(self.get_serializer(asset).data)

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
                previous_metadata = {
                    field: getattr(asset, field)
                    for field in ('tags', 'description', 'alt_text', 'creator', 'campaign', 'license', 'custom_fields')
                }
                updated_asset = serializer.save()
                metadata_changed = any(
                    getattr(updated_asset, field) != value
                    for field, value in previous_metadata.items()
                )
                if metadata_changed and updated_asset.approval_status != Asset.ApprovalStatus.DRAFT:
                    self._reset_approval(updated_asset)
                updated_assets.append(updated_asset)
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
        self._record_asset_audit(
            asset,
            request.user,
            AssetAuditEvent.Action.UPLOADED,
            {'filename': Path(uploaded_file.name).name, 'content_type': content_type, 'size_bytes': uploaded_file.size},
        )
        record_activity(tenant, request.user, f'Uploaded “{asset.name}” ({asset.size_bytes} bytes).')
        return Response(self.get_serializer(asset).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='file')
    def file(self, request, pk=None):
        asset = self.get_object()
        if not asset.file:
            return Response({'detail': 'This asset does not have a stored file.'}, status=status.HTTP_404_NOT_FOUND)
        if not asset.file.storage.exists(asset.file.name):
            return Response({'detail': 'The stored asset file is missing.'}, status=status.HTTP_404_NOT_FOUND)
        if request.query_params.get('rendition') == '1':
            return self._render_rendition(asset, request)

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
        is_download = request.query_params.get('download') == '1'
        response = FileResponse(
            asset.file.open('rb'),
            as_attachment=is_download or asset.content_type not in safe_inline_types,
            filename=Path(asset.name).name,
            content_type=asset.content_type,
        )
        if is_download:
            self._record_asset_audit(asset, request.user, AssetAuditEvent.Action.DOWNLOADED, {'rendition': False})
        response['X-Content-Type-Options'] = 'nosniff'
        response['Content-Security-Policy'] = "default-src 'none'; sandbox"
        response['Cache-Control'] = 'private, no-store'
        return response

    @staticmethod
    def _render_rendition(asset, request):
        if not asset.content_type.startswith('image/'):
            return Response({'detail': 'Renditions are available for image assets only.'}, status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)

        output_format = request.query_params.get('output_format', 'jpg').lower()
        formats = {
            'jpg': ('JPEG', 'jpeg'),
            'jpeg': ('JPEG', 'jpeg'),
            'png': ('PNG', 'png'),
            'webp': ('WEBP', 'webp'),
        }
        if output_format not in formats:
            return Response({'format': ['Choose one of: jpg, png, webp.']}, status=status.HTTP_400_BAD_REQUEST)

        try:
            width = int(request.query_params.get('width', '1920'))
            height = int(request.query_params.get('height', '1920'))
            quality = int(request.query_params.get('quality', '82'))
        except (TypeError, ValueError):
            return Response({'detail': 'Width, height, and quality must be integers.'}, status=status.HTTP_400_BAD_REQUEST)
        if not 1 <= width <= 4096 or not 1 <= height <= 4096:
            return Response({'detail': 'Width and height must be between 1 and 4096 pixels.'}, status=status.HTTP_400_BAD_REQUEST)
        if not 30 <= quality <= 95:
            return Response({'detail': 'Quality must be between 30 and 95.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from PIL import Image, ImageOps

            output = BytesIO()
            with asset.file.open('rb') as source_file:
                with Image.open(source_file) as image:
                    if image.width * image.height > 20_000_000:
                        return Response({'detail': 'Image dimensions are too large to process.'}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
                    image = ImageOps.exif_transpose(image)
                    image.thumbnail((width, height), Image.Resampling.LANCZOS)
                    pillow_format, extension = formats[output_format]
                    save_options = {}
                    if pillow_format == 'JPEG':
                        if image.mode not in ('RGB', 'L'):
                            if 'A' in image.getbands():
                                rgba = image.convert('RGBA')
                                background = Image.new('RGB', rgba.size, 'white')
                                background.paste(rgba, mask=rgba.getchannel('A'))
                                image = background
                            else:
                                image = image.convert('RGB')
                        if image.mode == 'L':
                            image = image.convert('RGB')
                        save_options = {'quality': quality, 'optimize': True}
                    elif pillow_format == 'WEBP':
                        if image.mode not in ('RGB', 'RGBA'):
                            image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
                        save_options = {'quality': quality, 'method': 6}
                    else:
                        save_options = {'optimize': True, 'compress_level': round((95 - quality) * 9 / 65)}
                    image.save(output, format=pillow_format, **save_options)
        except (OSError, ValueError, Image.DecompressionBombError):
            return Response({'detail': 'Unable to generate this image rendition.'}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        filename = f'{Path(asset.name).stem or "asset"}-{width}x{height}.{extension}'
        response = FileResponse(
            BytesIO(output.getvalue()),
            as_attachment=True,
            filename=filename,
            content_type=f'image/{extension}',
        )
        if request.query_params.get('download') == '1':
            AssetViewSet._record_asset_audit(
                asset,
                request.user,
                AssetAuditEvent.Action.DOWNLOADED,
                {'rendition': True, 'format': extension, 'width': width, 'height': height, 'quality': quality},
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
        self._record_asset_audit(asset, self.request.user, AssetAuditEvent.Action.UPLOADED, {'source': 'asset_entry'})
        record_activity(tenant, self.request.user, f'Added asset “{asset.name}”.')
