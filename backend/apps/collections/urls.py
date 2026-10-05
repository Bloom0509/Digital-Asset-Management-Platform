from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CollectionViewSet

router = DefaultRouter()
router.register("", CollectionViewSet, basename="collection")

urlpatterns = [path("", include(router.urls))]
