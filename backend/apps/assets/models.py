import uuid
from pathlib import Path

from django.conf import settings
from django.db import models


def asset_upload_path(instance, filename):
    extension = Path(filename).suffix.lower()[:12]
    return f"tenants/{instance.tenant_id}/{instance.pk}/{uuid.uuid4().hex}{extension}"


class Asset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE, related_name="assets")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="uploaded_assets")
    name = models.CharField(max_length=255)
    object_key = models.CharField(max_length=500, unique=True)
    file = models.FileField(upload_to=asset_upload_path, blank=True, null=True)
    content_type = models.CharField(max_length=150)
    size_bytes = models.PositiveBigIntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True)
    tags = models.JSONField(default=list, blank=True)
    description = models.TextField(blank=True)
    alt_text = models.CharField(max_length=500, blank=True)
    creator = models.CharField(max_length=150, blank=True)
    campaign = models.CharField(max_length=150, blank=True)
    license = models.CharField(max_length=150, blank=True)
    custom_fields = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        indexes = [models.Index(fields=["tenant", "created_at"])]
