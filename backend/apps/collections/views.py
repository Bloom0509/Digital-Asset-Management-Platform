import uuid

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.assets.models import Asset
from apps.tenants.models import Membership, Tenant

from .models import Collection
from .serializers import (
    CollectionAssetInputSerializer,
    CollectionAssetRemoveSerializer,
    CollectionSerializer,
)


class CollectionViewSet(viewsets.ModelViewSet):
    serializer_class = CollectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant_id = self.request.user.active_tenant_id
        if not tenant_id:
            return Collection.objects.none()
        return Collection.objects.filter(tenant_id=tenant_id).prefetch_related("assets")

    def perform_create(self, serializer):
        tenant = self.request.user.active_tenant
        if tenant is None:
            username = self.request.user.username
            tenant = Tenant.objects.create(
                name=f"{username}'s workspace",
                slug=f"{username.lower()}-workspace-{uuid.uuid4().hex[:8]}",
            )
            Membership.objects.get_or_create(
                tenant=tenant,
                user=self.request.user,
                defaults={"role": "admin"},
            )
            self.request.user.active_tenant = tenant
            self.request.user.save(update_fields=["active_tenant"])
        serializer.save(tenant=tenant)

    @action(detail=True, methods=["post"], url_path="assets")
    def add_assets(self, request, pk=None):
        collection = self.get_object()
        input_serializer = CollectionAssetInputSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        asset_ids = input_serializer.validated_data["asset_ids"]
        assets = Asset.objects.filter(
            id__in=asset_ids,
            tenant=request.user.active_tenant,
            deleted_at__isnull=True,
        )
        if assets.count() != len(set(asset_ids)):
            raise ValidationError({"asset_ids": "One or more assets are unavailable in your workspace."})
        collection.assets.add(*assets)
        return Response(self.get_serializer(collection).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["delete"], url_path="remove-asset")
    def remove_asset(self, request, pk=None):
        collection = self.get_object()
        input_serializer = CollectionAssetRemoveSerializer(
            data=request.query_params or request.data,
            context={"request": request},
        )
        input_serializer.is_valid(raise_exception=True)
        collection.assets.remove(input_serializer.validated_data["asset_id"])
        return Response(self.get_serializer(collection).data, status=status.HTTP_200_OK)
