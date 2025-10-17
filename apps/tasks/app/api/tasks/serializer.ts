import type {
  ProjectRecord,
  TaskCommentRecord,
  TaskFollowerRecord,
  TaskRecord,
  TaskSubtaskRecord,
  TaskWithRelations
} from "@ma/tasks-db";

export interface TaskOwner {
  id: string;
  email: string | null;
  fullName: string | null;
}

export interface SerializedProjectReference {
  id: string;
  name: string;
  color: string | null;
  archived: boolean;
}

export interface SerializedSubtask {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  createdById: string;
  createdBy: TaskOwner;
}

export interface SerializedComment {
  id: string;
  taskId: string;
  body: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  author: TaskOwner;
}

export interface SerializedTask {
  id: string;
  organizationId: string;
  tenantId: string;
  projectId: string | null;
  project: SerializedProjectReference | null;
  title: string;
  description: string | null;
  status: TaskRecord["status"];
  priority: TaskRecord["priority"];
  visibility: TaskRecord["visibility"];
  sortOrder: number;
  assignedToId: string | null;
  assignee: TaskOwner | null;
  createdById: string;
  owner: TaskOwner;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  followerIds: string[];
  commentCount: number;
  subtaskCount: number;
  completedSubtaskCount: number;
  subtasks?: SerializedSubtask[];
  comments?: SerializedComment[];
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

const transformProject = (project: ProjectRecord | null | undefined): SerializedProjectReference | null => {
  if (!project) {
    return null;
  }
  return {
    id: project.id,
    name: project.name,
    color: project.color ?? null,
    archived: project.archivedAt != null
  };
};

const transformSubtask = (
  subtask: TaskSubtaskRecord,
  owners: Map<string, TaskOwner>
): SerializedSubtask => ({
  id: subtask.id,
  taskId: subtask.taskId,
  title: subtask.title,
  isCompleted: subtask.isCompleted,
  completedAt: subtask.completedAt?.toISOString() ?? null,
  createdAt: subtask.createdAt.toISOString(),
  createdById: subtask.createdById,
  createdBy: ensureOwner(subtask.createdById, owners.get(subtask.createdById))
});

const transformComment = (
  comment: TaskCommentRecord,
  owners: Map<string, TaskOwner>
): SerializedComment => ({
  id: comment.id,
  taskId: comment.taskId,
  body: comment.body,
  createdById: comment.createdById,
  createdAt: comment.createdAt.toISOString(),
  updatedAt: comment.updatedAt.toISOString(),
  author: ensureOwner(comment.createdById, owners.get(comment.createdById))
});

const followerIdsFromRecords = (followers?: TaskFollowerRecord[]): string[] => {
  if (!followers) return [];
  const ids = new Set<string>();
  for (const follower of followers) {
    ids.add(follower.userId);
  }
  return Array.from(ids);
};

const resolveCounts = (
  task: TaskRecord & Partial<TaskWithRelations>
): { commentCount: number; subtaskCount: number; completedSubtaskCount: number } => {
  const subtasks = task.subtasks ?? [];
  const comments = task.comments ?? [];
  const commentCount = "_count" in task && task._count
    ? (task._count?.comments ?? comments.length)
    : comments.length;
  const subtaskCount = "_count" in task && task._count
    ? (task._count?.subtasks ?? subtasks.length)
    : subtasks.length;
  const completedSubtaskCount = subtasks.filter((subtask) => subtask.isCompleted).length;

  return {
    commentCount,
    subtaskCount,
    completedSubtaskCount
  };
};

export interface TransformTaskOptions {
  includeSubtasks?: boolean;
  includeComments?: boolean;
}

export const transformTask = (
  task: TaskRecord & Partial<TaskWithRelations>,
  owners: Map<string, TaskOwner>,
  options?: TransformTaskOptions
): SerializedTask => {
  const projectRef = transformProject(task.project ?? null);
  const owner = ensureOwner(task.createdById, owners.get(task.createdById));
  const assignee = task.assignedToId ? ensureOwner(task.assignedToId, owners.get(task.assignedToId)) : null;

  const followers = followerIdsFromRecords(task.followers);
  const { commentCount, subtaskCount, completedSubtaskCount } = resolveCounts(task);

  const serialized: SerializedTask = {
    id: task.id,
    organizationId: task.organizationId,
    tenantId: task.tenantId,
    projectId: task.projectId ?? null,
    project: projectRef,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    visibility: task.visibility,
    sortOrder: task.sortOrder,
    assignedToId: task.assignedToId ?? null,
    assignee,
    createdById: task.createdById,
    owner,
    dueDate: task.dueDate?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    followerIds: followers,
    commentCount,
    subtaskCount,
    completedSubtaskCount
  };

  if (options?.includeSubtasks && task.subtasks) {
    serialized.subtasks = task.subtasks.map((subtask) => transformSubtask(subtask, owners));
  }

  if (options?.includeComments && task.comments) {
    serialized.comments = task.comments.map((comment) => transformComment(comment, owners));
  }

  return serialized;
};

export const transformSubtasks = (
  subtasks: TaskSubtaskRecord[],
  owners: Map<string, TaskOwner>
): SerializedSubtask[] => subtasks.map((subtask) => transformSubtask(subtask, owners));

export const transformComments = (
  comments: TaskCommentRecord[],
  owners: Map<string, TaskOwner>
): SerializedComment[] => comments.map((comment) => transformComment(comment, owners));
