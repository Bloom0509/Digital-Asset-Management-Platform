from django.urls import path

from .views import WorkspaceActivityListView, WorkspaceCreateView, WorkspaceMemberDetailView, WorkspaceMemberListCreateView, WorkspaceMembershipListView, WorkspaceSwitchView

urlpatterns = [
    path("", WorkspaceMembershipListView.as_view(), name="tenant-list"),
    path("create/", WorkspaceCreateView.as_view(), name="tenant-create"),
    path("switch/", WorkspaceSwitchView.as_view(), name="tenant-switch"),
    path("activity/", WorkspaceActivityListView.as_view(), name="tenant-activity"),
    path("members/", WorkspaceMemberListCreateView.as_view(), name="tenant-members"),
    path("members/<int:membership_id>/", WorkspaceMemberDetailView.as_view(), name="tenant-member-detail"),
]
