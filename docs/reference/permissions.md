# Permissions Reference

Portal access control is driven by the `PortalPermission` enum defined in `@ma/contracts`. Permissions are grouped into scopes that align with major areas of the administration experience. This document mirrors `apps/portal/lib/portal-permission-catalog.ts`.

| Scope | Permission | Description |
| --- | --- | --- |
| organization | `organization:view` | Access organization settings and high-level details. |
|  | `organization:update` | Rename the organization and update metadata. |
|  | `organization:billing` | Manage billing plans and contacts. |
|  | `organization:delete` | Permanently delete the organization and all tenants. |
| members | `members:view` | See the member directory and role assignments. |
|  | `members:invite` | Send invitations and approve join requests. |
|  | `members:manage` | Edit roles or remove members. |
| tenant | `tenant:view` | Access tenant dashboards and metadata in read-only mode. |
|  | `tenant:create` | Provision new tenants inside the organization. |
|  | `tenant:update` | Rename tenants and adjust metadata. |
|  | `tenant:members` | Manage membership for specific tenants. |
|  | `tenant:apps` | Enable or disable applications per tenant. |
| identity | `identity:read` | View identity issuer, JWKS, and OAuth configuration. |
|  | `identity:providers` | Configure external identity providers (SAML/OIDC). |
|  | `identity:audit` | Review authentication and authorization audit logs. |
| permissions | `permissions:view` | View role definitions in the portal. |
|  | `permissions:modify` | Create, edit, or delete roles and their permission sets. |

## Default Role Map

| Role | Scope Coverage | Notes |
| --- | --- | --- |
| `OWNER` | All permissions | Full control over organization and identity settings. |
| `ADMIN` | All except `organization:delete` | Cannot delete the organization. |
| `MANAGER` | Organization view, member management, all tenant permissions, identity read/audit, permissions view | Designed for trusted collaborators managing tenants and members. |
| `MEMBER` | Organization view, members view, tenant view, identity read, permissions view | Read-mostly access across the portal. |

Custom roles can be created via the portal UI. The role editor uses the same catalog above—after toggling permissions, the changes are persisted through the identity service (`/api/permissions`).

## Tasks Entitlements

The Tasks application relies on product entitlements stored in the identity database:

| Entitlement Role | Typical Usage |
| --- | --- |
| `OWNER` | Full product admin rights; can change project permissions. |
| `ADMIN` | Manage tasks, projects, and members within assigned tenants. |
| `EDITOR` | Create and update tasks/projects but cannot modify tenant-level permissions. |
| `VIEWER` | Read-only access. |
| `CONTRIBUTOR` | Limited write access (comments, status updates). |

Entitlements are resolved via `/internal/tasks/context` and exposed to front-end clients through `@ma/identity-client`.
