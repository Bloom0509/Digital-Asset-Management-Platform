import uuid

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.tenants.models import Membership, Tenant

from .models import Asset
from .serializers import AssetSerializer


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
            return queryset.filter(deleted_at__isnull=True)
        return Asset.objects.none()

    def get_permissions(self):
        if self.action in ('trash', 'restore', 'permanent_delete'):
            return [IsAuthenticated()]
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=['deleted_at', 'updated_at'])

    @action(detail=False, methods=['get'])
    def trash(self, request):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        asset = self.get_object()
        asset.deleted_at = None
        asset.save(update_fields=['deleted_at', 'updated_at'])
        return Response(self.get_serializer(asset).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path='permanent-delete')
    def permanent_delete(self, request, pk=None):
        asset = self.get_object()
        asset.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

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

        serializer.save(tenant=tenant, uploaded_by=self.request.user)
