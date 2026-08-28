# Architecture

## Tenant isolation

Every tenant-owned model carries a `tenant_id` foreign key. API querysets must scope data through the authenticated user's active tenant before applying filters, pagination, or object lookup. Database constraints and service-layer checks provide defense in depth.

## Backend apps

- `accounts`: users, JWT authentication, roles, and permissions
- `tenants`: organizations and tenant membership
- `assets`: uploads, metadata, lifecycle, and access permissions
- `collections`: folders, collections, tags, and organization
- `search`: keyword, filtered, paginated, and semantic search
- `ai`: analysis, tagging, descriptions, embeddings, RAG, and agents
