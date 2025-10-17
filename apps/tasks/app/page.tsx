"use client";

import { Fragment, KeyboardEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantContext } from "@/components/tenant-context";

type TaskView = "list" | "board" | "my";
type TaskStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type TaskVisibility = "PERSONAL" | "PROJECT";

interface TaskOwner {
  id: string;
  email: string | null;
  fullName: string | null;
}

interface ApiSubtask {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  createdById: string;
  createdBy: TaskOwner;
}

interface ApiComment {
  id: string;
  taskId: string;
  body: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  author: TaskOwner;
}

interface ApiFollower {
  id: string;
  joinedAt: string;
  owner: TaskOwner;
}

interface ApiTask {
  id: string;
  organizationId: string;
  tenantId: string;
  projectId: string | null;
  project: {
    id: string;
    name: string;
    color: string | null;
    archived: boolean;
  } | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
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
  visibility: TaskVisibility;
  commentCount: number;
  subtaskCount: number;
  completedSubtaskCount: number;
  subtasks?: ApiSubtask[];
  comments?: ApiComment[];
}

interface TaskStats {
  total: number;
  completed: number;
  overdue: number;
}

interface BoardColumn {
  status: TaskStatus;
  label: string;
  tasks: ApiTask[];
}

interface BoardData {
  columns: BoardColumn[];
}

interface ApiPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canComment: boolean;
  canAssign: boolean;
  canManage: boolean;
}

const DEFAULT_PERMISSIONS: ApiPermissions = {
  canView: true,
  canCreate: true,
  canEdit: true,
  canComment: true,
  canAssign: true,
  canManage: true
};

interface ApiProject {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  color: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiProjectSummary {
  projectId: string | null;
  name: string;
  openCount: number;
  overdueCount: number;
  completedCount: number;
  scope: "all" | "project" | "unassigned";
}

interface TaskDetailsState {
  subtasks: ApiSubtask[];
  comments: ApiComment[];
  followers: ApiFollower[];
}

interface InlineTaskDraft {
  title: string;
  projectId: string | null;
  dueDate: string;
  priority: TaskPriority;
  visibility: TaskVisibility;
  collaboratorIds: string[];
}

type ToastVariant = "success" | "error";

interface ToastMessage {
  id: number;
  message: string;
  variant: ToastVariant;
}

const VIEW_OPTIONS: { value: TaskView; label: string }[] = [
  { value: "list", label: "List" },
  { value: "board", label: "Board" },
  { value: "my", label: "My Tasks" }
];

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  LOW: "bg-emerald-900/50 text-emerald-200 border border-emerald-700",
  MEDIUM: "bg-blue-900/50 text-blue-200 border border-blue-700",
  HIGH: "bg-amber-900/50 text-amber-200 border border-amber-700",
  CRITICAL: "bg-red-900/50 text-red-200 border border-red-700"
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ARCHIVED: "Archived"
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical"
};

const UNASSIGNED_PROJECT = "__unassigned__";
const DUE_SOON_THRESHOLD_MS = 1000 * 60 * 60 * 24;

const formatDate = (value: string | null | undefined): string => {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleDateString();
};

const timeAgo = (value: string | null | undefined): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
};

const isOverdue = (task: ApiTask): boolean => {
  if (!task.dueDate || task.status === "COMPLETED") {
    return false;
  }
  const due = Date.parse(task.dueDate);
  return !Number.isNaN(due) && due < Date.now();
};

const isDueSoonTask = (task: ApiTask): boolean => {
  if (!task.dueDate || task.status === "COMPLETED") {
    return false;
  }
  const due = Date.parse(task.dueDate);
  if (Number.isNaN(due)) return false;
  const diff = due - Date.now();
  return diff > 0 && diff <= DUE_SOON_THRESHOLD_MS;
};

const getNextStatus = (status: TaskStatus): TaskStatus | null => {
  switch (status) {
    case "OPEN":
      return "IN_PROGRESS";
    case "IN_PROGRESS":
      return "COMPLETED";
    case "COMPLETED":
      return "ARCHIVED";
    default:
      return null;
  }
};

const statusOrder: TaskStatus[] = ["OPEN", "IN_PROGRESS", "COMPLETED", "ARCHIVED"];

const STATUS_DOT_CLASSES: Record<TaskStatus, string> = {
  OPEN: "bg-sky-400",
  IN_PROGRESS: "bg-amber-400",
  COMPLETED: "bg-emerald-400",
  ARCHIVED: "bg-slate-500"
};

const TASK_VISIBILITY_LABELS: Record<TaskVisibility, string> = {
  PERSONAL: "Only me",
  PROJECT: "Project"
};

const TASK_VISIBILITY_OPTIONS: Array<{ value: TaskVisibility; label: string }> = [
  { value: "PROJECT", label: TASK_VISIBILITY_LABELS.PROJECT },
  { value: "PERSONAL", label: TASK_VISIBILITY_LABELS.PERSONAL }
];

const formatUserName = (user: TaskOwner | undefined, fallback: string) =>
  user?.fullName ?? user?.email ?? fallback;

const getInitials = (user: TaskOwner | undefined, fallback: string): string => {
  const source = user?.fullName ?? user?.email ?? fallback;
  if (!source) return "?";
  const parts = source.trim().split(/\s+/);
  const letters = parts.slice(0, 2).map((part) => part.charAt(0)?.toUpperCase() ?? "");
  const value = letters.join("");
  if (value.length >= 2) return value;
  if (user?.email) {
    const emailPrefix = user.email.split("@")[0] ?? "";
    return emailPrefix.slice(0, 2).toUpperCase() || value || "?";
  }
  return value || fallback.slice(0, 2).toUpperCase();
};

type PopoverRenderArgs = { open: boolean; toggle: () => void };

interface PopoverProps {
  renderButton: (args: PopoverRenderArgs) => ReactNode;
  children: (close: () => void) => ReactNode;
}

const Popover = ({ renderButton, children }: PopoverProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {renderButton({ open, toggle: () => setOpen((prev) => !prev) })}
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-xl">
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
};

const CircleIconButton = ({
  label,
  title,
  onClick,
  active,
  disabled,
  variant = "default"
}: {
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  variant?: "default" | "primary";
}) => {
  const baseClass = (() => {
    if (variant === "primary") {
      if (disabled) {
        return "cursor-not-allowed border-fuchsia-700 bg-fuchsia-700/60 text-white opacity-60";
      }
      return "border-fuchsia-600 bg-fuchsia-600 text-white hover:bg-fuchsia-500";
    }
    if (disabled) {
      return "cursor-not-allowed border-slate-700 bg-slate-800 text-slate-500 opacity-60";
    }
    if (active) {
      return "border-fuchsia-500 bg-fuchsia-600 text-white";
    }
    return "border-slate-700 bg-slate-900 text-slate-200 hover:border-fuchsia-500 hover:text-fuchsia-200";
  })();

  return (
    <button
      type="button"
      className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition ${baseClass}`}
      onClick={disabled ? undefined : onClick}
      aria-label={title}
      title={title}
      disabled={disabled}
    >
      {label}
    </button>
  );
};

const AvatarCircle = ({
  user,
  fallback,
  onRemove
}: {
  user: TaskOwner | undefined;
  fallback: string;
  onRemove?: () => void;
}) => {
  const initials = getInitials(user, fallback);
  const title = formatUserName(user, fallback);
  return (
    <div className="relative" title={title}>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold uppercase text-slate-200">
        {initials}
      </div>
      {onRemove ? (
        <button
          type="button"
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[10px] text-slate-300 transition hover:text-red-300"
          onClick={onRemove}
          aria-label={`Remove ${title}`}
        >
          ×
        </button>
      ) : null}
    </div>
  );
};

const initialInlineDraft: InlineTaskDraft = {
  title: "",
  projectId: null,
  dueDate: "",
  priority: "MEDIUM",
  visibility: "PROJECT",
  collaboratorIds: []
};

interface TaskListProps {
  tasks: ApiTask[];
  permissions: ApiPermissions;
  currentUserId: string | null;
  projects: ApiProject[];
  projectSummaries: ApiProjectSummary[];
  users: TaskOwner[];
  userLookup: Map<string, TaskOwner>;
  loadingUsers: boolean;
  inlineDraft: InlineTaskDraft;
  onInlineDraftChange: <K extends keyof InlineTaskDraft>(key: K, value: InlineTaskDraft[K]) => void;
  onCreateInline: () => void;
  creatingTask: boolean;
  draftResetKey: number;
  onSelectTask: (taskId: string) => void;
  onToggleStatus: (task: ApiTask, nextStatus: TaskStatus) => Promise<void>;
  onUpdateTask: (taskId: string, payload: Partial<ApiTask> & { dueDate?: string | null; priority?: TaskPriority; projectId?: string | null }) => Promise<void>;
  onDeleteTask: (task: ApiTask) => Promise<void>;
  onAddCollaborator: (taskId: string, userId: string) => Promise<void>;
  onRemoveCollaborator: (taskId: string, userId: string) => Promise<void>;
}

const TaskList = ({
  tasks,
  permissions,
  currentUserId,
  projects,
  projectSummaries,
  users,
  userLookup,
  loadingUsers,
  inlineDraft,
  onInlineDraftChange,
  onCreateInline,
  creatingTask,
  draftResetKey,
  onSelectTask,
  onToggleStatus,
  onUpdateTask,
  onDeleteTask,
  onAddCollaborator,
  onRemoveCollaborator
}: TaskListProps) => {
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const activeProjects = useMemo(
    () => projects.filter((project) => !project.archivedAt),
    [projects]
  );
  const projectSummaryLookup = useMemo(() => {
    const map = new Map<string, ApiProjectSummary>();
    for (const summary of projectSummaries) {
      if (summary.scope === "project" && summary.projectId) {
        map.set(summary.projectId, summary);
      }
    }
    return map;
  }, [projectSummaries]);
  const unassignedSummary = useMemo(
    () => projectSummaries.find((summary) => summary.scope === "unassigned") ?? null,
    [projectSummaries]
  );
  const inlineCollaboratorEntries = useMemo(
    () => inlineDraft.collaboratorIds.map((id) => ({ id, user: userLookup.get(id) })),
    [inlineDraft.collaboratorIds, userLookup]
  );
  const availableInlineCollaborators = useMemo(
    () => users.filter((user) => !inlineDraft.collaboratorIds.includes(user.id)),
    [users, inlineDraft.collaboratorIds]
  );
  const inlineProjectLabel =
    inlineDraft.projectId === UNASSIGNED_PROJECT
      ? "Unassigned"
      : inlineDraft.projectId
        ? projectSummaryLookup.get(inlineDraft.projectId)?.name ?? "Project"
        : "Project";
  const inlineDueDateLabel = inlineDraft.dueDate ? formatDate(inlineDraft.dueDate) : "Due date";
  const inlinePriorityLabel = PRIORITY_LABELS[inlineDraft.priority];
  const inlineVisibilityLabel = TASK_VISIBILITY_LABELS[inlineDraft.visibility];
  const optionClass = (active: boolean): string =>
    active
      ? "w-full rounded-md bg-fuchsia-600/20 px-3 py-2 text-left text-sm text-fuchsia-200"
      : "w-full rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800/70";

  useEffect(() => {
    if (!permissions.canCreate) return;
    if (titleInputRef.current) {
      titleInputRef.current.focus();
      if (inlineDraft.title.length > 0) {
        titleInputRef.current.setSelectionRange(inlineDraft.title.length, inlineDraft.title.length);
      }
    }
  }, [draftResetKey, inlineDraft.title.length, permissions.canCreate]);

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (creatingTask || inlineDraft.title.trim().length === 0) {
        return;
      }
      onCreateInline();
    }
  };

  const removeInlineCollaborator = (userId: string) => {
    onInlineDraftChange(
      "collaboratorIds",
      inlineDraft.collaboratorIds.filter((id) => id !== userId)
    );
  };

  return (
    <div className="space-y-2">
      {permissions.canCreate && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/60 p-1 shadow-inner"
                title={STATUS_LABELS.OPEN}
              >
                <span className={`h-4 w-4 rounded-full ${STATUS_DOT_CLASSES.OPEN}`} />
              </span>
              <input
                ref={titleInputRef}
                type="text"
                className="w-full max-w-xs flex-1 bg-transparent px-0 py-2 text-sm font-semibold text-white placeholder:text-slate-500 focus:outline-none"
                placeholder="Click Here To Add A Task"
                value={inlineDraft.title}
                onChange={(event) => onInlineDraftChange("title", event.target.value)}
                onKeyDown={handleDraftKeyDown}
              />
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <span className="text-slate-700">|</span>
              <div className="flex flex-wrap items-center gap-2">
                {inlineCollaboratorEntries.length === 0 ? (
                  <span className="text-xs text-slate-500">No collaborators</span>
                ) : (
                  inlineCollaboratorEntries.map(({ id, user }) => (
                    <AvatarCircle
                      key={id}
                      user={user}
                      fallback={id}
                      onRemove={() => removeInlineCollaborator(id)}
                    />
                  ))
                )}
                <Popover
                  renderButton={({ open, toggle }) => (
                    <CircleIconButton
                      label="+"
                      title="Add collaborator"
                      onClick={toggle}
                      active={open}
                      disabled={loadingUsers || availableInlineCollaborators.length === 0}
                    />
                  )}
                >
                  {(close) => (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Add collaborator</p>
                      {availableInlineCollaborators.length === 0 ? (
                        <p className="text-xs text-slate-400">Everyone with access is already included.</p>
                      ) : (
                        <div className="space-y-1">
                          {availableInlineCollaborators.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800/70"
                              onClick={() => {
                                onInlineDraftChange("collaboratorIds", [
                                  ...new Set([...inlineDraft.collaboratorIds, user.id])
                                ]);
                                close();
                              }}
                            >
                              <AvatarCircle user={user} fallback={user.id} />
                              <div className="flex flex-col">
                                <span>{formatUserName(user, user.id)}</span>
                                {user.email ? (
                                  <span className="text-xs text-slate-500">{user.email}</span>
                                ) : null}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Popover>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Popover
                    renderButton={({ open, toggle }) => (
                      <CircleIconButton
                        label="📁"
                        title="Select project"
                        onClick={toggle}
                        active={open}
                      />
                    )}
                  >
                    {(close) => (
                      <div className="space-y-1">
                        <button
                          type="button"
                          className={optionClass(inlineDraft.projectId === null)}
                          onClick={() => {
                            onInlineDraftChange("projectId", null);
                            close();
                          }}
                        >
                          No project preference
                        </button>
                        <button
                          type="button"
                          className={optionClass(inlineDraft.projectId === UNASSIGNED_PROJECT)}
                          onClick={() => {
                            onInlineDraftChange("projectId", UNASSIGNED_PROJECT);
                            close();
                          }}
                        >
                          Unassigned ({unassignedSummary?.openCount ?? 0})
                        </button>
                        {activeProjects.map((project) => {
                          const active = inlineDraft.projectId === project.id;
                          const summary = projectSummaryLookup.get(project.id);
                          return (
                            <button
                              key={project.id}
                              type="button"
                              className={optionClass(active)}
                              onClick={() => {
                                onInlineDraftChange("projectId", project.id);
                                close();
                              }}
                            >
                              {project.name} ({summary?.openCount ?? 0})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Popover>
                  <span className="hidden text-slate-500 md:inline">{inlineProjectLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Popover
                    renderButton={({ open, toggle }) => (
                      <CircleIconButton
                        label="📅"
                        title="Set due date"
                        onClick={toggle}
                        active={open}
                      />
                    )}
                  >
                    {(close) => (
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wide text-slate-500">Due date</label>
                        <input
                          type="date"
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                          value={inlineDraft.dueDate}
                          onChange={(event) => {
                            onInlineDraftChange("dueDate", event.target.value);
                            close();
                          }}
                        />
                        {inlineDraft.dueDate ? (
                          <button
                            type="button"
                            className="w-full rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-red-500 hover:text-red-300"
                            onClick={() => {
                              onInlineDraftChange("dueDate", "");
                              close();
                            }}
                          >
                            Clear due date
                          </button>
                        ) : null}
                      </div>
                    )}
                  </Popover>
                  <span className="hidden text-slate-500 md:inline">{inlineDueDateLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Popover
                    renderButton={({ open, toggle }) => (
                      <CircleIconButton
                        label="!"
                        title="Set priority"
                        onClick={toggle}
                        active={open}
                      />
                    )}
                  >
                    {(close) => (
                      <div className="space-y-1">
                        {Object.entries(PRIORITY_LABELS).map(([value, label]) => {
                          const active = inlineDraft.priority === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              className={optionClass(active)}
                              onClick={() => {
                                onInlineDraftChange("priority", value as TaskPriority);
                                close();
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Popover>
                  <span className="hidden text-slate-500 md:inline">{inlinePriorityLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Popover
                    renderButton={({ open, toggle }) => (
                      <CircleIconButton
                        label="👁"
                        title="Task visibility"
                        onClick={toggle}
                        active={open}
                      />
                    )}
                  >
                    {(close) => (
                      <div className="space-y-1">
                        {TASK_VISIBILITY_OPTIONS.map((option) => {
                          const active = inlineDraft.visibility === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              className={optionClass(active)}
                              onClick={() => {
                                onInlineDraftChange("visibility", option.value);
                                close();
                              }}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Popover>
                  <span className="hidden text-slate-500 md:inline">{inlineVisibilityLabel}</span>
                </div>
              </div>
              <CircleIconButton
                label="+"
                title="Add task"
                onClick={onCreateInline}
                active={false}
                disabled={creatingTask || inlineDraft.title.trim().length === 0}
                variant="primary"
              />
            </div>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
          No tasks to display.
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const nextStatus = getNextStatus(task.status);
            const overdue = isOverdue(task);
            const dueSoon = isDueSoonTask(task);
            const dueClass = overdue
              ? "text-red-300"
              : dueSoon
                ? "text-amber-200"
                : "text-slate-200";
            const projectLabel = task.project?.name ?? "Unassigned";
            const dueDateLabel = task.dueDate ? formatDate(task.dueDate) : "Due date";
            const priorityLabel = PRIORITY_LABELS[task.priority];
            const visibilityLabel = TASK_VISIBILITY_LABELS[task.visibility];
            const collaboratorSet = new Set(task.followerIds);
            const collaboratorEntries = task.followerIds.map((id) => ({
              id,
              user: userLookup.get(id)
            }));
            const canAddOthers = permissions.canManage;
            const collaboratorCandidates = users.filter((user) => {
              if (collaboratorSet.has(user.id)) return false;
              if (canAddOthers) return true;
              return user.id === currentUserId;
            });

            return (
              <div
                key={task.id}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 shadow-sm transition hover:border-fuchsia-500/40"
              >
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/60 p-1 shadow-inner hover:ring-2 hover:ring-slate-500`}
                      title={STATUS_LABELS[task.status]}
                    >
                      <span className={`h-4 w-4 rounded-full ${STATUS_DOT_CLASSES[task.status]}`} />
                    </span>
                    <button
                      className="min-w-0 truncate text-left text-sm font-semibold text-white hover:text-fuchsia-300"
                      onClick={() => onSelectTask(task.id)}
                    >
                      {task.title}
                    </button>
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-3">
                    <span className="text-slate-700">|</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {collaboratorEntries.length === 0 ? (
                        <span className="text-xs text-slate-500">No collaborators</span>
                      ) : (
                        collaboratorEntries.map(({ id, user }) => {
                          const removable = permissions.canManage || id === currentUserId;
                          return (
                            <AvatarCircle
                              key={id}
                              user={user}
                              fallback={id}
                              onRemove={removable ? () => void onRemoveCollaborator(task.id, id) : undefined}
                            />
                          );
                        })
                      )}
                      <Popover
                        renderButton={({ open, toggle }) => (
                          <CircleIconButton
                            label="+"
                            title="Add collaborator"
                            onClick={toggle}
                            active={open}
                            disabled={loadingUsers || collaboratorCandidates.length === 0}
                          />
                        )}
                      >
                        {(close) => (
                          <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Add collaborator</p>
                            {collaboratorCandidates.length === 0 ? (
                              <p className="text-xs text-slate-400">No additional collaborators available.</p>
                            ) : (
                              <div className="space-y-1">
                                {collaboratorCandidates.map((user) => (
                                  <button
                                    key={user.id}
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800/70"
                                    onClick={async () => {
                                      await onAddCollaborator(task.id, user.id);
                                      close();
                                    }}
                                  >
                                    <AvatarCircle user={user} fallback={user.id} />
                                    <div className="flex flex-col">
                                      <span>{formatUserName(user, user.id)}</span>
                                      {user.email ? (
                                        <span className="text-xs text-slate-500">{user.email}</span>
                                      ) : null}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </Popover>
                    </div>
                    <span className="text-slate-700">|</span>
                    <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <Popover
                          renderButton={({ open, toggle }) => (
                            <CircleIconButton
                              label="📁"
                            title="Change project"
                            onClick={toggle}
                            active={open}
                          />
                        )}
                      >
                        {(close) => (
                          <div className="space-y-1">
                            <button
                              type="button"
                              className={optionClass(task.projectId === null)}
                              onClick={() => {
                                void onUpdateTask(task.id, { projectId: null });
                                close();
                              }}
                            >
                              Unassigned ({unassignedSummary?.openCount ?? 0})
                            </button>
                            {projects.map((project) => {
                              const active = task.projectId === project.id;
                              const summary = projectSummaryLookup.get(project.id);
                              return (
                                <button
                                  key={project.id}
                                  type="button"
                                  className={optionClass(active)}
                                  onClick={() => {
                                    void onUpdateTask(task.id, { projectId: project.id });
                                    close();
                                  }}
                                >
                                  {project.name} ({summary?.openCount ?? 0})
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </Popover>
                      <span className="hidden text-slate-500 md:inline">{projectLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Popover
                        renderButton={({ open, toggle }) => (
                          <CircleIconButton
                            label="📅"
                            title="Change due date"
                            onClick={toggle}
                            active={open}
                          />
                        )}
                      >
                        {(close) => (
                          <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wide text-slate-500">Due date</label>
                            <input
                              type="date"
                              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                              value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                              onChange={async (event) => {
                                await onUpdateTask(task.id, {
                                  dueDate: event.target.value ? event.target.value : null
                                });
                                close();
                              }}
                            />
                            {task.dueDate ? (
                              <button
                                type="button"
                                className="w-full rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-red-500 hover:text-red-300"
                                onClick={async () => {
                                  await onUpdateTask(task.id, { dueDate: null });
                                  close();
                                }}
                              >
                                Clear due date
                              </button>
                            ) : null}
                          </div>
                        )}
                      </Popover>
                      <span className={`hidden md:inline ${dueClass}`}>{dueDateLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Popover
                        renderButton={({ open, toggle }) => (
                          <CircleIconButton
                            label="!"
                            title="Change priority"
                            onClick={toggle}
                            active={open}
                          />
                        )}
                      >
                        {(close) => (
                          <div className="space-y-1">
                            {Object.entries(PRIORITY_LABELS).map(([value, label]) => {
                              const active = task.priority === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  className={optionClass(active)}
                                  onClick={async () => {
                                    await onUpdateTask(task.id, { priority: value as TaskPriority });
                                    close();
                                  }}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </Popover>
                      <span className="hidden text-slate-500 md:inline">{priorityLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Popover
                        renderButton={({ open, toggle }) => (
                          <CircleIconButton
                            label="👁"
                            title="Change visibility"
                            onClick={toggle}
                            active={open}
                          />
                        )}
                      >
                        {(close) => (
                          <div className="space-y-1">
                            {TASK_VISIBILITY_OPTIONS.map((option) => {
                              const active = task.visibility === option.value;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  className={optionClass(active)}
                                  onClick={async () => {
                                    await onUpdateTask(task.id, { visibility: option.value });
                                    close();
                                  }}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </Popover>
                      <span className="hidden text-slate-500 md:inline">{visibilityLabel}</span>
                    </div>
                    {permissions.canEdit && nextStatus && (
                      <CircleIconButton
                        label="→"
                        title={`Move to ${STATUS_LABELS[nextStatus]}`}
                        onClick={() => onToggleStatus(task, nextStatus)}
                      />
                    )}
                    {permissions.canManage && (
                      <CircleIconButton
                        label="🗑"
                        title="Delete task"
                        onClick={() => onDeleteTask(task)}
                      />
                    )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};



interface TaskBoardProps {
  board: BoardData | null;
  permissions: ApiPermissions;
  onSelectTask: (taskId: string) => void;
  onStatusChange: (task: ApiTask, nextStatus: TaskStatus, nextPosition: number) => Promise<void>;
}

const TaskBoard = ({ board, permissions, onSelectTask, onStatusChange }: TaskBoardProps) => {
  if (!board) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
        Board data unavailable.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {board.columns.map((column) => (
        <div key={column.status} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-200">
            <span>{column.label}</span>
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
              {column.tasks.length}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {column.tasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-center text-xs text-slate-500">
                No tasks in this column.
              </div>
            ) : (
              column.tasks.map((task, index) => {
                const nextStatus = getNextStatus(task.status);
                return (
                  <div key={task.id} className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 shadow">
                    <button
                      className="text-left text-sm font-semibold text-white hover:text-fuchsia-300"
                      onClick={() => onSelectTask(task.id)}
                    >
                      {task.title}
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide ${PRIORITY_STYLES[task.priority]}`}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                      {task.dueDate && (
                        <span className={`rounded-full border px-2 py-0.5 ${isOverdue(task) ? "border-red-500 text-red-300" : "border-slate-700 text-slate-300"}`}>
                          Due {formatDate(task.dueDate)}
                        </span>
                      )}
                      {task.assignee && (
                        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-300">
                          {task.assignee.fullName ?? task.assignee.email ?? task.assignee.id}
                        </span>
                      )}
                    </div>
                    {permissions.canEdit && nextStatus && (
                      <button
                        className="mt-3 w-full rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 transition hover:border-fuchsia-500 hover:text-fuchsia-200"
                        onClick={() => onStatusChange(task, nextStatus, column.tasks.length - index)}
                      >
                        Move to {STATUS_LABELS[nextStatus]}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

interface TaskDetailProps {
  task: ApiTask | null;
  details: TaskDetailsState | null;
  permissions: ApiPermissions;
  loading: boolean;
  error: string | null;
  notify: (message: string, variant?: ToastVariant) => void;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onUpdateTask: (updates: Partial<{ title: string; description: string | null; dueDate: string | null; priority: TaskPriority; projectId: string | null }>) => Promise<void>;
  onAddSubtask: (title: string) => Promise<void>;
  onToggleSubtask: (subtask: ApiSubtask, isCompleted: boolean) => Promise<void>;
  onDeleteSubtask: (subtaskId: string) => Promise<void>;
  onAddComment: (body: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onFollow: () => Promise<void>;
  onUnfollow: (userId: string) => Promise<void>;
  currentUserId: string | null;
  onAssignToMe: () => Promise<void>;
  onUnassign: () => Promise<void>;
  projects: ApiProject[];
}

const TaskDetailPanel = ({
  task,
  details,
  permissions,
  loading,
  error,
  notify,
  onClose,
  onRefresh,
  onUpdateTask,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onAddComment,
  onDeleteComment,
  onFollow,
  onUnfollow,
  currentUserId,
  onAssignToMe,
  onUnassign,
  projects
}: TaskDetailProps) => {
  const [commentBody, setCommentBody] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");

  useEffect(() => {
    setCommentBody("");
    setSubtaskTitle("");
  }, [task?.id]);

  if (!task) return null;

  const isFollowing = details?.followers.some((follower) => follower.id === currentUserId) ?? false;

  const handleCommentSubmit = async () => {
    if (!commentBody.trim()) return;
    try {
      await onAddComment(commentBody.trim());
      setCommentBody("");
    } catch (error) {
      notify((error as Error).message, "error");
    }
  };

  const handleSubtaskSubmit = async () => {
    if (!subtaskTitle.trim()) return;
    try {
      await onAddSubtask(subtaskTitle.trim());
      setSubtaskTitle("");
    } catch (error) {
      notify((error as Error).message, "error");
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl overflow-y-auto border-l border-slate-800 bg-slate-950/95 p-6 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white">{task.title}</h2>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            <span className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide ${PRIORITY_STYLES[task.priority]}`}>
              {PRIORITY_LABELS[task.priority]}
            </span>
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-300">
              {STATUS_LABELS[task.status]}
            </span>
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-300">
              Created {timeAgo(task.createdAt)}
            </span>
            {task.project && (
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-300">
                Project: {task.project.name}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-red-500 hover:text-red-300"
        >
          Close
        </button>
      </div>

      {loading ? (
        <div className="mt-6 text-sm text-slate-400">Loading task details…</div>
      ) : error ? (
        <div className="mt-6 rounded border border-red-600 bg-red-900/40 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : (
        <Fragment>
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-500">Description</label>
              {permissions.canEdit ? (
                <textarea
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 shadow focus:border-fuchsia-500 focus:outline-none"
                  rows={4}
                  value={task.description ?? ""}
                  onChange={(event) =>
                    onUpdateTask({
                      description: event.target.value
                    })
                  }
                  placeholder="Add more context to this task"
                />
              ) : (
                <p className="mt-1 text-sm text-slate-300">{task.description ?? "No description."}</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs uppercase tracking-wide text-slate-500">Due Date</label>
                {permissions.canEdit ? (
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                    value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                    onChange={(event) =>
                      onUpdateTask({
                        dueDate: event.target.value ? event.target.value : null
                      })
                    }
                  />
                ) : (
                  <p className="mt-1 text-sm text-slate-300">{formatDate(task.dueDate)}</p>
                )}
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-slate-500">Priority</label>
                {permissions.canEdit ? (
                  <select
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                    value={task.priority}
                    onChange={(event) =>
                      onUpdateTask({
                        priority: event.target.value as TaskPriority
                      })
                    }
                  >
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-sm text-slate-300">{PRIORITY_LABELS[task.priority]}</p>
                )}
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-slate-500">Project</label>
                {permissions.canEdit ? (
                  <select
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                    value={task.projectId ?? UNASSIGNED_PROJECT}
                    onChange={(event) =>
                      onUpdateTask({
                        projectId: event.target.value === UNASSIGNED_PROJECT ? null : event.target.value
                      })
                    }
                  >
                    <option value={UNASSIGNED_PROJECT}>Unassigned</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-sm text-slate-300">{task.project ? task.project.name : "Unassigned"}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {permissions.canAssign && (
                <button
                  className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-emerald-500 hover:text-emerald-200"
                  onClick={async () => {
                      try {
                        await onAssignToMe();
                      } catch (error) {
                        notify((error as Error).message, "error");
                      }
                    }}
                  >
                  Assign to me
                </button>
              )}
              {permissions.canAssign && task.assignedToId && (
                <button
                  className="rounded-md border border-amber-500 px-3 py-1 text-xs text-amber-200 transition hover:bg-amber-500/10"
                  onClick={async () => {
                      try {
                        await onUnassign();
                      } catch (error) {
                        notify((error as Error).message, "error");
                      }
                    }}
                  >
                  Unassign
                </button>
              )}
              {permissions.canComment && !isFollowing && (
                <button
                  className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-emerald-500 hover:text-emerald-200"
                  onClick={async () => {
                      try {
                        await onFollow();
                      } catch (error) {
                        notify((error as Error).message, "error");
                      }
                    }}
                  >
                  Follow task
                </button>
              )}
              {isFollowing && (
                <button
                  className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-red-500 hover:text-red-200"
                  onClick={async () => {
                    if (!currentUserId) return;
                      try {
                        await onUnfollow(currentUserId);
                      } catch (error) {
                        notify((error as Error).message, "error");
                      }
                    }}
                  >
                  Unfollow
                </button>
              )}
              <button
                className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-fuchsia-500 hover:text-fuchsia-200"
                onClick={onRefresh}
              >
                Refresh
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-white">Subtasks</h3>
                <div className="mt-2 space-y-2">
                  {details?.subtasks.length ? (
                    details.subtasks.map((subtask) => (
                      <div key={subtask.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/60 p-3">
                        <div>
                          <label className="flex items-center gap-2 text-sm text-slate-200">
                            <input
                              type="checkbox"
                              checked={subtask.isCompleted}
                              onChange={async (event) => {
                                try {
                                  await onToggleSubtask(subtask, event.target.checked);
                                } catch (error) {
                                  notify((error as Error).message, "error");
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500"
                              disabled={!permissions.canEdit}
                            />
                            <span className={subtask.isCompleted ? "line-through text-slate-500" : ""}>{subtask.title}</span>
                          </label>
                          <p className="mt-1 text-xs text-slate-500">
                            Added by {subtask.createdBy.fullName ?? subtask.createdBy.email ?? subtask.createdBy.id}
                          </p>
                        </div>
                        {permissions.canEdit && (
                          <button
                            className="rounded-md border border-red-600 px-2 py-1 text-xs text-red-300 transition hover:bg-red-600/10"
                            onClick={async () => {
                                try {
                                  await onDeleteSubtask(subtask.id);
                                } catch (error) {
                                  notify((error as Error).message, "error");
                                }
                              }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No subtasks yet.</p>
                  )}
                  {permissions.canEdit && (
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                        placeholder="New subtask"
                        value={subtaskTitle}
                        onChange={(event) => setSubtaskTitle(event.target.value)}
                      />
                      <button
                        className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-fuchsia-500 hover:text-fuchsia-200"
                        onClick={handleSubtaskSubmit}
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white">Comments</h3>
                <div className="mt-2 space-y-3">
                  {details?.comments.length ? (
                    details.comments.map((comment) => (
                      <div key={comment.id} className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{comment.author.fullName ?? comment.author.email ?? comment.author.id}</span>
                          <span>{timeAgo(comment.updatedAt)}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-200">{comment.body}</p>
                        {permissions.canManage && (
                          <button
                            className="mt-2 rounded-md border border-red-600 px-2 py-1 text-xs text-red-300 transition hover:bg-red-600/10"
                            onClick={async () => {
                              try {
                                await onDeleteComment(comment.id);
                              } catch (error) {
                                notify((error as Error).message, "error");
                              }
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No comments yet.</p>
                  )}
                  {permissions.canComment && (
                    <div className="space-y-2">
                      <textarea
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                        rows={3}
                        value={commentBody}
                        onChange={(event) => setCommentBody(event.target.value)}
                        placeholder="Share an update or question"
                      />
                      <button
                        className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-fuchsia-500 hover:text-fuchsia-200"
                        onClick={handleCommentSubmit}
                      >
                        Comment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">Followers</h3>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                {details?.followers.length ? (
                  details.followers.map((follower) => (
                    <span key={follower.id} className="rounded-full border border-slate-700 px-2 py-0.5">
                      {follower.owner.fullName ?? follower.owner.email ?? follower.owner.id}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500">No followers yet.</span>
                )}
              </div>
            </div>
          </div>
        </Fragment>
      )}
    </div>
  );
};

interface ProjectFormState {
  name: string;
  description: string;
  color: string;
}

const DEFAULT_PROJECT_COLOR = "#6366F1";

const initialProjectFormState: ProjectFormState = {
  name: "",
  description: "",
  color: DEFAULT_PROJECT_COLOR
};

function TasksPageContent() {
  const { context, activeTenantId: tenantId, loading: tenantLoading, refresh } = useTenantContext();

  const [view, setView] = useState<TaskView>("list");
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [stats, setStats] = useState<TaskStats>({ total: 0, completed: 0, overdue: 0 });
  const initialPermissions = context?.permissions.effective ?? DEFAULT_PERMISSIONS;
  const [permissions, setPermissions] = useState<ApiPermissions>(initialPermissions);
  const [projects, setProjects] = useState<ApiProject[]>(context?.projects ?? []);
  const [summaries, setSummaries] = useState<ApiProjectSummary[]>(context?.projectSummaries ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [inlineDraft, setInlineDraft] = useState<InlineTaskDraft>(initialInlineDraft);
  const [draftResetKey, setDraftResetKey] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<ApiTask | null>(null);
  const [detailState, setDetailState] = useState<TaskDetailsState | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [users, setUsers] = useState<TaskOwner[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(context?.user.id ?? null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectFormState, setProjectFormState] = useState<ProjectFormState>(initialProjectFormState);
  const [projectFormError, setProjectFormError] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const dueSoonRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!context) return;
    setProjects(context.projects);
    setSummaries(context.projectSummaries);
    setPermissions(context.permissions.effective);
    setCurrentUserId(context.user.id);
  }, [context]);

  const handleInlineDraftChange = useCallback(
    <K extends keyof InlineTaskDraft>(key: K, value: InlineTaskDraft[K]) => {
      setInlineDraft((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetInlineDraft = useCallback(() => {
    setInlineDraft(initialInlineDraft);
    setDraftResetKey((prev) => prev + 1);
  }, []);

  const addToast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const resetProjectForm = useCallback(() => {
    setProjectFormState(initialProjectFormState);
    setProjectFormError(null);
  }, []);

  const openProjectDialog = useCallback(() => {
    resetProjectForm();
    setProjectDialogOpen(true);
  }, [resetProjectForm]);

  const closeProjectDialog = useCallback(() => {
    if (creatingProject) return;
    setProjectDialogOpen(false);
    resetProjectForm();
  }, [creatingProject, resetProjectForm]);

  const headersWithTenant = useCallback(
    (headers: HeadersInit = {}) => {
      const merged = new Headers(headers);
      if (tenantId) {
        merged.set("X-Tenant-Id", tenantId);
      }
      merged.set("X-Requested-With", "XMLHttpRequest");
      return merged;
    },
    [tenantId]
  );

  const withTenant = useCallback(
    (path: string) =>
      tenantId ? `${path}${path.includes("?") ? "&" : "?"}tenantId=${encodeURIComponent(tenantId)}` : path,
    [tenantId]
  );

  const loadUsers = useCallback(async () => {
    if (!tenantId) {
      setUsers([]);
      return;
    }
    setLoadingUsers(true);
    try {
      const response = await fetch(withTenant("/api/users"), {
        headers: headersWithTenant()
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to load members");
      }
      const data = json as { users?: TaskOwner[] };
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      addToast((err as Error).message, "error");
    } finally {
      setLoadingUsers(false);
    }
  }, [addToast, headersWithTenant, tenantId, withTenant]);

  useEffect(() => {
    if (!tenantId) {
      setUsers([]);
      return;
    }
    void loadUsers();
  }, [loadUsers, tenantId]);

  const userLookup = useMemo(() => {
    const map = new Map<string, TaskOwner>();
    for (const user of users) {
      map.set(user.id, user);
    }
    return map;
  }, [users]);

  const loadTasks = useCallback(async () => {
    if (!tenantId) {
      if (!tenantLoading) {
        setError("Tenant context missing. Launch Tasks from a tenant in the portal.");
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("view", view);
      if (projectFilter === UNASSIGNED_PROJECT) {
        params.set("projectId", "unassigned");
      } else if (projectFilter) {
        params.set("projectId", projectFilter);
      }

      const response = await fetch(withTenant(`/api/tasks?${params.toString()}`), {
        headers: headersWithTenant()
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to load tasks");
      }

      const json = (await response.json()) as {
        tasks?: ApiTask[];
        board?: BoardData;
        stats?: TaskStats;
        permissions?: ApiPermissions;
        currentUserId?: string;
      };

      const taskList = Array.isArray(json.tasks) ? json.tasks : [];

      const orderedTasks = taskList.slice().sort((a, b) => {
        const statusDiff = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
        if (statusDiff !== 0) return statusDiff;
        return a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt);
      });

      setTasks(orderedTasks);
      setBoard(json.board ?? null);
      setStats(json.stats ?? { total: 0, completed: 0, overdue: 0 });
      setCurrentUserId(json.currentUserId ?? context?.user.id ?? null);
      if (json.permissions) {
        setPermissions(json.permissions);
      } else if (context?.permissions.effective) {
        setPermissions(context.permissions.effective);
      }

      const dueSoonTasks = orderedTasks.filter((task) => isDueSoonTask(task));
      for (const dueTask of dueSoonTasks) {
        if (!dueSoonRef.current.has(dueTask.id)) {
          addToast(`"${dueTask.title}" is due soon`);
        }
      }
      dueSoonRef.current = new Set(dueSoonTasks.map((task) => task.id));

      if (selectedTaskId) {
        const taskMatch = orderedTasks.find((task) => task.id === selectedTaskId) ?? null;
        setSelectedTask(taskMatch);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [addToast, context, headersWithTenant, projectFilter, selectedTaskId, tenantId, view, withTenant]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks, tenantId]);

  useEffect(() => {
    setProjectFilter(null);
    setSelectedTaskId(null);
    setSelectedTask(null);
    setDetailState(null);
  }, [tenantId]);

  useEffect(() => {
    setInlineDraft((prev) => {
      if (!prev.projectId) return prev;
      const stillActive = projects.some(
        (project) => project.id === prev.projectId && !project.archivedAt
      );
      return stillActive ? prev : { ...prev, projectId: null };
    });
  }, [projects]);

  useEffect(() => {
    if (view === "my") {
      setProjectFilter(null);
    }
  }, [view]);

  const fetchTaskDetails = useCallback(
    async (taskId: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const [subtasksRes, commentsRes, followersRes] = await Promise.all([
          fetch(withTenant(`/api/tasks/${taskId}/subtasks`), { headers: headersWithTenant() }),
          fetch(withTenant(`/api/tasks/${taskId}/comments`), { headers: headersWithTenant() }),
          fetch(withTenant(`/api/tasks/${taskId}/followers`), { headers: headersWithTenant() })
        ]);

        if (!subtasksRes.ok || !commentsRes.ok || !followersRes.ok) {
          const errorMessages: string[] = [];
          for (const res of [subtasksRes, commentsRes, followersRes]) {
            if (!res.ok) {
              const json = await res.json().catch(() => null);
              errorMessages.push(json?.error ?? res.statusText);
            }
          }
          throw new Error(errorMessages.join(", "));
        }

        const subtasksJson = (await subtasksRes.json()) as { subtasks: ApiSubtask[] };
        const commentsJson = (await commentsRes.json()) as { comments: ApiComment[] };
        const followersJson = (await followersRes.json()) as { followers: ApiFollower[] };

        setDetailState({
          subtasks: subtasksJson.subtasks,
          comments: commentsJson.comments,
          followers: followersJson.followers
        });
      } catch (err) {
        setDetailError((err as Error).message);
      } finally {
        setDetailLoading(false);
      }
    },
    [headersWithTenant, withTenant]
  );

  const handleCreateTask = useCallback(async () => {
    if (!tenantId || !permissions.canCreate) return;
    const trimmedTitle = inlineDraft.title.trim();
    if (!trimmedTitle) return;
    setCreatingTask(true);
    try {
      const body = {
        title: trimmedTitle,
        projectId: inlineDraft.projectId === UNASSIGNED_PROJECT ? "unassigned" : inlineDraft.projectId ?? undefined,
        priority: inlineDraft.priority,
        dueDate: inlineDraft.dueDate || undefined,
        visibility: inlineDraft.visibility,
        followerIds: Array.from(new Set(inlineDraft.collaboratorIds))
      };

      const response = await fetch(withTenant("/api/tasks"), {
        method: "POST",
        headers: headersWithTenant({ "Content-Type": "application/json" }),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to create task");
      }

      const json = (await response.json()) as { task?: ApiTask };
      const createdTask = json.task ?? null;

      resetInlineDraft();
      await loadTasks();
      if (createdTask) {
        setSelectedTask(null);
        setDetailState(null);
      }
      addToast("Task created");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingTask(false);
    }
  }, [
    addToast,
    fetchTaskDetails,
    headersWithTenant,
    inlineDraft,
    loadTasks,
    permissions.canCreate,
    resetInlineDraft,
    tenantId,
    withTenant
  ]);

  const handleToggleStatus = useCallback(
    async (task: ApiTask, nextStatus: TaskStatus) => {
      if (!permissions.canEdit) return;
      try {
        const response = await fetch(withTenant(`/api/tasks/${task.id}`), {
          method: "PATCH",
          headers: headersWithTenant({ "Content-Type": "application/json" }),
          body: JSON.stringify({ status: nextStatus })
        });
        if (!response.ok) {
          const json = await response.json().catch(() => null);
          throw new Error(json?.error ?? "Failed to update status");
        }
        await loadTasks();
        addToast("Task status updated");
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [addToast, headersWithTenant, loadTasks, permissions.canEdit, withTenant]
  );

  const handleBoardStatusChange = useCallback(
    async (task: ApiTask, nextStatus: TaskStatus, nextPosition: number) => {
      if (!permissions.canEdit) return;
      try {
        const response = await fetch(withTenant(`/api/tasks/${task.id}`), {
          method: "PATCH",
          headers: headersWithTenant({ "Content-Type": "application/json" }),
          body: JSON.stringify({ status: nextStatus, sortOrder: nextPosition + 1 })
        });
        if (!response.ok) {
          const json = await response.json().catch(() => null);
          throw new Error(json?.error ?? "Failed to update task status");
        }
        await loadTasks();
        addToast("Task status updated");
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [addToast, headersWithTenant, loadTasks, permissions.canEdit, withTenant]
  );

  const handleUpdateTask = useCallback(
    async (taskId: string, payload: Partial<ApiTask> & { dueDate?: string | null; priority?: TaskPriority; projectId?: string | null }) => {
      try {
        const response = await fetch(withTenant(`/api/tasks/${taskId}`), {
          method: "PATCH",
          headers: headersWithTenant({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const json = await response.json().catch(() => null);
          throw new Error(json?.error ?? "Failed to update task");
        }
        await loadTasks();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [headersWithTenant, loadTasks, withTenant]
  );

  const handleAssignToMe = useCallback(
    async (task: ApiTask) => {
      if (!currentUserId || !permissions.canAssign) return;
      await handleUpdateTask(task.id, { assignedToId: currentUserId });
      addToast("Task assigned to you");
    },
    [addToast, currentUserId, handleUpdateTask, permissions.canAssign]
  );

  const handleUnassign = useCallback(
    async (task: ApiTask) => {
      if (!permissions.canAssign) return;
      await handleUpdateTask(task.id, { assignedToId: null });
      addToast("Assignment removed");
    },
    [addToast, handleUpdateTask, permissions.canAssign]
  );

  const handleDeleteTask = useCallback(
    async (task: ApiTask) => {
      if (!permissions.canManage) return;
      try {
        const response = await fetch(withTenant(`/api/tasks/${task.id}`), {
          method: "DELETE",
          headers: headersWithTenant()
        });
        if (!response.ok) {
          const json = await response.json().catch(() => null);
          throw new Error(json?.error ?? "Failed to delete task");
        }
        if (selectedTaskId === task.id) {
          setSelectedTaskId(null);
          setSelectedTask(null);
          setDetailState(null);
        }
        await loadTasks();
        addToast("Task deleted");
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [addToast, headersWithTenant, loadTasks, permissions.canManage, selectedTaskId, withTenant]
  );


  const handleSelectTask = useCallback(
    async (taskId: string) => {
      setSelectedTaskId(taskId);
      const task = tasks.find((item) => item.id === taskId) ?? null;
      setSelectedTask(task);
      await fetchTaskDetails(taskId);
    },
    [fetchTaskDetails, tasks]
  );

  const closeTaskPanel = useCallback(() => {
    setSelectedTaskId(null);
    setSelectedTask(null);
    setDetailState(null);
    setDetailError(null);
  }, []);

  const handleAddSubtask = useCallback(
    async (title: string) => {
      if (!selectedTaskId) return;
      const response = await fetch(withTenant(`/api/tasks/${selectedTaskId}/subtasks`), {
        method: "POST",
        headers: headersWithTenant({ "Content-Type": "application/json" }),
        body: JSON.stringify({ title })
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to create subtask");
      }
      await fetchTaskDetails(selectedTaskId);
      await loadTasks();
      addToast("Subtask added");
    },
    [addToast, fetchTaskDetails, headersWithTenant, loadTasks, selectedTaskId, withTenant]
  );

  const handleToggleSubtask = useCallback(
    async (subtask: ApiSubtask, isCompleted: boolean) => {
      if (!selectedTaskId) return;
      const response = await fetch(withTenant(`/api/tasks/${selectedTaskId}/subtasks/${subtask.id}`), {
        method: "PATCH",
        headers: headersWithTenant({ "Content-Type": "application/json" }),
        body: JSON.stringify({ isCompleted })
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to update subtask");
      }
      await fetchTaskDetails(selectedTaskId);
      await loadTasks();
      addToast(isCompleted ? "Subtask completed" : "Subtask reopened");
    },
    [addToast, fetchTaskDetails, headersWithTenant, loadTasks, selectedTaskId, withTenant]
  );

  const handleDeleteSubtask = useCallback(
    async (subtaskId: string) => {
      if (!selectedTaskId) return;
      const response = await fetch(withTenant(`/api/tasks/${selectedTaskId}/subtasks/${subtaskId}`), {
        method: "DELETE",
        headers: headersWithTenant()
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to delete subtask");
      }
      await fetchTaskDetails(selectedTaskId);
      await loadTasks();
      addToast("Subtask removed");
    },
    [addToast, fetchTaskDetails, headersWithTenant, loadTasks, selectedTaskId, withTenant]
  );

  const handleAddComment = useCallback(
    async (body: string) => {
      if (!selectedTaskId) return;
      const response = await fetch(withTenant(`/api/tasks/${selectedTaskId}/comments`), {
        method: "POST",
        headers: headersWithTenant({ "Content-Type": "application/json" }),
        body: JSON.stringify({ body })
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to add comment");
      }
      await fetchTaskDetails(selectedTaskId);
      addToast("Comment added");
    },
    [addToast, fetchTaskDetails, headersWithTenant, selectedTaskId, withTenant]
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!selectedTaskId) return;
      const response = await fetch(withTenant(`/api/tasks/${selectedTaskId}/comments/${commentId}`), {
        method: "DELETE",
        headers: headersWithTenant()
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to delete comment");
      }
      await fetchTaskDetails(selectedTaskId);
      addToast("Comment removed");
    },
    [addToast, fetchTaskDetails, headersWithTenant, selectedTaskId, withTenant]
  );

  const handleFollowTask = useCallback(
    async () => {
      if (!selectedTaskId) return;
      const response = await fetch(withTenant(`/api/tasks/${selectedTaskId}/followers`), {
        method: "POST",
        headers: headersWithTenant({ "Content-Type": "application/json" }),
        body: JSON.stringify({})
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to follow task");
      }
      await fetchTaskDetails(selectedTaskId);
      await loadTasks();
      addToast("You are following this task");
    },
    [addToast, fetchTaskDetails, headersWithTenant, loadTasks, selectedTaskId, withTenant]
  );

  const handleUnfollowTask = useCallback(
    async (userId: string) => {
      if (!selectedTaskId) return;
      const response = await fetch(withTenant(`/api/tasks/${selectedTaskId}/followers`), {
        method: "DELETE",
        headers: headersWithTenant({ "Content-Type": "application/json" }),
        body: JSON.stringify({ userId })
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to unfollow task");
      }
      await fetchTaskDetails(selectedTaskId);
      await loadTasks();
      addToast("You stopped following this task");
    },
    [addToast, fetchTaskDetails, headersWithTenant, loadTasks, selectedTaskId, withTenant]
  );

  const handleAddCollaborator = useCallback(
    async (taskId: string, userId: string) => {
      try {
        const response = await fetch(withTenant(`/api/tasks/${taskId}/followers`), {
          method: "POST",
          headers: headersWithTenant({ "Content-Type": "application/json" }),
          body: JSON.stringify({ userId })
        });
        if (!response.ok) {
          const json = await response.json().catch(() => null);
          throw new Error(json?.error ?? "Failed to add collaborator");
        }
        if (selectedTaskId === taskId) {
          await fetchTaskDetails(taskId);
        }
        await loadTasks();
        addToast("Collaborator added");
      } catch (err) {
        addToast((err as Error).message, "error");
      }
    },
    [addToast, fetchTaskDetails, headersWithTenant, loadTasks, selectedTaskId, withTenant]
  );

  const handleRemoveCollaborator = useCallback(
    async (taskId: string, userId: string) => {
      try {
        const response = await fetch(withTenant(`/api/tasks/${taskId}/followers`), {
          method: "DELETE",
          headers: headersWithTenant({ "Content-Type": "application/json" }),
          body: JSON.stringify({ userId })
        });
        if (!response.ok) {
          const json = await response.json().catch(() => null);
          throw new Error(json?.error ?? "Failed to remove collaborator");
        }
        if (selectedTaskId === taskId) {
          await fetchTaskDetails(taskId);
        }
        await loadTasks();
        addToast("Collaborator removed");
      } catch (err) {
        addToast((err as Error).message, "error");
      }
    },
    [addToast, fetchTaskDetails, headersWithTenant, loadTasks, selectedTaskId, withTenant]
  );

  const allProjectsSummary = useMemo(
    () => summaries.find((summary) => summary.scope === "all") ?? null,
    [summaries]
  );

  const unassignedProjectsSummary = useMemo(
    () => summaries.find((summary) => summary.scope === "unassigned") ?? null,
    [summaries]
  );

  const projectSummaryLookup = useMemo(() => {
    const map = new Map<string, ApiProjectSummary>();
    for (const summary of summaries) {
      if (summary.scope === "project" && summary.projectId) {
        map.set(summary.projectId, summary);
      }
    }
    return map;
  }, [summaries]);

  const currentProjectSummary = useMemo(() => {
    if (projectFilter === UNASSIGNED_PROJECT) {
      return summaries.find((summary) => summary.scope === "unassigned") ?? null;
    }
    if (!projectFilter) {
      return summaries.find((summary) => summary.scope === "all") ?? null;
    }
    return summaries.find((summary) => summary.projectId === projectFilter) ?? null;
  }, [projectFilter, summaries]);

  const availableProjects = useMemo(() => {
    return projects.filter((project) => !project.archivedAt);
  }, [projects]);

  useEffect(() => {
    setInlineDraft((prev) => {
      if (projectFilter === UNASSIGNED_PROJECT) {
        return { ...prev, projectId: UNASSIGNED_PROJECT };
      }
      if (projectFilter) {
        return { ...prev, projectId: projectFilter };
      }
      return prev;
    });
  }, [projectFilter]);

  const selectedTaskDetails = useMemo(() => detailState, [detailState]);

  const handleProjectFormChange = useCallback(
    <K extends keyof ProjectFormState>(key: K, value: ProjectFormState[K]) => {
      setProjectFormState((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleCreateProject = useCallback(async () => {
    if (!tenantId) {
      setProjectFormError("Tenant context missing. Launch Tasks from a tenant in the portal.");
      return;
    }
    const trimmedName = projectFormState.name.trim();
    if (!trimmedName) {
      setProjectFormError("Project name is required.");
      return;
    }

    const trimmedDescription = projectFormState.description.trim();
    const colorInput = projectFormState.color.trim();
    const normalizedColor =
      colorInput.length === 0 ? undefined : colorInput.startsWith("#") ? colorInput : `#${colorInput}`;

    setCreatingProject(true);
    setProjectFormError(null);
    try {
      const response = await fetch(withTenant("/api/projects"), {
        method: "POST",
        headers: headersWithTenant({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: trimmedName,
          description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
          color: normalizedColor
        })
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to create project");
      }

      const json = (await response.json()) as { project?: ApiProject };
      const createdProject = json.project ?? null;

      if (createdProject) {
        setProjectFilter(createdProject.id);
        setInlineDraft((prev) => ({ ...prev, projectId: createdProject.id }));
      }

      await refresh();

      addToast("Project created");
      setProjectDialogOpen(false);
      resetProjectForm();
    } catch (err) {
      setProjectFormError((err as Error).message);
    } finally {
      setCreatingProject(false);
    }
  }, [
    addToast,
    headersWithTenant,
    projectFormState.color,
    projectFormState.description,
    projectFormState.name,
    resetProjectForm,
    setProjectFilter,
    setInlineDraft,
    tenantId,
    refresh,
    withTenant
  ]);

  return (
    <div className="space-y-8">
      {toasts.length > 0 && (
        <div className="fixed right-4 top-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-md border px-3 py-2 text-sm shadow-lg ${
                toast.variant === "error"
                  ? "border-red-500 bg-red-900/40 text-red-100"
                  : "border-fuchsia-500 bg-slate-900/90 text-fuchsia-100"
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
      <header className="space-y-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">Tasks</h1>
            <p className="text-slate-400">
              Track and complete work items for the active tenant.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`rounded-md border px-3 py-1 text-sm transition ${view === option.value ? "border-fuchsia-500 text-fuchsia-200" : "border-slate-700 text-slate-300 hover:border-fuchsia-500/60 hover:text-fuchsia-200"}`}
                onClick={() => setView(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
            <div className="text-lg font-semibold text-white">{stats.total}</div>
            <div className="uppercase tracking-wide text-slate-500">Total</div>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
            <div className="text-lg font-semibold text-white">{stats.completed}</div>
            <div className="uppercase tracking-wide text-slate-500">Completed</div>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
            <div className={`text-lg font-semibold ${stats.overdue > 0 ? "text-red-300" : "text-white"}`}>{stats.overdue}</div>
            <div className="uppercase tracking-wide text-slate-500">Overdue</div>
          </div>
          {currentProjectSummary && (
            <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
              <div className="text-sm font-semibold text-white">{currentProjectSummary.name}</div>
              <div>Open: {currentProjectSummary.openCount}</div>
              <div>Completed: {currentProjectSummary.completedCount}</div>
              <div>Overdue: {currentProjectSummary.overdueCount}</div>
            </div>
          )}
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-slate-500">Project Filter</label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                value={projectFilter ?? ""}
                onChange={(event) => setProjectFilter(event.target.value || null)}
                disabled={view === "my"}
              >
                <option value="">
                  All Projects ({allProjectsSummary?.openCount ?? stats.total})
                </option>
                <option value={UNASSIGNED_PROJECT}>
                  Unassigned ({unassignedProjectsSummary?.openCount ?? 0})
                </option>
                {availableProjects.map((project) => {
                  const summary = projectSummaryLookup.get(project.id);
                  const count = summary?.openCount ?? 0;
                  return (
                    <option key={project.id} value={project.id}>
                      {project.name} ({count})
                    </option>
                  );
                })}
              </select>
              {permissions.canManage && (
                <button
                  type="button"
                  className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-fuchsia-500 hover:text-fuchsia-200 disabled:opacity-50"
                  onClick={openProjectDialog}
                  disabled={creatingProject}
                >
                  New Project
                </button>
              )}
            </div>
          </div>
        </div>

      {tenantLoading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">Loading tenant context…</div>
      ) : loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">Loading tasks…</div>
        ) : error ? (
          <div className="rounded-xl border border-red-600 bg-red-900/30 p-6 text-sm text-red-200">{error}</div>
        ) : view === "board" ? (
          <TaskBoard
            board={board}
            permissions={permissions}
            onSelectTask={handleSelectTask}
            onStatusChange={(task, nextStatus, index) => handleBoardStatusChange(task, nextStatus, index)}
          />
        ) : (
          <TaskList
            tasks={tasks}
            permissions={permissions}
            currentUserId={currentUserId}
            projects={projects}
            projectSummaries={summaries}
            users={users}
            userLookup={userLookup}
            loadingUsers={loadingUsers}
            inlineDraft={inlineDraft}
            onInlineDraftChange={handleInlineDraftChange}
            onCreateInline={() => void handleCreateTask()}
            creatingTask={creatingTask}
            draftResetKey={draftResetKey}
            onSelectTask={handleSelectTask}
            onToggleStatus={handleToggleStatus}
            onUpdateTask={(taskId, payload) => handleUpdateTask(taskId, payload)}
            onDeleteTask={handleDeleteTask}
            onAddCollaborator={handleAddCollaborator}
            onRemoveCollaborator={handleRemoveCollaborator}
          />
        )}
      </section>

      <TaskDetailPanel
        task={selectedTask}
        details={selectedTaskDetails}
        permissions={permissions}
        loading={detailLoading}
        error={detailError}
        notify={addToast}
        onClose={closeTaskPanel}
        onRefresh={async () => {
          if (!selectedTaskId) return;
          await fetchTaskDetails(selectedTaskId);
          await loadTasks();
        }}
        onUpdateTask={(updates) => (selectedTaskId ? handleUpdateTask(selectedTaskId, updates) : Promise.resolve())}
        onAddSubtask={handleAddSubtask}
        onToggleSubtask={handleToggleSubtask}
        onDeleteSubtask={handleDeleteSubtask}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        onFollow={handleFollowTask}
        onUnfollow={handleUnfollowTask}
        currentUserId={currentUserId}
        onAssignToMe={() => (selectedTask ? handleAssignToMe(selectedTask) : Promise.resolve())}
        onUnassign={() => (selectedTask ? handleUnassign(selectedTask) : Promise.resolve())}
        projects={projects}
      />
      {projectDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-project-title"
          onClick={(event) => {
            if (event.target === event.currentTarget && !creatingProject) {
              closeProjectDialog();
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="create-project-title" className="text-lg font-semibold text-white">
                  Create Project
                </h2>
                <p className="text-sm text-slate-400">
                  Organize tasks by grouping related work into a dedicated project.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-fuchsia-500 hover:text-fuchsia-200 disabled:opacity-50"
                onClick={closeProjectDialog}
                disabled={creatingProject}
              >
                Close
              </button>
            </div>
            {projectFormError && (
              <div className="mt-4 rounded-md border border-red-600 bg-red-900/30 px-3 py-2 text-sm text-red-200">
                {projectFormError}
              </div>
            )}
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateProject();
              }}
            >
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500" htmlFor="project-name">
                  Name
                </label>
                <input
                  id="project-name"
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                  placeholder="Marketing Launch"
                  value={projectFormState.name}
                  onChange={(event) => handleProjectFormChange("name", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500" htmlFor="project-description">
                  Description
                </label>
                <textarea
                  id="project-description"
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                  rows={3}
                  placeholder="Optional context for the project"
                  value={projectFormState.description}
                  onChange={(event) => handleProjectFormChange("description", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500" htmlFor="project-color">
                  Color
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    id="project-color"
                    type="color"
                    className="h-10 w-16 rounded border border-slate-700 bg-slate-900"
                    value={projectFormState.color || DEFAULT_PROJECT_COLOR}
                    onChange={(event) => handleProjectFormChange("color", event.target.value)}
                  />
                  <input
                    type="text"
                    className="w-32 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                    value={projectFormState.color}
                    onChange={(event) => handleProjectFormChange("color", event.target.value.toUpperCase())}
                    placeholder="#6366F1"
                    maxLength={9}
                  />
                  <button
                    type="button"
                    className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-fuchsia-500 hover:text-fuchsia-200"
                    onClick={() => handleProjectFormChange("color", "")}
                    disabled={creatingProject}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-fuchsia-500 hover:text-fuchsia-200 disabled:opacity-50"
                  onClick={closeProjectDialog}
                  disabled={creatingProject}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-50"
                  disabled={creatingProject || !projectFormState.name.trim()}
                >
                  {creatingProject ? "Creating…" : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <section className="space-y-8">
      <TasksPageContent />
    </section>
  );
}
