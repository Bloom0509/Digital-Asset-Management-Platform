from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .activity import record_activity
from .models import ActivityEvent, Membership, Tenant
from .permissions import WorkspaceRolePermission
from .serializers import TenantCreateSerializer, TenantSwitchSerializer
from .services import ensure_user_workspace

class WorkspaceMembershipListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        ensure_user_workspace(request.user)
        memberships = Membership.objects.select_related("tenant", "user").filter(
            user=request.user,
            tenant__is_active=True,
        )
        data = [
            {
                "id": membership.tenant_id,
                "name": membership.tenant.name,
                "slug": membership.tenant.slug,
                "role": membership.role,
            }
            for membership in memberships
        ]
        return Response(data)


class WorkspaceCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TenantCreateSerializer

    def perform_create(self, serializer):
        tenant = serializer.save(owner=self.request.user)
        Membership.objects.get_or_create(
            tenant=tenant,
            user=self.request.user,
            defaults={"role": Membership.Role.ADMIN},
        )
        self.request.user.active_tenant = tenant
        self.request.user.save(update_fields=["active_tenant"])
        record_activity(tenant, self.request.user, f'Created workspace “{tenant.name}”.')


class WorkspaceSwitchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = TenantSwitchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        workspace_id = serializer.validated_data["workspace_id"]
        membership = Membership.objects.select_related("tenant").filter(
            user=request.user,
            tenant_id=workspace_id,
            tenant__is_active=True,
        ).first()
        if membership is None:
            return Response({"detail": "You do not belong to this workspace."}, status=status.HTTP_403_FORBIDDEN)

        request.user.active_tenant = membership.tenant
        request.user.save(update_fields=["active_tenant"])

        return Response(
            {
                "id": str(membership.tenant_id),
                "name": membership.tenant.name,
                "slug": membership.tenant.slug,
                "role": membership.role,
            }
        )


class WorkspaceActivityListView(APIView):
    permission_classes = [WorkspaceRolePermission]

    def get(self, request):
        events = ActivityEvent.objects.filter(tenant_id=request.user.active_tenant_id).select_related("actor")[:100]
        return Response([
            {
                "id": event.pk,
                "message": event.message,
                "type": event.event_type,
                "actor": event.actor.get_username() if event.actor else None,
                "timestamp": event.created_at,
            }
            for event in events
        ])
