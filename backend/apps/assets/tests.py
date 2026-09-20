from django.test import TestCase


class AssetAccessTests(TestCase):
    def test_get_assets_allows_anonymous_access_even_with_invalid_bearer_token(self):
        response = self.client.get(
            "/api/assets/",
            HTTP_AUTHORIZATION="Bearer invalid.token.here",
        )

        self.assertEqual(response.status_code, 200)
