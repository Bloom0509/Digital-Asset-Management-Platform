from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

def health_check(request):
    return JsonResponse({"service": "digital-asset-management-api", "status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/accounts/", include("apps.accounts.urls")),
    path("api/tenants/", include("apps.tenants.urls")),
    path("api/assets/", include("apps.assets.urls")),
    path("api/collections/", include("apps.collections.urls")),
    path("api/search/", include("apps.search.urls")),
    path("api/ai/", include("apps.ai.urls")),
    path("", health_check, name="health-check"),
]
