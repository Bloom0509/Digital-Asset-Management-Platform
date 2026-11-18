from django.urls import path

from .views import AssetSearchView

urlpatterns = [
    path("assets/", AssetSearchView.as_view(), name="asset-search"),
]
