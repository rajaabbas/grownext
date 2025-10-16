import type { PortalPermission } from "@ma/contracts";

export type PermissionScope = "organization" | "members" | "tenant" | "identity" | "permissions";

export interface PermissionCatalogEntry {
  label: string;
  value: PortalPermission;
  description: string;
}

export const permissionCatalog: Record<PermissionScope, PermissionCatalogEntry[]> = {
  organization: [
    {
      label: "View organization profile",
      value: "organization:view",
      description: "Access organization settings and high-level details."
    },
    {
      label: "Manage organization profile",
      value: "organization:update",
      description: "Rename the organization and update metadata."
    },
    {
      label: "Manage billing & plans",
      value: "organization:billing",
      description: "Upgrade plans and manage billing contacts."
    },
    {
      label: "Delete organization",
      value: "organization:delete",
      description: "Permanently delete the organization and all tenants."
    }
  ],
  members: [
    {
      label: "View organization members",
      value: "members:view",
      description: "See the member directory and role assignments."
    },
    {
      label: "Invite new members",
      value: "members:invite",
      description: "Send invitations and approve join requests."
    },
    {
      label: "Edit or remove members",
      value: "members:manage",
      description: "Change member roles or remove users from the organization."
    }
  ],
  tenant: [
    {
      label: "View tenants",
      value: "tenant:view",
      description: "Access tenant dashboards and metadata in read-only mode."
    },
    {
      label: "Create new tenants",
      value: "tenant:create",
      description: "Provision new tenant workspaces inside the organization."
    },
    {
      label: "Manage tenant settings",
      value: "tenant:update",
      description: "Rename tenants and adjust tenant metadata."
    },
    {
      label: "Manage tenant membership",
      value: "tenant:members",
      description: "Add or remove members from specific tenants."
    },
    {
      label: "Enable tenant applications",
      value: "tenant:apps",
      description: "Link products and applications to tenants."
    }
  ],
  identity: [
    {
      label: "View identity configuration",
      value: "identity:read",
      description: "View identity issuer, JWKS and OAuth configuration."
    },
    {
      label: "Manage identity providers",
      value: "identity:providers",
      description: "Configure external IdP connections and credentials."
    },
    {
      label: "Access audit events",
      value: "identity:audit",
      description: "Review authentication and authorization audit feeds."
    }
  ],
  permissions: [
    {
      label: "View role definitions",
      value: "permissions:view",
      description: "Open the permissions catalog and review role capabilities."
    },
    {
      label: "Modify role permissions",
      value: "permissions:modify",
      description: "Create, edit, or delete roles and their permission sets."
    }
  ]
};

const scopeLookup = new Map<PortalPermission, PermissionScope>();
for (const [scope, entries] of Object.entries(permissionCatalog) as [PermissionScope, PermissionCatalogEntry[]][]) {
  for (const entry of entries) {
    scopeLookup.set(entry.value, scope);
  }
}

export const resolvePermissionScope = (permission: PortalPermission): PermissionScope =>
  scopeLookup.get(permission) ?? "permissions";

export const partitionPermissionsByScope = (
  permissions: PortalPermission[]
): Record<PermissionScope, PortalPermission[]> => {
  const result: Record<PermissionScope, PortalPermission[]> = {
    organization: [],
    members: [],
    tenant: [],
    identity: [],
    permissions: []
  };

  for (const permission of permissions) {
    const scope = resolvePermissionScope(permission);
    result[scope].push(permission);
  }

  for (const scope of Object.keys(result) as PermissionScope[]) {
    result[scope] = Array.from(new Set(result[scope])).sort();
  }

  return result;
};
