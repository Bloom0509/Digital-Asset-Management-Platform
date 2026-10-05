import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient


class CollectionApiTests(TestCase):
    def setUp(self):
        username = f"collection-user-{uuid.uuid4().hex[:8]}"
        self.user = get_user_model().objects.create_user(username=username, password="StrongPass123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        asset_response = self.client.post(
            "/api/assets/",
            {
                "name": "Campaign image",
                "object_key": f"collections/{uuid.uuid4().hex}.png",
                "content_type": "image/png",
                "size_bytes": 120,
            },
            format="json",
        )
        self.assertEqual(asset_response.status_code, 201, asset_response.content)
        self.asset = asset_response.json()

    def test_create_collection_add_and_remove_asset(self):
        response = self.client.post("/api/collections/", {"name": "Campaigns"}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        collection = response.json()
        self.assertEqual(collection["assets"], [])

        add_response = self.client.post(
            f"/api/collections/{collection['id']}/assets/",
            {"asset_ids": [self.asset["id"]]},
            format="json",
        )
        self.assertEqual(add_response.status_code, 200, add_response.content)
        self.assertEqual([asset["id"] for asset in add_response.json()["assets"]], [self.asset["id"]])

        remove_response = self.client.delete(
            f"/api/collections/{collection['id']}/remove-asset/",
            {"asset_id": self.asset["id"]},
        )
        self.assertEqual(remove_response.status_code, 200, remove_response.content)
        self.assertEqual(remove_response.json()["assets"], [])

    def test_collection_assets_cannot_cross_tenant_boundaries(self):
        collection_response = self.client.post(
            "/api/collections/", {"name": "Private"}, format="json"
        )
        collection_id = collection_response.json()["id"]

        other_user = get_user_model().objects.create_user(
            username=f"other-collection-user-{uuid.uuid4().hex[:8]}",
            password="StrongPass123",
        )
        other_client = APIClient()
        other_client.force_authenticate(user=other_user)
        response = other_client.post(
            f"/api/collections/{collection_id}/assets/",
            {"asset_ids": [self.asset["id"]]},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_collection_api_requires_authentication(self):
        response = APIClient().get("/api/collections/")
        self.assertIn(response.status_code, (401, 403))
