import { randomUUID } from "node:crypto";
import type { SupabaseJwtClaims } from "@ma/core";
import {
  Prisma,
  TaskPriority as TaskPriorityEnum,
  TaskStatus as TaskStatusEnum,
  TaskVisibility as TaskVisibilityEnum,
  type Project,
  type Task,
  type TaskComment,
  type TaskFollower,
  type TaskPermissionPolicy,
  type TaskPriority,
  type TaskStatus,
  type TaskVisibility,
  type TaskSubtask
} from "../generated/client";
import { withAuthorizationTransaction, type PrismaTransaction } from "./prisma";

export type TaskRecord = Task;
export type ProjectRecord = Project;
export type TaskSubtaskRecord = TaskSubtask;
export type TaskCommentRecord = TaskComment;
export type TaskFollowerRecord = TaskFollower;
export type TaskPermissionPolicyRecord = TaskPermissionPolicy;

export interface CreateTaskInput {
  organizationId: string;
  tenantId: string;
  projectId?: string | null;
  title: string;
  description?: string | null;
  createdById: string;
  assignedToId?: string | null;
  dueDate?: Date | null;
  priority?: TaskPriority;
  followerIds?: string[];
  visibility?: TaskVisibility;
  sortOrder?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  projectId?: string | null;
  assignedToId?: string | null;
  dueDate?: Date | null;
  priority?: TaskPriority;
  visibility?: TaskVisibility;
  sortOrder?: number | null;
}

export interface SetTaskStatusOptions {
  sortOrder?: number;
}

export interface ListTasksForTenantOptions {
  projectId?: string | null;
  statuses?: TaskStatus[];
  assignedToId?: string;
  includeArchived?: boolean;
  search?: string;
  limit?: number;
  includeSubtasks?: boolean;
  includeComments?: boolean;
  includeFollowers?: boolean;
  orderBy?: "createdAt" | "priority" | "board";
}

export interface ListMyTasksOptions {
  userId: string;
  includeCreated?: boolean;
  includeAssigned?: boolean;
  includeCompleted?: boolean;
  includeFollowers?: boolean;
}

export interface CreateSubtaskInput {
  title: string;
  createdById: string;
  isCompleted?: boolean;
}

export interface UpdateSubtaskInput {
  title?: string;
  isCompleted?: boolean;
}

export interface CreateCommentInput {
  body: string;
  createdById: string;
}

export interface UpdateCommentInput {
  body: string;
}

export interface CreateProjectInput {
  organizationId: string;
  tenantId: string;
  name: string;
  description?: string | null;
  color?: string | null;
  createdById: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  color?: string | null;
  archivedAt?: Date | null;
}

export interface ProjectSummary {
  projectId: string | null;
  name: string;
  openCount: number;
  overdueCount: number;
  completedCount: number;
  scope: "all" | "project" | "unassigned";
}

export type TaskPermissionAction = "view" | "create" | "edit" | "comment" | "assign" | "manage";

export interface BuildPermissionEvaluatorOptions {
  tenantId: string;
  userId: string;
  identityRoles: string[];
  policies: Pick<TaskPermissionPolicy, "projectId" | "canAssign" | "canComment" | "canEdit" | "canManage">[];
}

export interface TaskPermissionPolicyInput {
  tenantId: string;
  projectId?: string | null;
  userId: string;
  canManage?: boolean;
  canEdit?: boolean;
  canComment?: boolean;
  canAssign?: boolean;
}

export interface TaskPermissionPolicyFilter {
  tenantId: string;
  projectId?: string | null;
}

export type TaskWithRelations = Task & {
  project?: Project | null;
  subtasks: TaskSubtask[];
  comments: TaskComment[];
  followers: TaskFollower[];
  _count?: {
    subtasks: number;
    comments: number;
    followers: number;
  };
};

const normalizeProjectId = (projectId?: string | null): string | null => {
  if (projectId === undefined) {
    return null;
  }
  return projectId;
};

const ensureProjectForTenant = async (
  tx: PrismaTransaction,
  projectId: string,
  tenantId: string,
  organizationId: string
): Promise<Project> => {
  const project = await tx.project.findUnique({ where: { id: projectId } });
  if (!project || project.tenantId !== tenantId || project.organizationId !== organizationId) {
    throw new Error("project_not_found");
  }
  return project;
};

const getTaskForTenantOrThrow = async (
  tx: PrismaTransaction,
  taskId: string,
  tenantId: string
): Promise<Task> => {
  const task = await tx.task.findUnique({ where: { id: taskId } });
  if (!task || task.tenantId !== tenantId) {
    throw new Error("task_not_found");
  }
  return task;
};

const getTaskWithRelationsById = async (
  tx: PrismaTransaction,
  taskId: string
): Promise<TaskWithRelations | null> => {
  return tx.task.findUnique({
    where: { id: taskId },
    include: {
      project: true,
      subtasks: {
        orderBy: { createdAt: "asc" }
      },
      comments: {
        orderBy: { createdAt: "asc" }
      },
      followers: true,
      _count: {
        select: {
          subtasks: true,
          comments: true,
          followers: true
        }
      }
    }
  }) as Promise<TaskWithRelations | null>;
};

export const getTaskById = async (
  claims: SupabaseJwtClaims | null,
  taskId: string,
  tenantId: string
): Promise<TaskWithRelations> => {
  const task = await withAuthorizationTransaction(claims, (tx) => getTaskWithRelationsById(tx, taskId));
  if (!task || task.tenantId !== tenantId) {
    throw new Error("task_not_found");
  }
  return task;
};

const buildTaskInclude = (options?: {
  includeSubtasks?: boolean;
  includeComments?: boolean;
  includeFollowers?: boolean;
}): Prisma.TaskInclude => {
  const include: Prisma.TaskInclude = { project: true };
  if (options?.includeSubtasks) {
    include.subtasks = { orderBy: { createdAt: "asc" } };
  }
  if (options?.includeComments) {
    include.comments = { orderBy: { createdAt: "asc" } };
  }
  if (options?.includeFollowers) {
    include.followers = true;
  }
  include._count = {
    select: {
      subtasks: true,
      comments: true,
      followers: true
    }
  };
  return include;
};

const buildTaskWhere = (
  tenantId: string,
  options?: ListTasksForTenantOptions
): Prisma.TaskWhereInput => {
  const where: Prisma.TaskWhereInput = { tenantId };

  if (options?.projectId !== undefined) {
    where.projectId = options.projectId === null ? null : options.projectId;
  }

  if (options?.statuses && options.statuses.length > 0) {
    where.status = { in: options.statuses };
  } else if (!options?.includeArchived) {
    where.status = { not: TaskStatusEnum.ARCHIVED };
  }

  if (options?.assignedToId) {
    where.assignedToId = options.assignedToId;
  }

  if (options?.search) {
    where.OR = [
      { title: { contains: options.search, mode: "insensitive" } },
      { description: { contains: options.search, mode: "insensitive" } }
    ];
  }

  return where;
};

const buildTaskOrderBy = (
  options?: ListTasksForTenantOptions
): Prisma.TaskOrderByWithRelationInput[] => {
  switch (options?.orderBy) {
    case "priority":
      return [
        { priority: "desc" },
        { dueDate: "asc" },
        { createdAt: "desc" }
      ];
    case "board":
      return [
        { sortOrder: "asc" },
        { createdAt: "asc" }
      ];
    default:
      return [{ createdAt: "desc" }];
  }
};

const getNextSortOrder = async (
  tx: PrismaTransaction,
  tenantId: string,
  projectId: string | null,
  status: TaskStatus
): Promise<number> => {
  const where: Prisma.TaskWhereInput = { tenantId, status };
  if (projectId === null) {
    where.projectId = null;
  } else if (projectId) {
    where.projectId = projectId;
  } else {
    where.projectId = null;
  }

  const aggregate = await tx.task.aggregate({
    where,
    _max: { sortOrder: true }
  });

  const currentMax = aggregate._max.sortOrder ?? 0;
  return currentMax + 1;
};

const ensureFollowerForUser = async (
  tx: PrismaTransaction,
  task: Task,
  userId: string
): Promise<void> => {
  await tx.taskFollower.upsert({
    where: {
      taskId_userId: {
        taskId: task.id,
        userId
      }
    },
    update: {},
    create: {
      taskId: task.id,
      userId,
      tenantId: task.tenantId,
      organizationId: task.organizationId
    }
  });
};

const syncFollowersAfterAssignmentChange = async (
  tx: PrismaTransaction,
  previous: Task,
  next: Task
) => {
  if (previous.assignedToId === next.assignedToId) {
    return;
  }

  if (next.assignedToId) {
    await ensureFollowerForUser(tx, next, next.assignedToId);
  }
};

const ensureTaskWithRelations = (task: TaskWithRelations | null): TaskWithRelations => {
  if (!task) {
    throw new Error("task_not_found");
  }
  return task;
};

export const createTask = async (
  claims: SupabaseJwtClaims | null,
  input: CreateTaskInput
): Promise<TaskWithRelations> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const projectId = normalizeProjectId(input.projectId);
    if (projectId) {
      await ensureProjectForTenant(tx, projectId, input.tenantId, input.organizationId);
    }

    const status = TaskStatusEnum.OPEN;
    const sortOrder =
      input.sortOrder ?? (await getNextSortOrder(tx, input.tenantId, projectId, status));

    const task = await tx.task.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        tenantId: input.tenantId,
        projectId,
        title: input.title,
        description: input.description ?? null,
        status,
        priority: input.priority ?? TaskPriorityEnum.MEDIUM,
        sortOrder,
        createdById: input.createdById,
        assignedToId: input.assignedToId ?? null,
        dueDate: input.dueDate ?? null,
        visibility: input.visibility ?? TaskVisibilityEnum.PROJECT
      }
    });

    const followerIds = new Set<string>();
    followerIds.add(task.createdById);
    if (task.assignedToId) {
      followerIds.add(task.assignedToId);
    }
    for (const followerId of input.followerIds ?? []) {
      followerIds.add(followerId);
    }

    if (followerIds.size > 0) {
      await tx.taskFollower.createMany({
        data: Array.from(followerIds).map((userId) => ({
          taskId: task.id,
          userId,
          tenantId: task.tenantId,
          organizationId: task.organizationId
        })),
        skipDuplicates: true
      });
    }

    return ensureTaskWithRelations(await getTaskWithRelationsById(tx, task.id));
  });
};

export const listTasksForTenant = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string,
  options?: ListTasksForTenantOptions
): Promise<TaskWithRelations[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.task.findMany({
      where: buildTaskWhere(tenantId, options),
      orderBy: buildTaskOrderBy(options),
      include: buildTaskInclude({
        includeComments: options?.includeComments,
        includeFollowers: options?.includeFollowers,
        includeSubtasks: options?.includeSubtasks
      }),
      take: options?.limit
    }) as Promise<TaskWithRelations[]>
  );
};

export const listTasksForUser = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string,
  options: ListMyTasksOptions
): Promise<TaskWithRelations[]> => {
  return withAuthorizationTransaction(claims, (tx) => {
    const includeCreated = options.includeCreated ?? true;
    const includeAssigned = options.includeAssigned ?? true;

    const orFilters: Prisma.TaskWhereInput[] = [];
    if (includeAssigned) {
      orFilters.push({ assignedToId: options.userId });
    }
    if (includeCreated) {
      orFilters.push({ createdById: options.userId });
    }
    if (orFilters.length === 0) {
      orFilters.push({ assignedToId: options.userId });
    }

    const where: Prisma.TaskWhereInput = {
      tenantId,
      OR: orFilters
    };

    if (!options.includeCompleted) {
      where.status = { not: TaskStatusEnum.COMPLETED };
    }

    return tx.task.findMany({
      where,
      orderBy: buildTaskOrderBy({ orderBy: "priority" }),
      include: buildTaskInclude({
        includeFollowers: options.includeFollowers,
        includeSubtasks: true
      })
    }) as Promise<TaskWithRelations[]>;
  });
};

export const updateTask = async (
  claims: SupabaseJwtClaims | null,
  taskId: string,
  tenantId: string,
  updates: UpdateTaskInput
): Promise<TaskWithRelations> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const existing = await getTaskForTenantOrThrow(tx, taskId, tenantId);

    let projectId = existing.projectId;
    if (updates.projectId !== undefined) {
      const normalized = normalizeProjectId(updates.projectId);
      if (normalized) {
        await ensureProjectForTenant(tx, normalized, existing.tenantId, existing.organizationId);
      }
      projectId = normalized;
    }

    const data: Prisma.TaskUncheckedUpdateInput = {};

    if (updates.title !== undefined) {
      data.title = updates.title;
    }

    if (updates.description !== undefined) {
      data.description = updates.description ?? null;
    }

    if (updates.projectId !== undefined) {
      data.projectId = projectId;
    }

    if (updates.assignedToId !== undefined) {
      data.assignedToId = updates.assignedToId ?? null;
    }

    if (updates.dueDate !== undefined) {
      data.dueDate = updates.dueDate;
    }

    if (updates.priority !== undefined) {
      data.priority = updates.priority;
    }

    if (updates.visibility !== undefined) {
      data.visibility = updates.visibility;
    }

    if (updates.sortOrder !== undefined) {
      const nextSortOrder =
        updates.sortOrder ??
        (await getNextSortOrder(tx, existing.tenantId, projectId ?? null, existing.status));
      data.sortOrder = nextSortOrder;
    }

    const updated = await tx.task.update({
      where: { id: existing.id },
      data
    });

    await syncFollowersAfterAssignmentChange(tx, existing, updated);

    return ensureTaskWithRelations(await getTaskWithRelationsById(tx, updated.id));
  });
};

export const setTaskStatus = async (
  claims: SupabaseJwtClaims | null,
  taskId: string,
  tenantId: string,
  status: TaskStatus,
  options?: SetTaskStatusOptions
): Promise<TaskWithRelations> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const existing = await getTaskForTenantOrThrow(tx, taskId, tenantId);

    const data: Prisma.TaskUpdateInput = {
      status
    };

    if (status === TaskStatusEnum.COMPLETED) {
      data.completedAt = new Date();
    } else if (existing.completedAt) {
      data.completedAt = null;
    }

    const newSortOrder =
      options?.sortOrder ??
      (status === existing.status
        ? existing.sortOrder
        : await getNextSortOrder(tx, existing.tenantId, existing.projectId ?? null, status));

    data.sortOrder = newSortOrder;

    await tx.task.update({
      where: { id: existing.id },
      data
    });

    return ensureTaskWithRelations(await getTaskWithRelationsById(tx, existing.id));
  });
};

export const deleteTask = async (
  claims: SupabaseJwtClaims | null,
  taskId: string,
  tenantId: string
): Promise<void> => {
  await withAuthorizationTransaction(claims, async (tx) => {
    const existing = await getTaskForTenantOrThrow(tx, taskId, tenantId);
    await tx.task.delete({ where: { id: existing.id } });
  });
};

export const deleteTasksForTenant = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string
): Promise<void> => {
  await withAuthorizationTransaction(claims, async (tx) => {
    await tx.taskFollower.deleteMany({ where: { tenantId } });
    await tx.taskComment.deleteMany({ where: { tenantId } });
    await tx.taskSubtask.deleteMany({ where: { tenantId } });
    await tx.task.deleteMany({ where: { tenantId } });
    await tx.taskPermissionPolicy.deleteMany({ where: { tenantId } });
    await tx.project.deleteMany({ where: { tenantId } });
  });
};

export const createSubtask = async (
  claims: SupabaseJwtClaims | null,
  taskId: string,
  tenantId: string,
  input: CreateSubtaskInput
): Promise<TaskSubtask> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const parent = await getTaskForTenantOrThrow(tx, taskId, tenantId);

    const subtask = await tx.taskSubtask.create({
      data: {
        id: randomUUID(),
        taskId: parent.id,
        organizationId: parent.organizationId,
        tenantId: parent.tenantId,
        title: input.title,
        isCompleted: input.isCompleted ?? false,
        createdById: input.createdById,
        completedAt: input.isCompleted ? new Date() : null
      }
    });

    return subtask;
  });
};

export const updateSubtask = async (
  claims: SupabaseJwtClaims | null,
  subtaskId: string,
  tenantId: string,
  updates: UpdateSubtaskInput
): Promise<TaskSubtask> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const existing = await tx.taskSubtask.findUnique({ where: { id: subtaskId } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error("subtask_not_found");
    }

    const data: Prisma.TaskSubtaskUpdateInput = {};

    if (updates.title !== undefined) {
      data.title = updates.title;
    }

    if (updates.isCompleted !== undefined) {
      data.isCompleted = updates.isCompleted;
      data.completedAt = updates.isCompleted ? new Date() : null;
    }

    return tx.taskSubtask.update({
      where: { id: existing.id },
      data
    });
  });
};

export const deleteSubtask = async (
  claims: SupabaseJwtClaims | null,
  subtaskId: string,
  tenantId: string
): Promise<void> => {
  await withAuthorizationTransaction(claims, async (tx) => {
    const existing = await tx.taskSubtask.findUnique({ where: { id: subtaskId } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error("subtask_not_found");
    }
    await tx.taskSubtask.delete({ where: { id: existing.id } });
  });
};

export const listSubtasksForTask = async (
  claims: SupabaseJwtClaims | null,
  taskId: string,
  tenantId: string
): Promise<TaskSubtask[]> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    await getTaskForTenantOrThrow(tx, taskId, tenantId);
    return tx.taskSubtask.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" }
    });
  });
};

export const createComment = async (
  claims: SupabaseJwtClaims | null,
  taskId: string,
  tenantId: string,
  input: CreateCommentInput
): Promise<TaskComment> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const task = await getTaskForTenantOrThrow(tx, taskId, tenantId);

    const comment = await tx.taskComment.create({
      data: {
        id: randomUUID(),
        taskId: task.id,
        tenantId: task.tenantId,
        organizationId: task.organizationId,
        body: input.body,
        createdById: input.createdById
      }
    });

    await ensureFollowerForUser(tx, task, input.createdById);

    return comment;
  });
};

export const updateComment = async (
  claims: SupabaseJwtClaims | null,
  commentId: string,
  tenantId: string,
  input: UpdateCommentInput
): Promise<TaskComment> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const existing = await tx.taskComment.findUnique({ where: { id: commentId } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error("comment_not_found");
    }

    return tx.taskComment.update({
      where: { id: existing.id },
      data: {
        body: input.body
      }
    });
  });
};

export const deleteComment = async (
  claims: SupabaseJwtClaims | null,
  commentId: string,
  tenantId: string
): Promise<void> => {
  await withAuthorizationTransaction(claims, async (tx) => {
    const existing = await tx.taskComment.findUnique({ where: { id: commentId } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error("comment_not_found");
    }
    await tx.taskComment.delete({ where: { id: existing.id } });
  });
};

export const listCommentsForTask = async (
  claims: SupabaseJwtClaims | null,
  taskId: string,
  tenantId: string
): Promise<TaskComment[]> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    await getTaskForTenantOrThrow(tx, taskId, tenantId);
    return tx.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" }
    });
  });
};

export const addFollower = async (
  claims: SupabaseJwtClaims | null,
  taskId: string,
  tenantId: string,
  userId: string
): Promise<TaskFollower> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const task = await getTaskForTenantOrThrow(tx, taskId, tenantId);
    await ensureFollowerForUser(tx, task, userId);
    const follower = await tx.taskFollower.findUnique({
      where: { taskId_userId: { taskId: task.id, userId } }
    });
    if (!follower) {
      throw new Error("follower_not_created");
    }
    return follower;
  });
};

export const removeFollower = async (
  claims: SupabaseJwtClaims | null,
  taskId: string,
  tenantId: string,
  userId: string
): Promise<void> => {
  await withAuthorizationTransaction(claims, async (tx) => {
    await getTaskForTenantOrThrow(tx, taskId, tenantId);
    await tx.taskFollower
      .delete({
        where: { taskId_userId: { taskId, userId } }
      })
      .catch((error) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return;
        }
        throw error;
      });
  });
};

export const listFollowers = async (
  claims: SupabaseJwtClaims | null,
  taskId: string,
  tenantId: string
): Promise<TaskFollower[]> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    await getTaskForTenantOrThrow(tx, taskId, tenantId);
    return tx.taskFollower.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" }
    });
  });
};

export const createProject = async (
  claims: SupabaseJwtClaims | null,
  input: CreateProjectInput
): Promise<Project> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    return tx.project.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        tenantId: input.tenantId,
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? null,
        createdById: input.createdById
      }
    });
  });
};

export const updateProject = async (
  claims: SupabaseJwtClaims | null,
  projectId: string,
  tenantId: string,
  updates: UpdateProjectInput
): Promise<Project> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const existing = await tx.project.findUnique({ where: { id: projectId } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error("project_not_found");
    }

    const data: Prisma.ProjectUpdateInput = {};

    if (updates.name !== undefined) {
      data.name = updates.name;
    }
    if (updates.description !== undefined) {
      data.description = updates.description ?? null;
    }
    if (updates.color !== undefined) {
      data.color = updates.color;
    }
    if (updates.archivedAt !== undefined) {
      data.archivedAt = updates.archivedAt;
    }

    return tx.project.update({
      where: { id: existing.id },
      data
    });
  });
};

export const deleteProject = async (
  claims: SupabaseJwtClaims | null,
  projectId: string,
  tenantId: string
): Promise<void> => {
  await withAuthorizationTransaction(claims, async (tx) => {
    const existing = await tx.project.findUnique({ where: { id: projectId } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error("project_not_found");
    }

    await tx.project.delete({
      where: { id: existing.id }
    });
  });
};

export const listProjectsForTenant = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string,
  options?: { includeArchived?: boolean }
): Promise<Project[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.project.findMany({
      where: {
        tenantId,
        ...(options?.includeArchived ? {} : { archivedAt: null })
      },
      orderBy: { createdAt: "asc" }
    })
  );
};

export const getProjectById = async (
  claims: SupabaseJwtClaims | null,
  projectId: string,
  tenantId: string
): Promise<Project | null> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId } });
    if (!project || project.tenantId !== tenantId) {
      return null;
    }
    return project;
  });
};

export const archiveProject = async (
  claims: SupabaseJwtClaims | null,
  projectId: string,
  tenantId: string
): Promise<Project> => {
  return updateProject(claims, projectId, tenantId, { archivedAt: new Date() });
};

export const listProjectSummariesForTenant = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string
): Promise<ProjectSummary[]> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const projects = await tx.project.findMany({
      where: { tenantId },
      orderBy: { name: "asc" }
    });

    const rows = await tx.$queryRaw<Array<{
      project_id: string | null;
      open_count: number;
      overdue_count: number;
      completed_count: number;
    }>>(Prisma.sql`
      SELECT
        t.project_id,
        COUNT(*) FILTER (WHERE t.status IN ('OPEN', 'IN_PROGRESS')) AS open_count,
        COUNT(*) FILTER (
          WHERE t.status IN ('OPEN', 'IN_PROGRESS')
            AND t.due_date IS NOT NULL
            AND t.due_date < NOW()
        ) AS overdue_count,
        COUNT(*) FILTER (WHERE t.status = 'COMPLETED') AS completed_count
      FROM tasks.tasks t
      WHERE t.tenant_id = ${tenantId}
      GROUP BY t.project_id
    `);

    const rowByProjectId = new Map<
      string | null,
      { openCount: number; overdueCount: number; completedCount: number }
    >();

    let totalOpen = 0;
    let totalOverdue = 0;
    let totalCompleted = 0;

    for (const row of rows) {
      const openCount = Number(row.open_count ?? 0);
      const overdueCount = Number(row.overdue_count ?? 0);
      const completedCount = Number(row.completed_count ?? 0);

      rowByProjectId.set(row.project_id, {
        openCount,
        overdueCount,
        completedCount
      });

      totalOpen += openCount;
      totalOverdue += overdueCount;
      totalCompleted += completedCount;
    }

    const summaries: ProjectSummary[] = [
      {
        projectId: null,
        name: "All Tasks",
        openCount: totalOpen,
        overdueCount: totalOverdue,
        completedCount: totalCompleted,
        scope: "all"
      }
    ];

    const unassignedCounts = rowByProjectId.get(null);
    if (unassignedCounts && (unassignedCounts.openCount > 0 || unassignedCounts.overdueCount > 0 || unassignedCounts.completedCount > 0)) {
      summaries.push({
        projectId: null,
        name: "Unassigned",
        openCount: unassignedCounts.openCount,
        overdueCount: unassignedCounts.overdueCount,
        completedCount: unassignedCounts.completedCount,
        scope: "unassigned"
      });
    }

    for (const project of projects) {
      const counts = rowByProjectId.get(project.id) ?? {
        openCount: 0,
        overdueCount: 0,
        completedCount: 0
      };
      summaries.push({
        projectId: project.id,
        name: project.name,
        openCount: counts.openCount,
        overdueCount: counts.overdueCount,
        completedCount: counts.completedCount,
        scope: "project"
      });
    }

    return summaries;
  });
};

export const listPermissionPolicies = async (
  claims: SupabaseJwtClaims | null,
  filter: TaskPermissionPolicyFilter
): Promise<TaskPermissionPolicy[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.taskPermissionPolicy.findMany({
      where: {
        tenantId: filter.tenantId,
        projectId: filter.projectId !== undefined ? filter.projectId : undefined
      },
      orderBy: { createdAt: "asc" }
    })
  );
};

export const listPermissionPoliciesForUser = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string,
  userId: string
): Promise<TaskPermissionPolicy[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.taskPermissionPolicy.findMany({
      where: {
        tenantId,
        userId
      }
    })
  );
};

export const upsertPermissionPolicy = async (
  claims: SupabaseJwtClaims | null,
  input: TaskPermissionPolicyInput
): Promise<TaskPermissionPolicy> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const existing = await tx.taskPermissionPolicy.findFirst({
      where: {
        tenantId: input.tenantId,
        projectId: input.projectId ?? null,
        userId: input.userId
      }
    });

    if (existing) {
      return tx.taskPermissionPolicy.update({
        where: { id: existing.id },
        data: {
          canManage: input.canManage ?? existing.canManage,
          canEdit: input.canEdit ?? existing.canEdit,
          canComment: input.canComment ?? existing.canComment,
          canAssign: input.canAssign ?? existing.canAssign
        }
      });
    }

    if (input.projectId) {
      const project = await tx.project.findUnique({ where: { id: input.projectId } });
      if (!project || project.tenantId !== input.tenantId) {
        throw new Error("project_not_found");
      }
    }

    return tx.taskPermissionPolicy.create({
      data: {
        id: randomUUID(),
        tenantId: input.tenantId,
        projectId: input.projectId ?? null,
        userId: input.userId,
        canManage: input.canManage ?? false,
        canEdit: input.canEdit ?? false,
        canComment: input.canComment ?? true,
        canAssign: input.canAssign ?? false
      }
    });
  });
};

export const deletePermissionPolicy = async (
  claims: SupabaseJwtClaims | null,
  policyId: string,
  tenantId: string
): Promise<void> => {
  await withAuthorizationTransaction(claims, async (tx) => {
    const existing = await tx.taskPermissionPolicy.findUnique({ where: { id: policyId } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error("permission_policy_not_found");
    }
    await tx.taskPermissionPolicy.delete({ where: { id: existing.id } });
  });
};

const ROLE_BASED_CAPABILITIES: Record<string, Record<TaskPermissionAction, boolean>> = {
  OWNER: { view: true, create: true, edit: true, comment: true, assign: true, manage: true },
  ADMIN: { view: true, create: true, edit: true, comment: true, assign: true, manage: true },
  "tasks:admin": { view: true, create: true, edit: true, comment: true, assign: true, manage: true },
  EDITOR: { view: true, create: true, edit: true, comment: true, assign: true, manage: false },
  MEMBER: { view: true, create: true, edit: true, comment: true, assign: false, manage: false },
  CONTRIBUTOR: { view: true, create: true, edit: true, comment: true, assign: false, manage: false },
  ANALYST: { view: true, create: false, edit: false, comment: true, assign: false, manage: false },
  VIEWER: { view: true, create: false, edit: false, comment: true, assign: false, manage: false }
};

const mergeCapabilities = (
  base: Partial<Record<TaskPermissionAction, boolean>>,
  modifier: Partial<Record<TaskPermissionAction, boolean>>
) => {
  const result: Record<TaskPermissionAction, boolean> = {
    view: Boolean(base.view),
    create: Boolean(base.create),
    edit: Boolean(base.edit),
    comment: Boolean(base.comment),
    assign: Boolean(base.assign),
    manage: Boolean(base.manage)
  };

  for (const [key, value] of Object.entries(modifier) as Array<[TaskPermissionAction, boolean | undefined]>) {
    if (value) {
      result[key] = true;
    }
  }

  if (result.manage) {
    result.create = true;
    result.edit = true;
    result.assign = true;
  }

  if (result.edit || result.assign) {
    result.create = true;
    result.view = true;
  }

  if (result.comment) {
    result.view = true;
  }

  return result;
};

export const buildTaskPermissionEvaluator = (
  options: BuildPermissionEvaluatorOptions
): ((action: TaskPermissionAction, projectId?: string | null) => boolean) => {
  const baseCapabilities: Record<TaskPermissionAction, boolean> = mergeCapabilities(
    { view: true, comment: true },
    {}
  );

  for (const identityRole of options.identityRoles) {
    const roleCapabilities = ROLE_BASED_CAPABILITIES[identityRole];
    if (roleCapabilities) {
      Object.assign(baseCapabilities, mergeCapabilities(baseCapabilities, roleCapabilities));
    }
  }

  const globalPolicy = options.policies.find((policy) => !policy.projectId);
  if (globalPolicy) {
    const modifiers: Partial<Record<TaskPermissionAction, boolean>> = {
      manage: globalPolicy.canManage,
      edit: globalPolicy.canEdit,
      comment: globalPolicy.canComment,
      assign: globalPolicy.canAssign
    };
    Object.assign(baseCapabilities, mergeCapabilities(baseCapabilities, modifiers));
  }

  const policyByProject = new Map<string, TaskPermissionPolicyInput>();
  for (const policy of options.policies) {
    if (policy.projectId) {
      policyByProject.set(policy.projectId, {
        tenantId: options.tenantId,
        projectId: policy.projectId,
        userId: options.userId,
        canManage: policy.canManage,
        canEdit: policy.canEdit,
        canComment: policy.canComment,
        canAssign: policy.canAssign
      });
    }
  }

  return (action: TaskPermissionAction, projectId?: string | null) => {
    if (baseCapabilities.manage) {
      return true;
    }

    if (baseCapabilities[action]) {
      return true;
    }

    const scopedPolicy = projectId ? policyByProject.get(projectId) : undefined;
    if (!scopedPolicy) {
      return false;
    }

    const modifiers: Partial<Record<TaskPermissionAction, boolean>> = {
      manage: scopedPolicy.canManage,
      edit: scopedPolicy.canEdit,
      comment: scopedPolicy.canComment,
      assign: scopedPolicy.canAssign
    };

    const scopedCapabilities = mergeCapabilities(baseCapabilities, modifiers);
    return scopedCapabilities[action] ?? false;
  };
};
