import json
import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
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

    def test_delete_moves_asset_to_trash_and_it_can_be_restored_or_deleted_permanently(self):
        username = f"trashuser-{uuid.uuid4().hex[:8]}"
        user = get_user_model().objects.create_user(username=username, password="StrongPass123")
        client = APIClient()
        client.force_authenticate(user=user)
        create_response = client.post(
            "/api/assets/",
            {
                "name": "Trash test image",
                "object_key": f"trash/{uuid.uuid4().hex}.png",
                "content_type": "image/png",
                "size_bytes": 100,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201, create_response.content)
        asset_id = create_response.json()["id"]

        delete_response = client.delete(reverse("asset-detail", args=[asset_id]))
        self.assertEqual(delete_response.status_code, 204)
        self.assertEqual(client.get("/api/assets/").json(), [])
        trash_response = client.get(reverse("asset-trash"))
        self.assertEqual(trash_response.status_code, 200)
        self.assertEqual([asset["id"] for asset in trash_response.json()], [asset_id])
        self.assertIsNotNone(trash_response.json()[0]["deleted_at"])

        restore_response = client.post(reverse("asset-restore", args=[asset_id]))
        self.assertEqual(restore_response.status_code, 200)
        self.assertIsNone(restore_response.json()["deleted_at"])
        self.assertEqual(len(client.get("/api/assets/").json()), 1)

        client.delete(reverse("asset-detail", args=[asset_id]))
        permanent_response = client.delete(reverse("asset-permanent-delete", args=[asset_id]))
        self.assertEqual(permanent_response.status_code, 204)
        self.assertEqual(client.get(reverse("asset-trash")).json(), [])

    def test_trash_requires_authentication(self):
        response = self.client.get(reverse("asset-trash"))
        self.assertIn(response.status_code, (401, 403))

    def test_trash_is_scoped_to_the_authenticated_tenant(self):
        owner = get_user_model().objects.create_user(
            username=f"trash-owner-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        owner_client = APIClient()
        owner_client.force_authenticate(user=owner)
        create_response = owner_client.post(
            "/api/assets/",
            {
                "name": "Private deleted image",
                "object_key": f"trash/{uuid.uuid4().hex}.png",
                "content_type": "image/png",
            },
            format="json",
        )
        asset_id = create_response.json()["id"]
        owner_client.delete(reverse("asset-detail", args=[asset_id]))

        other_user = get_user_model().objects.create_user(
            username=f"other-user-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        other_client = APIClient()
        other_client.force_authenticate(user=other_user)
        self.assertEqual(other_client.get(reverse("asset-trash")).json(), [])
        self.assertEqual(other_client.post(reverse("asset-restore", args=[asset_id])).status_code, 404)
