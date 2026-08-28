from rest_framework import viewsets

from .models import Asset
from .serializers import AssetSerializer


class AssetViewSet(viewsets.ModelViewSet):
    serializer_class = AssetSerializer

    def get_queryset(self):
        return Asset.objects.filter(tenant=self.request.user.active_tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.active_tenant, uploaded_by=self.request.user)
