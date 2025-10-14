import type { Session } from "@supabase/supabase-js";
import { fetchTasksContext } from "@ma/identity-client";

const TASKS_PRODUCT_SLUG = process.env.TASKS_PRODUCT_SLUG ?? "tasks";

interface TasksAuthContext {
  organizationId: string;
  tenantId: string;
  roles: string[];
  userId: string;
}

export const getTasksAuthContext = async (session: Session): Promise<TasksAuthContext> => {
  const accessToken = session.access_token;

  if (!accessToken) {
    throw new Error("not_authenticated");
  }

  const context = await fetchTasksContext(accessToken, {
    productSlug: TASKS_PRODUCT_SLUG
  });

  return {
    organizationId: context.organization.id,
    tenantId: context.activeTenant.tenantId,
    roles: context.activeTenant.roles,
    userId: context.user.id
  };
};
