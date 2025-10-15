export type PortalPermission =
  | "organization:view"
  | "organization:update"
  | "organization:billing"
  | "organization:delete"
  | "members:view"
  | "members:invite"
  | "members:manage"
  | "tenant:view"
  | "tenant:create"
  | "tenant:update"
  | "tenant:members"
  | "tenant:apps"
  | "identity:read"
  | "identity:providers"
  | "identity:audit"
  | "permissions:view"
  | "permissions:modify";

const rolePermissions: Record<string, PortalPermission[]> = {
  OWNER: [
    "organization:view",
    "organization:update",
    "organization:billing",
    "organization:delete",
    "members:view",
    "members:invite",
    "members:manage",
    "tenant:view",
    "tenant:create",
    "tenant:update",
    "tenant:members",
    "tenant:apps",
    "identity:read",
    "identity:providers",
    "identity:audit",
    "permissions:view",
    "permissions:modify"
  ],
  ADMIN: [
    "organization:view",
    "organization:update",
    "organization:billing",
    "members:view",
    "members:invite",
    "members:manage",
    "tenant:view",
    "tenant:create",
    "tenant:update",
    "tenant:members",
    "tenant:apps",
    "identity:read",
    "identity:providers",
    "identity:audit",
    "permissions:view",
    "permissions:modify"
  ],
  MANAGER: [
    "organization:view",
    "members:view",
    "members:invite",
    "members:manage",
    "tenant:view",
    "tenant:create",
    "tenant:update",
    "tenant:members",
    "tenant:apps",
    "identity:read",
    "identity:audit",
    "permissions:view"
  ],
  MEMBER: [
    "organization:view",
    "members:view",
    "tenant:view",
    "identity:read"
  ]
};

export const resolvePortalPermissions = (role: string | null | undefined): Set<PortalPermission> => {
  const normalized = role ? role.toUpperCase() : "";
  const permissions = rolePermissions[normalized] ?? rolePermissions.MEMBER;
  return new Set(permissions);
};

export const hasPortalPermission = (
  permissions: Set<PortalPermission>,
  permission: PortalPermission
): boolean => permissions.has(permission);

export const hasEveryPortalPermission = (
  permissions: Set<PortalPermission>,
  required: PortalPermission[]
): boolean => required.every((permission) => permissions.has(permission));
