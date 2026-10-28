from rest_framework import generics, permissions, status
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.response import Response
from rest_framework.views import APIView

from .activity import record_activity
from .models import ActivityEvent, Membership, Tenant
from .permissions import WorkspaceAdminPermission, WorkspaceRolePermission
from .serializers import TenantCreateSerializer, TenantSwitchSerializer, WorkspaceMemberCreateSerializer, WorkspaceMemberRoleSerializer
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
                "owner_id": str(membership.tenant.owner_id) if membership.tenant.owner_id else None,
                "is_owner": membership.tenant.owner_id == request.user.pk,
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
                "owner_id": str(membership.tenant.owner_id) if membership.tenant.owner_id else None,
                "is_owner": membership.tenant.owner_id == request.user.pk,
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


class WorkspaceMemberListCreateView(APIView):
    permission_classes = [WorkspaceAdminPermission]

    def get(self, request):
        memberships = Membership.objects.filter(
            tenant_id=request.user.active_tenant_id,
            tenant__is_active=True,
        ).select_related("user").order_by("user__username")
        return Response([
            {
                "id": membership.pk,
                "user_id": membership.user_id,
                "username": membership.user.get_username(),
                "email": membership.user.email,
                "role": membership.role,
                "is_owner": membership.tenant.owner_id == membership.user_id,
            }
            for membership in memberships
        ])

    def post(self, request):
        serializer = WorkspaceMemberCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"]
        user_model = get_user_model()
        user = user_model.objects.filter(username__iexact=identifier).first()
        if user is None:
            user = user_model.objects.filter(email__iexact=identifier).first()
        if user is None:
            return Response({"detail": "No account was found with that username or email."}, status=status.HTTP_404_NOT_FOUND)
        if user.pk == request.user.active_tenant.owner_id:
            return Response({"detail": "The workspace owner is already a member."}, status=status.HTTP_409_CONFLICT)

        membership, created = Membership.objects.get_or_create(
            tenant_id=request.user.active_tenant_id,
            user=user,
            defaults={"role": serializer.validated_data["role"]},
        )
        if not created:
            return Response({"detail": "This user is already a member of the workspace."}, status=status.HTTP_409_CONFLICT)

        record_activity(
            request.user.active_tenant,
            request.user,
            f'Added {user.get_username()} to the workspace as {membership.role}.',
        )
        return Response({
            "id": membership.pk,
            "user_id": user.pk,
            "username": user.get_username(),
            "email": user.email,
            "role": membership.role,
            "is_owner": False,
        }, status=status.HTTP_201_CREATED)


class WorkspaceMemberDetailView(APIView):
    permission_classes = [WorkspaceAdminPermission]

    def patch(self, request, membership_id):
        serializer = WorkspaceMemberRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = Membership.objects.filter(
            tenant_id=request.user.active_tenant_id,
            pk=membership_id,
        ).select_related("user").first()
        if membership is None:
            return Response({"detail": "Workspace member not found."}, status=status.HTTP_404_NOT_FOUND)
        if membership.user_id == request.user.active_tenant.owner_id:
            return Response({"detail": "The original workspace owner cannot be demoted."}, status=status.HTTP_400_BAD_REQUEST)
        if membership.role == Membership.Role.ADMIN and serializer.validated_data["role"] != Membership.Role.ADMIN:
            admin_count = Membership.objects.filter(
                tenant_id=request.user.active_tenant_id,
                role=Membership.Role.ADMIN,
            ).count()
            if admin_count <= 1:
                return Response({"detail": "The last workspace admin cannot be demoted."}, status=status.HTTP_400_BAD_REQUEST)

        membership.role = serializer.validated_data["role"]
        membership.save(update_fields=["role"])
        record_activity(
            request.user.active_tenant,
            request.user,
            f'Changed {membership.user.get_username()} role to {membership.role}.',
        )
        return Response({
            "id": membership.pk,
            "user_id": membership.user_id,
            "username": membership.user.get_username(),
            "email": membership.user.email,
            "role": membership.role,
            "is_owner": False,
        })

    def delete(self, request, membership_id):
        with transaction.atomic():
            Tenant.objects.select_for_update().get(pk=request.user.active_tenant_id)
            membership = Membership.objects.select_for_update().filter(
                tenant_id=request.user.active_tenant_id,
                pk=membership_id,
            ).select_related("user").first()
            if membership is None:
                return Response({"detail": "Workspace member not found."}, status=status.HTTP_404_NOT_FOUND)
            if membership.user_id == request.user.pk:
                return Response({"detail": "You cannot remove your own membership from the active workspace."}, status=status.HTTP_400_BAD_REQUEST)
            if membership.user_id == request.user.active_tenant.owner_id:
                return Response({"detail": "The original workspace owner cannot be removed."}, status=status.HTTP_400_BAD_REQUEST)
            if membership.role == Membership.Role.ADMIN:
                admin_count = Membership.objects.filter(
                    tenant_id=request.user.active_tenant_id,
                    role=Membership.Role.ADMIN,
                ).count()
                if admin_count <= 1:
                    return Response({"detail": "The last workspace admin cannot be removed."}, status=status.HTTP_400_BAD_REQUEST)

            username = membership.user.get_username()
            membership.delete()
            record_activity(request.user.active_tenant, request.user, f'Removed {username} from the workspace.')
        return Response(status=status.HTTP_204_NO_CONTENT)
