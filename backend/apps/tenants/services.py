import uuid

from django.utils.text import slugify

from .models import Membership, Tenant


def ensure_user_workspace(user):
    """Create an initial workspace for legacy accounts without a membership."""
    active_membership = Membership.objects.filter(
        user=user,
        tenant_id=user.active_tenant_id,
        tenant__is_active=True,
    ).select_related("tenant").first()
    if active_membership:
        return active_membership.tenant

    membership = Membership.objects.filter(user=user, tenant__is_active=True).select_related("tenant").first()
    if membership:
        user.active_tenant = membership.tenant
        user.save(update_fields=["active_tenant"])
        return membership.tenant

    base_slug = slugify(user.username)[:60] or "workspace"
    tenant = Tenant.objects.create(
        name=f"{user.username}'s workspace",
        slug=f"{base_slug}-{uuid.uuid4().hex[:8]}",
        owner=user,
    )
    Membership.objects.create(tenant=tenant, user=user, role=Membership.Role.ADMIN)
    user.active_tenant = tenant
    user.save(update_fields=["active_tenant"])
    return tenant
