# Architecture

## Tenant isolation

Every tenant-owned model carries a `tenant_id` foreign key. API querysets must scope data through the authenticated user's active tenant before applying filters, pagination, or object lookup. Database constraints and service-layer checks provide defense in depth.

The frontend uses `/workspaces/:workspaceId` as the root for a workspace, with `/assets`, `/collections`, `/collections/:collectionId`, `/trash`, and `/activity` routes below it. A route workspace must be present in the authenticated user's membership list; the switch API then updates `User.active_tenant` before workspace data is requested. Every tenant data endpoint validates that the active tenant is still active and that the user has a membership in it.

Workspace roles are `admin`, `editor`, and `viewer`. All members may read workspace data; editors and admins may create or update assets and collections and move assets to/from trash; only admins may permanently delete assets. Workspace activity events are stored with a tenant foreign key and are returned only for the active workspace.

## Backend apps

- `accounts`: users, JWT authentication, roles, and permissions
- `tenants`: organizations and tenant membership
- `assets`: uploads, metadata, lifecycle, and access permissions
- `collections`: folders, collections, tags, and organization
- `search`: keyword, filtered, paginated, and semantic search
- `ai`: analysis, tagging, descriptions, embeddings, RAG, and agents

## Activity

Asset lifecycle changes, collection changes, workspace creation, and successful AI metadata generation are recorded as tenant-owned activity events. The activity API is `/api/tenants/activity/`; it is membership-protected and returns the most recent 100 events for the active tenant.
