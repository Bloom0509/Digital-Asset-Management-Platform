import json
import tempfile
import uuid
from pathlib import Path
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from django.urls import reverse
from rest_framework.test import APIClient

from apps.tenants.models import ActivityEvent


class AssetAccessTests(TestCase):
    def test_multipart_upload_is_stored_and_served_only_to_workspace_members(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root)):
                user = get_user_model().objects.create_user(
                    username=f"upload-user-{uuid.uuid4().hex[:8]}", password="StrongPass123"
                )
                owner_client = APIClient()
                owner_client.force_authenticate(user=user)
                file_content = b"private image bytes"
                upload_response = owner_client.post(
                    "/api/assets/upload/",
                    {
                        "file": SimpleUploadedFile("campaign.png", file_content, content_type="image/png"),
                        "tags": json.dumps(["summer", "launch"]),
                        "description": "Summer campaign artwork",
                        "alt_text": "A blue campaign graphic",
                        "creator": "Design team",
                        "campaign": "Summer 2026",
                        "license": "Internal use",
                        "custom_fields": json.dumps({"Brand": "Acme"}),
                    },
                    format="multipart",
                )

                self.assertEqual(upload_response.status_code, 201, upload_response.content)
                asset_data = upload_response.json()
                self.assertEqual(asset_data["name"], "campaign.png")
                self.assertEqual(asset_data["size_bytes"], len(file_content))
                self.assertEqual(asset_data["content_type"], "image/png")
                self.assertEqual(asset_data["tags"], ["summer", "launch"])
                self.assertEqual(asset_data["description"], "Summer campaign artwork")
                self.assertEqual(asset_data["alt_text"], "A blue campaign graphic")
                self.assertEqual(asset_data["creator"], "Design team")
                self.assertEqual(asset_data["campaign"], "Summer 2026")
                self.assertEqual(asset_data["license"], "Internal use")
                self.assertEqual(asset_data["custom_fields"], {"Brand": "Acme"})

                asset = owner_client.get(f"/api/assets/{asset_data['id']}/").json()
                stored_path = Path(media_root, asset["object_key"])
                self.assertTrue(stored_path.is_file())
                self.assertTrue(asset["object_key"].startswith(f"tenants/{user.active_tenant_id}/"))

                file_response = owner_client.get(asset_data["file_url"])
                self.assertEqual(file_response.status_code, 200)
                self.assertEqual(b"".join(file_response.streaming_content), file_content)
                self.assertEqual(file_response["X-Content-Type-Options"], "nosniff")
                self.assertIn("inline", file_response["Content-Disposition"])

                outsider = get_user_model().objects.create_user(
                    username=f"upload-outsider-{uuid.uuid4().hex[:8]}", password="StrongPass123"
                )
                outsider_client = APIClient()
                outsider_client.force_authenticate(user=outsider)
                self.assertEqual(outsider_client.get(asset_data["file_url"]).status_code, 404)

    def test_upload_rejects_duplicate_file_content_within_workspace(self):
        user = get_user_model().objects.create_user(
            username=f"duplicate-upload-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        client = APIClient()
        client.force_authenticate(user=user)
        file_content = b"duplicate asset bytes"

        first_response = client.post(
            "/api/assets/upload/",
            {"file": SimpleUploadedFile("original.png", file_content, content_type="image/png")},
            format="multipart",
        )
        self.assertEqual(first_response.status_code, 201, first_response.content)

        second_response = client.post(
            "/api/assets/upload/",
            {"file": SimpleUploadedFile("copy.png", file_content, content_type="image/png")},
            format="multipart",
        )

        self.assertEqual(second_response.status_code, 409, second_response.content)
        self.assertIn("already exists", second_response.json()["detail"])
        activity = ActivityEvent.objects.filter(tenant=user.active_tenant, event_type="error").order_by('-created_at').first()
        self.assertIsNotNone(activity)
        self.assertIn("already exists", activity.message)

    @override_settings(DAM_MAX_UPLOAD_SIZE=3)
    def test_upload_rejects_files_over_configured_size_limit(self):
        user = get_user_model().objects.create_user(
            username=f"large-upload-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/assets/upload/",
            {"file": SimpleUploadedFile("too-large.txt", b"four", content_type="text/plain")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("1 MiB", response.json()["file"][0])

    def test_upload_rejects_unsupported_extensions(self):
        user = get_user_model().objects.create_user(
            username=f"invalid-upload-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/assets/upload/",
            {"file": SimpleUploadedFile("malware.exe", b"not executable", content_type="application/octet-stream")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("not supported", response.json()["file"][0])

    def test_image_thumbnail_is_generated_at_a_bounded_size(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root)):
                user = get_user_model().objects.create_user(
                    username=f"thumbnail-user-{uuid.uuid4().hex[:8]}", password="StrongPass123"
                )
                client = APIClient()
                client.force_authenticate(user=user)
                original = BytesIO()
                Image.new("RGB", (1280, 960), color="navy").save(original, format="PNG")
                original.seek(0)

                upload_response = client.post(
                    "/api/assets/upload/",
                    {"file": SimpleUploadedFile("thumbnail.png", original.read(), content_type="image/png")},
                    format="multipart",
                )
                self.assertEqual(upload_response.status_code, 201, upload_response.content)
                thumbnail_response = client.get(upload_response.json()["thumbnail_url"])
                self.assertEqual(thumbnail_response.status_code, 200)
                self.assertEqual(thumbnail_response["Content-Type"], "image/jpeg")
                with Image.open(BytesIO(thumbnail_response.content)) as thumbnail:
                    self.assertLessEqual(thumbnail.width, 640)
                    self.assertLessEqual(thumbnail.height, 480)

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

    def test_asset_metadata_can_be_created_and_updated(self):
        user = get_user_model().objects.create_user(
            username=f"metadata-user-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        client = APIClient()
        client.force_authenticate(user=user)
        create_response = client.post(
            "/api/assets/",
            {
                "name": "Spring campaign banner",
                "object_key": f"metadata/{uuid.uuid4().hex}.png",
                "content_type": "image/png",
                "tags": ["Spring", "Campaign", " spring "],
                "description": "Homepage hero image for the spring launch.",
                "alt_text": "A flower illustration on a green background.",
                "creator": "Design team",
                "campaign": "Spring 2026",
                "license": "Internal use only",
                "custom_fields": {"Brand": "Acme", "Region": "North America"},
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, 201, create_response.content)
        asset_id = create_response.json()["id"]
        self.assertEqual(create_response.json()["tags"], ["Spring", "Campaign"])
        self.assertEqual(create_response.json()["custom_fields"]["Brand"], "Acme")

        update_response = client.patch(
            reverse("asset-detail", args=[asset_id]),
            {"tags": ["approved"], "description": "Final approved artwork."},
            format="json",
        )
        self.assertEqual(update_response.status_code, 200, update_response.content)
        self.assertEqual(update_response.json()["tags"], ["approved"])
        self.assertEqual(update_response.json()["description"], "Final approved artwork.")
        self.assertEqual(update_response.json()["creator"], "Design team")

    def test_bulk_metadata_updates_selected_assets_and_records_activity(self):
        user = get_user_model().objects.create_user(
            username=f"bulk-metadata-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        client = APIClient()
        client.force_authenticate(user=user)
        asset_ids = []
        for index in range(2):
            response = client.post(
                "/api/assets/",
                {
                    "name": f"Bulk asset {index}",
                    "object_key": f"bulk/{uuid.uuid4().hex}.png",
                    "content_type": "image/png",
                    "tags": ["before"],
                    "creator": "Original creator",
                },
                format="json",
            )
            self.assertEqual(response.status_code, 201, response.content)
            asset_ids.append(response.json()["id"])

        response = client.post(
            "/api/assets/bulk-metadata/",
            {
                "asset_ids": asset_ids,
                "metadata": {"tags": ["summer", "launch"], "campaign": "Summer 2026"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["updated"], 2)
        self.assertEqual(len(response.json()["assets"]), 2)
        self.assertTrue(all(asset["tags"] == ["summer", "launch"] for asset in response.json()["assets"]))
        self.assertTrue(all(asset["campaign"] == "Summer 2026" for asset in response.json()["assets"]))
        self.assertTrue(all(asset["creator"] == "Original creator" for asset in response.json()["assets"]))
        self.assertTrue(
            ActivityEvent.objects.filter(
                tenant=user.active_tenant,
                message="Updated metadata for 2 assets.",
            ).exists()
        )

    def test_bulk_metadata_supports_different_tags_per_asset(self):
        user = get_user_model().objects.create_user(
            username=f"bulk-tags-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        client = APIClient()
        client.force_authenticate(user=user)
        asset_ids = []
        initial_tags = [["old-one"], ["old-two"]]
        for index, tags in enumerate(initial_tags):
            response = client.post(
                "/api/assets/",
                {
                    "name": f"Tag asset {index}",
                    "object_key": f"bulk-tags/{uuid.uuid4().hex}.png",
                    "content_type": "image/png",
                    "tags": tags,
                },
                format="json",
            )
            self.assertEqual(response.status_code, 201, response.content)
            asset_ids.append(response.json()["id"])

        response = client.post(
            "/api/assets/bulk-metadata/",
            {
                "asset_ids": asset_ids,
                "metadata": {"campaign": "Spring launch"},
                "per_asset_metadata": {
                    asset_ids[0]: {"tags": ["new-one", "featured"]},
                    asset_ids[1]: {"tags": ["new-two"]},
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.content)
        assets_by_id = {asset["id"]: asset for asset in response.json()["assets"]}
        self.assertEqual(assets_by_id[asset_ids[0]]["tags"], ["new-one", "featured"])
        self.assertEqual(assets_by_id[asset_ids[1]]["tags"], ["new-two"])
        self.assertTrue(all(asset["campaign"] == "Spring launch" for asset in assets_by_id.values()))

    def test_bulk_metadata_rejects_assets_outside_active_workspace(self):
        user = get_user_model().objects.create_user(
            username=f"bulk-metadata-owner-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        outsider = get_user_model().objects.create_user(
            username=f"bulk-metadata-outsider-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        owner_client = APIClient()
        owner_client.force_authenticate(user=user)
        asset_response = owner_client.post(
            "/api/assets/",
            {
                "name": "Private asset",
                "object_key": f"private/{uuid.uuid4().hex}.png",
                "content_type": "image/png",
            },
            format="json",
        )
        self.assertEqual(asset_response.status_code, 201, asset_response.content)

        outsider_client = APIClient()
        outsider_client.force_authenticate(user=outsider)
        response = outsider_client.post(
            "/api/assets/bulk-metadata/",
            {"asset_ids": [asset_response.json()["id"]], "metadata": {"campaign": "Unauthorized"}},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            owner_client.get(f"/api/assets/{asset_response.json()['id']}/").json()["campaign"],
            "",
        )

    def test_asset_metadata_rejects_too_many_tags(self):
        user = get_user_model().objects.create_user(
            username=f"metadata-limit-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post(
            "/api/assets/",
            {
                "name": "Too many tags",
                "object_key": f"metadata/{uuid.uuid4().hex}.png",
                "content_type": "image/png",
                "tags": [f"tag-{index}" for index in range(21)],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("20 tags", response.json()["tags"][0])

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
