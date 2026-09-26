import re

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


def _slugify(value):
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "creative-asset").lower()).strip("-")
    return slug or "creative-asset"


def _normalize_type(asset_type, mime_type, file_extension):
    types = {
        "jpg": "image",
        "jpeg": "image",
        "png": "image",
        "gif": "image",
        "webp": "image",
        "svg": "image",
        "mp4": "video",
        "mov": "video",
        "webm": "video",
        "avi": "video",
        "mkv": "video",
        "pdf": "document",
        "zip": "archive",
    }

    candidate = (asset_type or mime_type or file_extension or "image").lower().strip()
    candidate = candidate.split("/")[-1].split(";")[0].replace(".", "")
    return types.get(candidate, "asset")


def _build_tags(asset_name, asset_type, mime_type, file_extension, content_context):
    base_words = []
    for source in [asset_name, content_context, asset_type, mime_type, file_extension]:
        if not source:
            continue
        base_words.extend(re.findall(r"[a-zA-Z0-9]+", str(source)))

    cleaned = [word.lower() for word in base_words if len(word) > 2 and word.lower() not in {"the", "for", "with", "and", "your", "this", "that"}]
    unique = []
    for word in cleaned:
        if word not in unique:
            unique.append(word)

    if not unique:
        unique = ["creative", "digital", "marketing", "brand"]

    if _normalize_type(asset_type, mime_type, file_extension) == "video":
        unique = ["video", *[item for item in unique if item != "video"]][:5]
    elif _normalize_type(asset_type, mime_type, file_extension) == "document":
        unique = ["document", *[item for item in unique if item != "document"]][:5]
    else:
        unique = ["creative", *[item for item in unique if item != "creative"]][:5]

    return unique[:5]


@api_view(["POST"])
@permission_classes([AllowAny])
def generate_metadata(request):
    data = request.data or {}
    asset_name = (data.get("asset_name") or data.get("name") or "creative asset").strip()
    asset_type = (data.get("asset_type") or data.get("type") or "image").strip()
    mime_type = (data.get("mime_type") or "").strip()
    file_extension = (data.get("file_extension") or "").strip()
    content_context = (data.get("content_context") or "").strip()

    slug = _slugify(asset_name)
    normalized_type = (asset_type or "image").upper()
    extension = file_extension.upper() if file_extension else normalized_type
    if not file_extension and normalized_type and normalized_type not in {"IMAGE", "VIDEO", "DOCUMENT", "FILE"}:
        extension = normalized_type

    suggestions = {
        "filename": f"{slug}-{extension.lower()}",
        "alt_text": f"{asset_name} {asset_type.lower()} asset for digital marketing campaign".strip(),
        "caption": (
            f"{asset_name} designed for {content_context or 'a modern digital campaign'} "
            f"with a polished, brand-ready presentation."
        )
        if asset_name
        else "Creative digital asset prepared for marketing and brand storytelling.",
        "tags": _build_tags(asset_name, asset_type, mime_type, file_extension, content_context),
    }

    if content_context:
        suggestions["caption"] = (
            f"{asset_name} for {content_context}. A clean, on-brand visual asset built to support campaign storytelling and discovery."
        )

    response = {
        "success": True,
        "asset_name": asset_name,
        "asset_type": asset_type,
        "mime_type": mime_type,
        "file_extension": file_extension or extension,
        "suggestions": suggestions,
    }
    return Response(response, status=status.HTTP_200_OK)
