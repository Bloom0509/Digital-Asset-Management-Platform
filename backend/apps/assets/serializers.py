import math
from pathlib import Path

from django.conf import settings
from django.urls import reverse
from rest_framework import serializers

from .models import Asset


class AssetSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = (
            "id", "tenant", "uploaded_by", "name", "object_key", "content_type",
            "size_bytes", "metadata", "created_at", "updated_at", "deleted_at", "file_url", "thumbnail_url",
        )
        read_only_fields = ("id", "tenant", "uploaded_by", "created_at", "updated_at", "deleted_at", "file_url", "thumbnail_url")

    def get_file_url(self, asset):
        if not asset.file:
            return None
        return reverse("asset-file", kwargs={"pk": asset.pk})

    def get_thumbnail_url(self, asset):
        if not asset.file or not asset.content_type.startswith("image/"):
            return None
        return f"{reverse('asset-file', kwargs={'pk': asset.pk})}?thumbnail=1"


class AssetUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)

    allowed_extensions = {
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif",
        ".mp4", ".webm", ".mov",
        ".pdf", ".txt", ".csv", ".zip",
        ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    }

    def validate_file(self, uploaded_file):
        if uploaded_file.size <= 0:
            raise serializers.ValidationError("The selected file is empty.")
        if uploaded_file.size > settings.DAM_MAX_UPLOAD_SIZE:
            maximum_mb = max(1, math.ceil(settings.DAM_MAX_UPLOAD_SIZE / (1024 * 1024)))
            raise serializers.ValidationError(f"File exceeds the {maximum_mb} MiB upload limit.")

        extension = Path(uploaded_file.name).suffix.lower()
        if extension not in self.allowed_extensions:
            raise serializers.ValidationError("This file type is not supported.")

        return uploaded_file

    def validate(self, attrs):
        uploaded_file = attrs["file"]
        requested_name = attrs.get("name") or uploaded_file.name
        safe_name = Path(requested_name.replace("\\", "/")).name[:255]
        if not safe_name:
            raise serializers.ValidationError({"name": "A valid filename is required."})
        attrs["name"] = safe_name
        return attrs
