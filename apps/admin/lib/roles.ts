import type { Session } from "@supabase/supabase-js";

export type AdminRole = "super-admin" | "support" | "auditor";

const canonicalRoleMap: Record<string, AdminRole> = {
  "super-admin": "super-admin",
  "super_admin": "super-admin",
  superadmin: "super-admin",
  "support": "support",
  "support-ops": "support",
  "auditor": "auditor",
  "audit": "auditor"
};

const addRoleFromValue = (roles: Set<AdminRole>, value: unknown) => {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      addRoleFromValue(roles, entry);
    }
    return;
  }

  if (typeof value === "string") {
    const normalized = canonicalRoleMap[value.toLowerCase()];
    if (normalized) {
      roles.add(normalized);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val === true) {
        const normalized = canonicalRoleMap[key.toLowerCase()];
        if (normalized) {
          roles.add(normalized);
        }
      }
    }
  }
};

export const extractAdminRoles = (session: Session | null): Set<AdminRole> => {
  const roles = new Set<AdminRole>();

  if (!session) {
    return roles;
  }

  const { user } = session;
  addRoleFromValue(roles, (user as { roles?: unknown }).roles);
  addRoleFromValue(roles, user.app_metadata?.roles);
  addRoleFromValue(roles, user.user_metadata?.roles);

  addRoleFromValue(roles, {
    super_admin: user.app_metadata?.super_admin,
    support: user.app_metadata?.support,
    auditor: user.app_metadata?.auditor
  });

  addRoleFromValue(roles, {
    super_admin: user.user_metadata?.super_admin,
    support: user.user_metadata?.support,
    auditor: user.user_metadata?.auditor
  });

  return roles;
};

export const hasRequiredAdminRole = (
  roles: Set<AdminRole>,
  allowed: readonly AdminRole[]
): boolean => {
  for (const role of allowed) {
    if (roles.has(role)) {
      return true;
    }
  }
  return false;
};
