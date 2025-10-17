import type { SupabaseJwtClaims } from "@ma/core";
import {
  buildTaskPermissionEvaluator,
  listPermissionPoliciesForUser,
  type TaskPermissionPolicy
} from "@ma/tasks-db";

export type TaskPermissionEvaluator = ReturnType<typeof buildTaskPermissionEvaluator>;

interface ResolvePermissionEvaluatorOptions {
  serviceClaims: SupabaseJwtClaims | null;
  tenantId: string;
  userId: string;
  roles: string[];
}

const fallbackEvaluator = (roles: string[], tenantId: string, userId: string) =>
  buildTaskPermissionEvaluator({ tenantId, userId, identityRoles: roles, policies: [] });

export const resolvePermissionEvaluator = async (
  options: ResolvePermissionEvaluatorOptions
): Promise<TaskPermissionEvaluator> => {
  try {
    const policies: TaskPermissionPolicy[] = await listPermissionPoliciesForUser(
      options.serviceClaims,
      options.tenantId,
      options.userId
    );

    return buildTaskPermissionEvaluator({
      tenantId: options.tenantId,
      userId: options.userId,
      identityRoles: options.roles,
      policies
    });
  } catch (error) {
    console.warn("Failed to resolve task permission policies", {
      tenantId: options.tenantId,
      userId: options.userId,
      error
    });
    return fallbackEvaluator(options.roles, options.tenantId, options.userId);
  }
};
