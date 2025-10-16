import { z } from "zod";

export const PortalPermissionSchema = z.enum([
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
] as const);

export type PortalPermission = z.infer<typeof PortalPermissionSchema>;

export const DEFAULT_PORTAL_ROLE_PERMISSIONS: Record<string, PortalPermission[]> = {
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
  MEMBER: ["organization:view", "members:view", "tenant:view", "identity:read", "permissions:view"]
};

export const PortalRolePermissionsSchema = z.object({
  role: z.string().min(1),
  permissions: z.array(PortalPermissionSchema),
  source: z.enum(["default", "custom"]).default("default")
});

export type PortalRolePermissions = z.infer<typeof PortalRolePermissionsSchema>;

export const PortalPermissionsResponseSchema = z.object({
  roles: z.array(PortalRolePermissionsSchema)
});

export const PortalPermissionsUpdateSchema = z.object({
  permissions: z.array(PortalPermissionSchema)
});
