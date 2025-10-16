import { DEFAULT_PORTAL_ROLE_PERMISSIONS, PortalPermissionSchema, type PortalPermission } from "@ma/contracts";
import type { SupabaseJwtClaims } from "@ma/core";
import { withAuthorizationTransaction } from "./prisma";

const sanitizeRole = (role: string): string => role.trim().toUpperCase();

const sanitizePermissions = (values: string[]): PortalPermission[] => {
  const set = new Set<PortalPermission>();
  for (const value of values) {
    const parsed = PortalPermissionSchema.safeParse(value);
    if (parsed.success) {
      set.add(parsed.data);
    }
  }
  return Array.from(set).sort();
};

const permissionsEqual = (a: PortalPermission[], b: PortalPermission[]): boolean => {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
};

export interface PortalRolePermissionsRecord {
  organizationId: string;
  role: string;
  permissions: PortalPermission[];
  source: "default" | "custom";
}

const buildDefaultMap = (): Map<string, PortalPermission[]> => {
  return new Map(Object.entries(DEFAULT_PORTAL_ROLE_PERMISSIONS).map(([role, permissions]) => [
    sanitizeRole(role),
    permissions.slice().sort()
  ]));
};

export const listPortalRolePermissionsForOrganization = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<PortalRolePermissionsRecord[]> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const defaults = buildDefaultMap();
    const custom = await tx.portalRolePermission.findMany({
      where: { organizationId },
      select: {
        role: true,
        permissions: true
      },
      orderBy: { role: "asc" }
    });

    for (const entry of custom) {
      const role = sanitizeRole(entry.role);
      const permissions = sanitizePermissions(entry.permissions ?? []);
      defaults.set(role, permissions);
    }

    const results: PortalRolePermissionsRecord[] = [];

    for (const [role, permissions] of defaults.entries()) {
      const defaultPermissions = DEFAULT_PORTAL_ROLE_PERMISSIONS[sanitizeRole(role)] ?? [];
      const source = custom.some((item) => sanitizeRole(item.role) === role) ? "custom" : "default";
      const resolvedPermissions =
        source === "custom" ? permissions : sanitizePermissions(defaultPermissions);
      results.push({
        organizationId,
        role,
        permissions: resolvedPermissions,
        source
      });
    }

    for (const entry of custom) {
      const role = sanitizeRole(entry.role);
      if (!defaults.has(role)) {
        results.push({
          organizationId,
          role,
          permissions: sanitizePermissions(entry.permissions ?? []),
          source: "custom"
        });
      }
    }

    return results.sort((a, b) => a.role.localeCompare(b.role));
  });
};

export const getEffectivePortalPermissionsForOrganization = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<Map<string, PortalPermission[]>> => {
  const records = await listPortalRolePermissionsForOrganization(claims, organizationId);
  const map = new Map<string, PortalPermission[]>();
  for (const record of records) {
    map.set(sanitizeRole(record.role), record.permissions.slice());
  }
  return map;
};

export const savePortalRolePermissions = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string,
  input: { role: string; permissions: string[] }
): Promise<PortalRolePermissionsRecord> => {
  const role = sanitizeRole(input.role);
  const permissions = sanitizePermissions(input.permissions);
  const defaultPermissions = sanitizePermissions(
    DEFAULT_PORTAL_ROLE_PERMISSIONS[role] ?? DEFAULT_PORTAL_ROLE_PERMISSIONS.MEMBER ?? []
  );

  return withAuthorizationTransaction(claims, async (tx) => {
    if (permissionsEqual(permissions, defaultPermissions)) {
      await tx.portalRolePermission
        .delete({
          where: {
            organizationId_role: {
              organizationId,
              role
            }
          }
        })
        .catch(() => undefined);
      return {
        organizationId,
        role,
        permissions: defaultPermissions,
        source: "default"
      };
    }

    const updated = await tx.portalRolePermission.upsert({
      where: {
        organizationId_role: {
          organizationId,
          role
        }
      },
      create: {
        organizationId,
        role,
        permissions
      },
      update: {
        permissions
      }
    });

    return {
      organizationId,
      role,
      permissions: sanitizePermissions(updated.permissions ?? []),
      source: "custom"
    };
  });
};
