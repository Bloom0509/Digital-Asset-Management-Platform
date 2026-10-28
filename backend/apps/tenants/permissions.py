from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Membership
from .services import ensure_user_workspace


class WorkspaceRolePermission(BasePermission):
    """Require active workspace membership and apply role-based write access."""

    message = "You do not have permission to perform this action in the active workspace."

    def has_permission(self, request, view):
        user = request.user
        tenant_id = getattr(user, "active_tenant_id", None)
        if not user or not user.is_authenticated:
            return False
        if not tenant_id:
            tenant_id = ensure_user_workspace(user).pk

        membership = Membership.objects.filter(
            tenant_id=tenant_id,
            tenant__is_active=True,
            user_id=user.pk,
        ).only("role").first()
        if membership is None:
            return False
        request.workspace_membership = membership

        if request.method in SAFE_METHODS:
            return True

        action = getattr(view, "action", None)
        if action == "permanent_delete":
            return membership.role == Membership.Role.ADMIN
        return membership.role in (Membership.Role.ADMIN, Membership.Role.EDITOR)

    def has_object_permission(self, request, view, obj):
        tenant_id = getattr(request.user, "active_tenant_id", None)
        if getattr(obj, "tenant_id", tenant_id) != tenant_id:
            return False
        if request.method in SAFE_METHODS:
            return True
        action = getattr(view, "action", None)
        role = getattr(getattr(request, "workspace_membership", None), "role", None)
        if action == "permanent_delete":
            return role == Membership.Role.ADMIN
        return role in (Membership.Role.ADMIN, Membership.Role.EDITOR)


class WorkspaceAdminPermission(BasePermission):
    """Allow access only to admins of the authenticated user's active workspace."""

    message = "Only workspace admins can manage members."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        membership = Membership.objects.filter(
            tenant_id=getattr(request.user, "active_tenant_id", None),
            tenant__is_active=True,
            user_id=request.user.pk,
        ).first()
        if membership is None or membership.tenant.owner_id != request.user.pk:
            return False
        request.workspace_membership = membership
        return True
