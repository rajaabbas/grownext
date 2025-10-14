import type { TaskRecord } from "@ma/tasks-db";

export interface TaskOwner {
  id: string;
  email: string | null;
  fullName: string | null;
}

export interface SerializedTask {
  id: string;
  organizationId: string;
  tenantId: string;
  title: string;
  description: string | null;
  status: TaskRecord["status"];
  assignedToId: string | null;
  createdById: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  owner: TaskOwner;
}

const sanitizeFullName = (fullName: string | null | undefined): string | null => {
  if (typeof fullName !== "string") {
    return null;
  }
  const trimmed = fullName.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ensureOwner = (userId: string, owner?: TaskOwner | null): TaskOwner => ({
  id: userId,
  email: owner?.email ?? null,
  fullName: sanitizeFullName(owner?.fullName)
});

export const transformTask = (task: TaskRecord, owner?: TaskOwner | null): SerializedTask => ({
  id: task.id,
  organizationId: task.organizationId,
  tenantId: task.tenantId,
  title: task.title,
  description: task.description,
  status: task.status,
  assignedToId: task.assignedToId ?? null,
  createdById: task.createdById,
  dueDate: task.dueDate?.toISOString() ?? null,
  completedAt: task.completedAt?.toISOString() ?? null,
  createdAt: task.createdAt.toISOString(),
  owner: ensureOwner(task.createdById, owner)
});
