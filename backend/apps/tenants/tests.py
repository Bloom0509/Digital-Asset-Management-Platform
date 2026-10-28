import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Membership, Tenant


class WorkspaceAccessTests(TestCase):
    def setUp(self):
        username = f"workspace-owner-{uuid.uuid4().hex[:8]}"
        self.owner = get_user_model().objects.create_user(username=username, password="StrongPass123")
        self.owner_client = APIClient()
        self.owner_client.force_authenticate(user=self.owner)
        self.asset_response = self.owner_client.post(
            "/api/assets/",
            {
                "name": "Workspace private image",
                "object_key": f"workspace/{uuid.uuid4().hex}.png",
                "content_type": "image/png",
            },
            format="json",
        )
        self.assertEqual(self.asset_response.status_code, 201, self.asset_response.content)
        self.asset_id = self.asset_response.json()["id"]
        self.tenant = self.owner.active_tenant

    def test_viewer_can_read_but_cannot_write_assets_or_collections(self):
        viewer = get_user_model().objects.create_user(
            username=f"workspace-viewer-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        Membership.objects.create(tenant=self.tenant, user=viewer, role=Membership.Role.VIEWER)
        viewer.active_tenant = self.tenant
        viewer.save(update_fields=["active_tenant"])
        client = APIClient()
        client.force_authenticate(user=viewer)

        self.assertEqual(client.get("/api/assets/").status_code, 200)
        self.assertEqual(len(client.get("/api/assets/").json()), 1)
        self.assertEqual(
            client.post("/api/collections/", {"name": "Forbidden"}, format="json").status_code,
            403,
        )
        self.assertEqual(client.delete(f"/api/assets/{self.asset_id}/").status_code, 403)

    def test_editor_cannot_permanently_delete_assets(self):
        editor = get_user_model().objects.create_user(
            username=f"workspace-editor-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        Membership.objects.create(tenant=self.tenant, user=editor, role=Membership.Role.EDITOR)
        editor.active_tenant = self.tenant
        editor.save(update_fields=["active_tenant"])
        client = APIClient()
        client.force_authenticate(user=editor)

        self.owner_client.delete(f"/api/assets/{self.asset_id}/")
        self.assertEqual(client.delete(f"/api/assets/{self.asset_id}/permanent-delete/").status_code, 403)

    def test_workspace_activity_is_isolated_by_active_tenant(self):
        self.assertEqual(self.owner_client.get("/api/tenants/activity/").status_code, 200)
        own_events = self.owner_client.get("/api/tenants/activity/").json()
        self.assertTrue(any("Workspace private image" in event["message"] for event in own_events))

        other_user = get_user_model().objects.create_user(
            username=f"other-workspace-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        other_tenant = Tenant.objects.create(
            name="Other workspace",
            slug=f"other-{uuid.uuid4().hex[:8]}",
            owner=other_user,
        )
        Membership.objects.create(tenant=other_tenant, user=other_user, role=Membership.Role.ADMIN)
        other_user.active_tenant = other_tenant
        other_user.save(update_fields=["active_tenant"])
        client = APIClient()
        client.force_authenticate(user=other_user)

        events = client.get("/api/tenants/activity/").json()
        self.assertEqual(events, [])
        self.assertEqual(client.get("/api/assets/").json(), [])

    def test_workspace_switch_rejects_non_members(self):
        outsider = get_user_model().objects.create_user(
            username=f"workspace-outsider-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        client = APIClient()
        client.force_authenticate(user=outsider)

        response = client.post(
            "/api/tenants/switch/",
            {"workspace_id": str(self.tenant.pk)},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_listing_workspaces_preserves_a_valid_active_workspace(self):
        second_workspace = Tenant.objects.create(
            name="Second workspace",
            slug=f"second-{uuid.uuid4().hex[:8]}",
            owner=self.owner,
        )
        Membership.objects.create(
            tenant=second_workspace,
            user=self.owner,
            role=Membership.Role.ADMIN,
        )
        self.owner.active_tenant = second_workspace
        self.owner.save(update_fields=["active_tenant"])

        response = self.owner_client.get("/api/tenants/")
        self.assertEqual(response.status_code, 200)
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.active_tenant_id, second_workspace.pk)

    def test_admin_can_list_add_update_and_remove_workspace_members(self):
        member = get_user_model().objects.create_user(
            username=f"member-{uuid.uuid4().hex[:8]}",
            email=f"member-{uuid.uuid4().hex[:8]}@example.com",
            password="StrongPass123",
        )

        listing = self.owner_client.get("/api/tenants/members/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.json()), 1)
        self.assertEqual(listing.json()[0]["role"], Membership.Role.ADMIN)

        created = self.owner_client.post(
            "/api/tenants/members/",
            {"identifier": member.username, "role": Membership.Role.VIEWER},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(created.json()["role"], Membership.Role.VIEWER)

        updated = self.owner_client.patch(
            f"/api/tenants/members/{created.json()['id']}/",
            {"role": Membership.Role.EDITOR},
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.content)
        self.assertEqual(updated.json()["role"], Membership.Role.EDITOR)

        removed = self.owner_client.delete(f"/api/tenants/members/{created.json()['id']}/")
        self.assertEqual(removed.status_code, 204)
        self.assertFalse(Membership.objects.filter(tenant=self.tenant, user=member).exists())

    def test_non_admin_cannot_manage_workspace_members(self):
        editor = get_user_model().objects.create_user(
            username=f"member-editor-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        Membership.objects.create(tenant=self.tenant, user=editor, role=Membership.Role.EDITOR)
        editor.active_tenant = self.tenant
        editor.save(update_fields=["active_tenant"])
        client = APIClient()
        client.force_authenticate(user=editor)

        self.assertEqual(client.get("/api/tenants/members/").status_code, 403)
        self.assertEqual(
            client.post(
                "/api/tenants/members/",
                {"identifier": self.owner.username, "role": Membership.Role.VIEWER},
                format="json",
            ).status_code,
            403,
        )

    def test_only_original_workspace_owner_can_manage_members(self):
        later_admin = get_user_model().objects.create_user(
            username=f"later-admin-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        Membership.objects.create(tenant=self.tenant, user=later_admin, role=Membership.Role.ADMIN)
        later_admin.active_tenant = self.tenant
        later_admin.save(update_fields=["active_tenant"])
        client = APIClient()
        client.force_authenticate(user=later_admin)

        self.assertEqual(client.get("/api/tenants/members/").status_code, 403)
        self.assertEqual(
            client.post(
                "/api/tenants/members/",
                {"identifier": self.owner.username, "role": Membership.Role.VIEWER},
                format="json",
            ).status_code,
            403,
        )

    def test_original_owner_can_promote_and_demote_other_admins(self):
        member = get_user_model().objects.create_user(
            username=f"promote-member-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        created = self.owner_client.post(
            "/api/tenants/members/",
            {"identifier": member.username, "role": Membership.Role.ADMIN},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(created.json()["role"], Membership.Role.ADMIN)
        self.assertFalse(created.json()["is_owner"])

        demoted = self.owner_client.patch(
            f"/api/tenants/members/{created.json()['id']}/",
            {"role": Membership.Role.EDITOR},
            format="json",
        )
        self.assertEqual(demoted.status_code, 200, demoted.content)
        self.assertEqual(demoted.json()["role"], Membership.Role.EDITOR)

    def test_original_owner_membership_cannot_be_demoted_or_removed(self):
        owner_membership = Membership.objects.get(tenant=self.tenant, user=self.owner)

        demoted = self.owner_client.patch(
            f"/api/tenants/members/{owner_membership.pk}/",
            {"role": Membership.Role.VIEWER},
            format="json",
        )
        removed = self.owner_client.delete(f"/api/tenants/members/{owner_membership.pk}/")

        self.assertEqual(demoted.status_code, 400)
        self.assertEqual(removed.status_code, 400)
        owner_membership.refresh_from_db()
        self.assertEqual(owner_membership.role, Membership.Role.ADMIN)

    def test_admin_cannot_remove_the_last_workspace_admin(self):
        admin_membership = Membership.objects.get(tenant=self.tenant, user=self.owner)

        response = self.owner_client.delete(f"/api/tenants/members/{admin_membership.pk}/")

        self.assertEqual(response.status_code, 400)
        self.assertTrue(Membership.objects.filter(pk=admin_membership.pk).exists())

    def test_admin_cannot_remove_their_own_active_membership(self):
        admin_membership = Membership.objects.get(tenant=self.tenant, user=self.owner)

        response = self.owner_client.delete(f"/api/tenants/members/{admin_membership.pk}/")

        self.assertEqual(response.status_code, 400)
        self.assertTrue(Membership.objects.filter(pk=admin_membership.pk).exists())

    def test_admin_cannot_manage_members_in_another_workspace(self):
        other_user = get_user_model().objects.create_user(
            username=f"other-owner-{uuid.uuid4().hex[:8]}", password="StrongPass123"
        )
        other_tenant = Tenant.objects.create(
            name="Other tenant",
            slug=f"other-tenant-{uuid.uuid4().hex[:8]}",
            owner=other_user,
        )
        other_membership = Membership.objects.create(
            tenant=other_tenant,
            user=other_user,
            role=Membership.Role.ADMIN,
        )

        response = self.owner_client.delete(f"/api/tenants/members/{other_membership.pk}/")

        self.assertEqual(response.status_code, 404)
        self.assertTrue(Membership.objects.filter(pk=other_membership.pk).exists())
