from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AssetViewSet

router = DefaultRouter()
router.register("", AssetViewSet, basename="asset")

urlpatterns = [path("", include(router.urls))]
