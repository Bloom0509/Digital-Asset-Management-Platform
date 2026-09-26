from django.test import TestCase
from django.urls import reverse


class AIGeneratedMetadataTests(TestCase):
    def test_generate_metadata_returns_suggestions(self):
        url = reverse("generate-ai-metadata")

        response = self.client.post(
            url,
            {
                "asset_name": "spring campaign banner",
                "asset_type": "image",
                "mime_type": "image/png",
                "file_extension": "png",
                "content_context": "marketing banner for product launch",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertIn("suggestions", payload)
        self.assertIn("filename", payload["suggestions"])
        self.assertIn("alt_text", payload["suggestions"])
        self.assertIn("caption", payload["suggestions"])
        self.assertIn("tags", payload["suggestions"])
