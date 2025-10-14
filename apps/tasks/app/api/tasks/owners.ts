import { fetchTasksUsers } from "@ma/identity-client";
import type { TasksUserSummary } from "@ma/contracts";
import type { TaskOwner } from "./serializer";

export const TASKS_PRODUCT_SLUG = process.env.TASKS_PRODUCT_SLUG ?? "tasks";

const toTaskOwner = (summary: TasksUserSummary): TaskOwner => ({
  id: summary.id,
  email: summary.email ?? null,
  fullName: summary.fullName ?? null
});

export const fetchOwnerMap = async (
  accessToken: string,
  userIds: string[],
  tenantId: string
): Promise<Map<string, TaskOwner>> => {
  const uniqueIds = Array.from(new Set(userIds));
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const response = await fetchTasksUsers(accessToken, {
    userIds: uniqueIds,
    productSlug: TASKS_PRODUCT_SLUG,
    tenantId
  });

  return new Map(response.users.map((user) => [user.id, toTaskOwner(user)]));
};

export const fetchOwner = async (
  accessToken: string,
  userId: string,
  tenantId: string
): Promise<TaskOwner | null> => {
  const owners = await fetchOwnerMap(accessToken, [userId], tenantId);
  return owners.get(userId) ?? null;
};
