import os
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient


MODEL_RESPONSE = {
    "filename": "aurora-campaign-banner.png",
    "alt_text": "An original aurora-inspired campaign illustration",
    "caption": "Colorful night-sky artwork for the Aurora launch.",
    "tags": ["aurora", "launch", "night sky"],
    "drawing_ideas": [
        {"title": "Layered northern lights", "svg": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 320"><path d="M20 250 Q150 20 300 230" fill="none" stroke="#224433" stroke-width="8"/></svg>'},
        {"title": "Mountain silhouette", "svg": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 320"><polygon points="20,280 180,70 330,280" fill="#99bb88"/></svg>'},
        {"title": "Starry sky badge", "svg": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 320"><circle cx="256" cy="160" r="80" fill="#ffdd88"/></svg>'},
    ],
}


class AIGeneratedMetadataTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="ai-test-user", password="test-password")
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def test_endpoint_returns_model_generated_metadata_and_drawings(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch(
            "apps.ai.views._request_ai_response", return_value=MODEL_RESPONSE
        ) as model_request:
            response = self.api_client.post(
                reverse("generate-ai-metadata"),
                {
                    "asset_name": "Aurora launch",
                    "asset_type": "PNG",
                    "content_context": "campaign banner",
                },
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["suggestions"]["filename"], "aurora-campaign-banner.png")
        ideas = payload["suggestions"]["drawing_ideas"]
        self.assertEqual([idea["title"] for idea in ideas], [idea["title"] for idea in MODEL_RESPONSE["drawing_ideas"]])
        self.assertTrue(all(idea["svg"].startswith("<svg") for idea in ideas))
        model_request.assert_called_once()
        self.assertEqual(model_request.call_args.args[2]["asset_name"], "Aurora launch")

    def test_missing_api_key_returns_configuration_error(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}):
            response = self.api_client.post(
                reverse("generate-ai-metadata"),
                {"asset_name": "Aurora launch"},
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 503)
        self.assertIn("OPENAI_API_KEY", response.json()["detail"])

    def test_endpoint_requires_authentication(self):
        response = self.client.post(
            reverse("generate-ai-metadata"),
            {"asset_name": "Aurora launch"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)

    def test_svg_sanitizer_removes_unsafe_elements_and_attributes(self):
        from apps.ai.views import _sanitize_svg

        safe_svg = _sanitize_svg(
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script>'
            '<path d="M0 0 L20 20" onclick="alert(1)" fill="url(http://evil)" stroke="#123456"/></svg>'
        )

        self.assertNotIn("script", safe_svg)
        self.assertNotIn("onclick", safe_svg)
        self.assertNotIn("url(", safe_svg)
        self.assertIn("stroke", safe_svg)

    def test_provider_errors_have_actionable_diagnostics(self):
        from apps.ai.views import _provider_error_detail

        self.assertIn("API key", _provider_error_detail("AuthenticationError"))
        self.assertIn("billing", _provider_error_detail("RateLimitError"))
        self.assertIn("AI_MODEL", _provider_error_detail("NotFoundError"))
