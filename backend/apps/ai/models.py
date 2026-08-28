from django.db import models


class AssetEmbedding(models.Model):
    asset = models.OneToOneField("assets.Asset", on_delete=models.CASCADE, related_name="embedding")
    provider = models.CharField(max_length=100)
    model_name = models.CharField(max_length=150)
    vector = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
