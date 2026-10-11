from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Membership, Tenant

User = get_user_model()


class MembershipSerializer(serializers.ModelSerializer):
    tenant_id = serializers.UUIDField(source="tenant.id", read_only=True)
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)
    tenant_slug = serializers.CharField(source="tenant.slug", read_only=True)
    user_id = serializers.UUIDField(source="user.id", read_only=True)

    class Meta:
        model = Membership
        fields = ("tenant_id", "tenant_name", "tenant_slug", "role", "user_id")


class TenantCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ("id", "name", "slug")
        read_only_fields = ("id",)

    def validate_slug(self, value):
        if not value:
            raise serializers.ValidationError("Workspace slug is required.")
        return value


class TenantSwitchSerializer(serializers.Serializer):
    workspace_id = serializers.UUIDField()
