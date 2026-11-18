import math
from datetime import datetime, time

from django.db.models import Q, TextField
from django.db.models.functions import Cast
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assets.models import Asset
from apps.assets.serializers import AssetSerializer
from apps.tenants.permissions import WorkspaceRolePermission


class AssetSearchView(APIView):
    """Search and filter active-workspace assets with stable pagination."""

    permission_classes = [WorkspaceRolePermission]

    def get(self, request):
        params = request.query_params
        queryset = Asset.objects.filter(
            tenant_id=request.user.active_tenant_id,
            deleted_at__isnull=True,
        )

        query = params.get("q", "").strip()
        if query:
            queryset = queryset.annotate(
                searchable_tags=Cast("tags", TextField()),
                searchable_custom_fields=Cast("custom_fields", TextField()),
            )
            queryset = queryset.filter(
                Q(name__icontains=query)
                | Q(description__icontains=query)
                | Q(alt_text__icontains=query)
                | Q(creator__icontains=query)
                | Q(campaign__icontains=query)
                | Q(license__icontains=query)
                | Q(searchable_tags__icontains=query)
                | Q(searchable_custom_fields__icontains=query)
            )

        asset_type = params.get("type", "").strip()
        if asset_type == "JPG":
            queryset = queryset.filter(Q(content_type__startswith="image/") | Q(metadata__type__iexact=asset_type))
        elif asset_type == "MP4":
            queryset = queryset.filter(Q(content_type__startswith="video/") | Q(metadata__type__iexact=asset_type))
        elif asset_type == "PDF":
            queryset = queryset.filter(Q(content_type="application/pdf") | Q(metadata__type__iexact=asset_type))
        elif asset_type:
            queryset = queryset.filter(metadata__type__iexact=asset_type)

        for parameter, field in (("creator", "creator"), ("campaign", "campaign"), ("license", "license")):
            value = params.get(parameter, "").strip()
            if value:
                queryset = queryset.filter(**{f"{field}__icontains": value})

        tag = params.get("tag", "").strip()
        if tag:
            queryset = queryset.filter(tags__contains=[tag])

        date_from = self._date_filter(params.get("date_from"), end=False)
        date_to = self._date_filter(params.get("date_to"), end=True)
        if isinstance(date_from, Response):
            return date_from
        if isinstance(date_to, Response):
            return date_to
        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)

        min_size = self._size_filter(params.get("min_size"), "min_size")
        max_size = self._size_filter(params.get("max_size"), "max_size")
        if isinstance(min_size, Response):
            return min_size
        if isinstance(max_size, Response):
            return max_size
        if min_size is not None:
            queryset = queryset.filter(size_bytes__gte=min_size)
        if max_size is not None:
            queryset = queryset.filter(size_bytes__lte=max_size)

        ordering = {
            "recent": "-created_at",
            "oldest": "created_at",
            "name": "name",
            "size": "-size_bytes",
        }.get(params.get("sort", "recent"))
        if ordering is None:
            return Response({"detail": "Sort must be recent, oldest, name, or size."}, status=status.HTTP_400_BAD_REQUEST)
        queryset = queryset.order_by(ordering, "id")

        try:
            page = max(1, int(params.get("page", "1")))
            page_size = min(100, max(1, int(params.get("page_size", "24"))))
        except (TypeError, ValueError):
            return Response({"detail": "Page and page_size must be integers."}, status=status.HTTP_400_BAD_REQUEST)

        count = queryset.count()
        total_pages = math.ceil(count / page_size) if count else 0
        page = min(page, total_pages) if total_pages else 1
        assets = queryset[(page - 1) * page_size:page * page_size]
        return Response({
            "count": count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "results": AssetSerializer(assets, many=True, context={"request": request}).data,
        })

    @staticmethod
    def _date_filter(value, end):
        if not value:
            return None
        parsed = parse_date(value)
        if parsed is None:
            return Response({"detail": "Dates must use YYYY-MM-DD format."}, status=status.HTTP_400_BAD_REQUEST)
        boundary = datetime.combine(parsed, time.max if end else time.min)
        return timezone.make_aware(boundary, timezone.get_current_timezone())

    @staticmethod
    def _size_filter(value, field):
        if value in (None, ""):
            return None
        try:
            megabytes = float(value)
            if megabytes < 0 or not math.isfinite(megabytes):
                raise ValueError
            return int(megabytes * 1024 * 1024)
        except (TypeError, ValueError):
            return Response({"detail": f"{field} must be a non-negative number of megabytes."}, status=status.HTTP_400_BAD_REQUEST)
