import json
import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient


class AssetAccessTests(TestCase):
    def test_get_assets_allows_anonymous_access_even_with_invalid_bearer_token(self):
        response = self.client.get(
            "/api/assets/",
            HTTP_AUTHORIZATION="Bearer invalid.token.here",
        )

        self.assertEqual(response.status_code, 200)

    def test_authenticated_user_can_create_a_custom_asset_without_existing_tenant(self):
        username = f"customuser-{uuid.uuid4().hex[:8]}"
        user = get_user_model().objects.create_user(username=username, password="StrongPass123")
        client = APIClient()
        client.force_authenticate(user=user)

        payload = {
            "name": "Campaign banner",
            "object_key": "custom/campaign-banner.png",
            "content_type": "image/png",
            "size_bytes": 120000,
            "metadata": {"source": "custom_asset", "type": "PNG"},
        }
        response = client.post(
            "/api/assets/",
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["name"], "Campaign banner")
        self.assertIsNotNone(user.active_tenant)
