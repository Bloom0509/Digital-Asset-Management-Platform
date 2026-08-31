from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import Asset
from .serializers import AssetSerializer


class AssetViewSet(viewsets.ModelViewSet):
    serializer_class = AssetSerializer

    def get_queryset(self):
        return Asset.objects.filter(tenant=self.request.user.active_tenant) if self.request.user.is_authenticated else Asset.objects.none()

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.active_tenant, uploaded_by=self.request.user)
