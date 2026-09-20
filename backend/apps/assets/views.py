from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import Asset
from .serializers import AssetSerializer


class AssetViewSet(viewsets.ModelViewSet):
    serializer_class = AssetSerializer
    authentication_classes = []

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
        serializer.save(tenant=self.request.user.active_tenant, uploaded_by=self.request.user)
