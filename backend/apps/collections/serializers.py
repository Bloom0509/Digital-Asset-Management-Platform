from rest_framework import serializers

from apps.assets.models import Asset

from .models import Collection


class CollectionSerializer(serializers.ModelSerializer):
    assets = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = ("id", "name", "parent", "assets", "created_at")
        read_only_fields = ("id", "assets", "created_at")

    def get_assets(self, collection):
        assets = collection.assets.filter(tenant=collection.tenant, deleted_at__isnull=True)
        return [
            {
                "id": str(asset.id),
                "name": asset.name,
                "content_type": asset.content_type,
                "size_bytes": asset.size_bytes,
                "metadata": asset.metadata,
                "created_at": asset.created_at,
                "updated_at": asset.updated_at,
            }
            for asset in assets
        ]

    def validate_parent(self, parent):
        if parent and parent.tenant_id != self.context["request"].user.active_tenant_id:
            raise serializers.ValidationError("Parent collection must belong to your workspace.")
        return parent


class CollectionAssetInputSerializer(serializers.Serializer):
    asset_ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)


class CollectionAssetRemoveSerializer(serializers.Serializer):
    asset_id = serializers.UUIDField()

    def validate_asset_id(self, asset_id):
        request = self.context["request"]
        exists = Asset.objects.filter(
            id=asset_id,
            tenant=request.user.active_tenant,
            deleted_at__isnull=True,
        ).exists()
        if not exists:
            raise serializers.ValidationError("Asset not found in your workspace.")
        return asset_id