from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient


class AccountRegistrationTests(TestCase):
    def test_register_user_endpoint_creates_account(self):
        response = self.client.post(
            "/api/accounts/register/",
            {
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "StrongPass123",
                "first_name": "New",
                "last_name": "User",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["user"]["username"] == "newuser")

    def test_current_user_endpoint_requires_authentication(self):
        response = self.client.get("/api/accounts/me/")

        self.assertEqual(response.status_code, 401)

    def test_current_user_endpoint_returns_authenticated_user(self):
        user = get_user_model().objects.create_user(username="signedin", password="StrongPass123")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/accounts/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], "signedin")
