import { randomUUID } from "node:crypto";
import type { SupabaseJwtClaims } from "@ma/core";
import type { Task, TaskStatus } from "../generated/client";
import { withAuthorizationTransaction } from "./prisma";

interface CreateTaskInput {
  organizationId: string;
  tenantId: string;
  title: string;
  description?: string | null;
  createdById: string;
  assignedToId?: string | null;
  dueDate?: Date | null;
}

interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  assignedToId?: string | null;
  dueDate?: Date | null;
}

export const createTask = async (
  claims: SupabaseJwtClaims | null,
  input: CreateTaskInput
): Promise<Task> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.task.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        tenantId: input.tenantId,
        title: input.title,
        description: input.description ?? null,
        createdById: input.createdById,
        assignedToId: input.assignedToId ?? null,
        dueDate: input.dueDate ?? null
      }
    })
  );
};

export const listTasksForTenant = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string
): Promise<Task[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.task.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    })
  );
};

export const updateTask = async (
  claims: SupabaseJwtClaims | null,
  taskId: string,
  tenantId: string,
  updates: UpdateTaskInput
): Promise<Task> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const existing = await tx.task.findUnique({ where: { id: taskId } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error("task_not_found");
    }

    return tx.task.update({
      where: { id: taskId },
      data: {
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.assignedToId !== undefined ? { assignedToId: updates.assignedToId } : {}),
        ...(updates.dueDate !== undefined ? { dueDate: updates.dueDate } : {})
      }
    });
  });
};

export const setTaskStatus = async (
  claims: SupabaseJwtClaims | null,
  taskId: string,
  tenantId: string,
  status: TaskStatus
): Promise<Task> => {
  const completedAt = status === "COMPLETED" ? new Date() : null;

  return withAuthorizationTransaction(claims, async (tx) => {
    const existing = await tx.task.findUnique({ where: { id: taskId } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error("task_not_found");
    }

    return tx.task.update({
      where: { id: taskId },
      data: {
        status,
        completedAt
      }
    });
  });
};

export const deleteTask = async (
  claims: SupabaseJwtClaims | null,
  taskId: string,
  tenantId: string
): Promise<void> => {
  await withAuthorizationTransaction(claims, async (tx) => {
    const existing = await tx.task.findUnique({ where: { id: taskId } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error("task_not_found");
    }

    await tx.task.delete({ where: { id: taskId } });
  });
};

export const deleteTasksForTenant = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string
): Promise<void> => {
  await withAuthorizationTransaction(claims, (tx) =>
    tx.task.deleteMany({
      where: { tenantId }
    })
  );
};

export type TaskRecord = Task;
