from django.test import TestCase


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
