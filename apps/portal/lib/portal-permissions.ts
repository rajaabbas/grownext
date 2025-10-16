import {
  DEFAULT_PORTAL_ROLE_PERMISSIONS,
  type PortalPermission,
  type PortalRolePermissions
} from "@ma/contracts";

export type { PortalPermission } from "@ma/contracts";

const normalizeRole = (role: string | null | undefined): string =>
  typeof role === "string" && role.length > 0 ? role.toUpperCase() : "MEMBER";

const buildPermissionMap = (
  overrides?: Array<Pick<PortalRolePermissions, "role" | "permissions">>
): Map<string, PortalPermission[]> => {
  const map = new Map<string, PortalPermission[]>();
  for (const [role, permissions] of Object.entries(DEFAULT_PORTAL_ROLE_PERMISSIONS)) {
    map.set(role.toUpperCase(), permissions.slice());
  }

  if (overrides) {
    for (const entry of overrides) {
      map.set(normalizeRole(entry.role), entry.permissions.slice());
    }
  }

  return map;
};

export const resolvePortalPermissions = (
  role: string | null | undefined,
  overrides?: Array<Pick<PortalRolePermissions, "role" | "permissions">>
): Set<PortalPermission> => {
  const map = buildPermissionMap(overrides);
  const normalized = normalizeRole(role);
  const fallback = map.get("MEMBER") ?? DEFAULT_PORTAL_ROLE_PERMISSIONS.MEMBER ?? [];
  const permissions = map.get(normalized) ?? fallback;
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
