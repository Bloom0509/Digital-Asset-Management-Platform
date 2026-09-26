import uuid

from rest_framework import viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.tenants.models import Membership, Tenant

from .models import Asset
from .serializers import AssetSerializer


class AssetViewSet(viewsets.ModelViewSet):
    serializer_class = AssetSerializer

    def get_authenticators(self):
        if self.request.method == 'GET':
            return []
        return [SessionAuthentication(), JWTAuthentication()]

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return Asset.objects.filter(tenant=self.request.user.active_tenant)
        return Asset.objects.none()

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

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
