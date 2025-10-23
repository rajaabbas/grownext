import { logger } from "@ma/core";
import { emitBillingUsageEvents } from "@ma/identity-client";
import type { BillingUsageEventInput } from "@ma/contracts";

interface TaskUsageContext {
  accessToken: string;
  organizationId: string;
  tenantId: string;
  productId: string;
}

interface TaskCreationUsagePayload {
  id: string;
  createdAt: Date;
  projectId: string | null;
  assignedToId: string | null;
  createdById: string;
}

interface CommentUsageEventPayload {
  id: string;
  createdAt: Date;
  taskId: string;
  createdById: string;
}

const toEventMetadata = (metadata: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );

const emitEvents = async (accessToken: string, events: BillingUsageEventInput[]) => {
  try {
    await emitBillingUsageEvents(accessToken, events);
  } catch (error) {
    logger.error(
      { error, events: events.map((event) => event.featureKey) },
      "Failed to emit billing usage events from Tasks"
    );
  }
};

export const emitTaskCreatedUsage = async (
  context: TaskUsageContext,
  task: TaskCreationUsagePayload
) => {
  const event: BillingUsageEventInput = {
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    productId: context.productId,
    featureKey: "tasks.created",
    quantity: 1,
    unit: "task",
    recordedAt: task.createdAt,
    source: "TASKS",
    metadata: toEventMetadata({
      taskId: task.id,
      projectId: task.projectId,
      assignedToId: task.assignedToId,
      createdById: task.createdById
    }),
    fingerprint: `task.created:${task.id}`
  };

  await emitEvents(context.accessToken, [event]);
};

export const emitTaskCommentUsage = async (
  context: TaskUsageContext,
  comment: CommentUsageEventPayload
) => {
  const event: BillingUsageEventInput = {
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    productId: context.productId,
    featureKey: "tasks.comments",
    quantity: 1,
    unit: "comment",
    recordedAt: comment.createdAt,
    source: "TASKS",
    metadata: toEventMetadata({
      commentId: comment.id,
      taskId: comment.taskId,
      createdById: comment.createdById
    }),
    fingerprint: `task.comment:${comment.id}`
  };

  await emitEvents(context.accessToken, [event]);
};
