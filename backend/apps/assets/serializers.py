import json
import math
from pathlib import Path

from django.conf import settings
from django.urls import reverse
from rest_framework import serializers

from .models import Asset


class AssetSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50, allow_blank=True),
        required=False,
    )
    custom_fields = serializers.DictField(
        child=serializers.CharField(max_length=500, allow_blank=True),
        required=False,
    )

    class Meta:
        model = Asset
        fields = (
            "id", "tenant", "uploaded_by", "name", "object_key", "content_type",
            "size_bytes", "file_hash", "metadata", "tags", "description", "alt_text", "creator", "campaign",
            "license", "custom_fields", "created_at", "updated_at", "deleted_at", "file_url", "thumbnail_url",
        )
        read_only_fields = ("id", "tenant", "uploaded_by", "file_hash", "created_at", "updated_at", "deleted_at", "file_url", "thumbnail_url")

    def validate_tags(self, tags):
        if len(tags) > 20:
            raise serializers.ValidationError("Use no more than 20 tags per asset.")
        normalized = []
        seen = set()
        for tag in tags:
            clean_tag = tag.strip()
            if not clean_tag:
                continue
            if len(clean_tag) > 50:
                raise serializers.ValidationError("Each tag must be 50 characters or fewer.")
            key = clean_tag.casefold()
            if key not in seen:
                normalized.append(clean_tag)
                seen.add(key)
        return normalized

    def validate_custom_fields(self, custom_fields):
        if len(custom_fields) > 20:
            raise serializers.ValidationError("Use no more than 20 custom fields per asset.")
        normalized = {}
        for key, value in custom_fields.items():
            clean_key = key.strip()
            if not clean_key or len(clean_key) > 50:
                raise serializers.ValidationError("Custom field names must be between 1 and 50 characters.")
            if not isinstance(value, str):
                raise serializers.ValidationError("Custom field values must be text.")
            clean_value = value.strip()
            if len(clean_value) > 500:
                raise serializers.ValidationError("Custom field values must be 500 characters or fewer.")
            normalized[clean_key] = clean_value
        return normalized

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
    tags = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    alt_text = serializers.CharField(required=False, allow_blank=True, max_length=500)
    creator = serializers.CharField(required=False, allow_blank=True, max_length=150)
    campaign = serializers.CharField(required=False, allow_blank=True, max_length=150)
    license = serializers.CharField(required=False, allow_blank=True, max_length=150)
    custom_fields = serializers.CharField(required=False, allow_blank=True)

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

        for field_name, expected_type in (("tags", list), ("custom_fields", dict)):
            raw_value = attrs.get(field_name, "")
            if not raw_value:
                attrs[field_name] = [] if expected_type is list else {}
                continue
            try:
                value = json.loads(raw_value)
            except (TypeError, json.JSONDecodeError) as exc:
                raise serializers.ValidationError({field_name: "Provide valid JSON metadata."}) from exc
            if not isinstance(value, expected_type):
                label = "a JSON list" if expected_type is list else "a JSON object"
                raise serializers.ValidationError({field_name: f"Provide {label}."})
            if field_name == "tags":
                if len(value) > 20 or not all(isinstance(tag, str) for tag in value):
                    raise serializers.ValidationError({field_name: "Provide up to 20 text tags."})
                normalized_tags = []
                seen_tags = set()
                for tag in value:
                    clean_tag = tag.strip()
                    if len(clean_tag) > 50:
                        raise serializers.ValidationError({field_name: "Each tag must be 50 characters or fewer."})
                    if clean_tag and clean_tag.casefold() not in seen_tags:
                        normalized_tags.append(clean_tag)
                        seen_tags.add(clean_tag.casefold())
                attrs[field_name] = normalized_tags
            else:
                if len(value) > 20:
                    raise serializers.ValidationError({field_name: "Use no more than 20 custom fields."})
                normalized_fields = {}
                for key, field_value in value.items():
                    if not isinstance(key, str) or not isinstance(field_value, str):
                        raise serializers.ValidationError({field_name: "Custom field names and values must be text."})
                    clean_key = key.strip()
                    clean_value = field_value.strip()
                    if not clean_key or len(clean_key) > 50 or len(clean_value) > 500:
                        raise serializers.ValidationError({field_name: "Custom field names must be 1-50 characters and values up to 500 characters."})
                    normalized_fields[clean_key] = clean_value
                attrs[field_name] = normalized_fields
        return attrs
