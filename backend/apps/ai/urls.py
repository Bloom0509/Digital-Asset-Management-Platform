from django.urls import path

from .views import generate_metadata

urlpatterns = [
    path("metadata/", generate_metadata, name="generate-ai-metadata"),
]
