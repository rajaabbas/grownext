import { describe, expect, it, beforeEach, vi } from "vitest";

const getTaskByIdMock = vi.fn();
const updateTaskMock = vi.fn();
const setTaskStatusMock = vi.fn();
const deleteTaskMock = vi.fn();

vi.mock("@ma/tasks-db", () => ({
  deleteTask: (...args: unknown[]) => deleteTaskMock(...args),
  getTaskById: (...args: unknown[]) => getTaskByIdMock(...args),
  setTaskStatus: (...args: unknown[]) => setTaskStatusMock(...args),
  updateTask: (...args: unknown[]) => updateTaskMock(...args)
}));

const buildServiceRoleClaimsMock = vi.fn(() => ({}));
vi.mock("@ma/core", () => ({
  buildServiceRoleClaims: (...args: unknown[]) => buildServiceRoleClaimsMock(...args)
}));

const getSupabaseSessionMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseRouteHandlerClient: () => ({
    auth: {
      getSession: getSupabaseSessionMock
    }
  })
}));

const getTasksAuthContextMock = vi.fn();
vi.mock("@/lib/identity-context", () => ({
  getTasksAuthContext: (...args: unknown[]) => getTasksAuthContextMock(...args)
}));

const fetchOwnerMapMock = vi.fn();
vi.mock("../owners", () => ({
  fetchOwnerMap: (...args: unknown[]) => fetchOwnerMapMock(...args)
}));

const permissionEvaluatorMock = vi.fn();
const resolvePermissionEvaluatorMock = vi.fn(async () => (action: string) =>
  permissionEvaluatorMock(action)
);
vi.mock("../permissions", () => ({
  resolvePermissionEvaluator: (...args: unknown[]) => resolvePermissionEvaluatorMock(...args)
}));

const transformTaskMock = vi.fn();
vi.mock("../serializer", () => ({
  transformTask: (...args: unknown[]) => transformTaskMock(...args)
}));

const enqueueTaskNotificationMock = vi.fn();
const cancelDueSoonNotificationMock = vi.fn();
const dueSoonJobIdMock = vi.fn((taskId: string) => `due-soon-${taskId}`);
vi.mock("@/lib/queues", () => ({
  enqueueTaskNotification: (...args: unknown[]) => enqueueTaskNotificationMock(...args),
  cancelDueSoonNotification: (...args: unknown[]) => cancelDueSoonNotificationMock(...args),
  dueSoonJobId: (...args: unknown[]) => dueSoonJobIdMock(...args)
}));

import { PATCH, DELETE } from "../[taskId]/route";

const now = new Date();

const baseTask = {
  id: "task-123",
  organizationId: "org-1",
  tenantId: "tenant-1",
  projectId: "project-42",
  title: "Example task",
  description: null,
  status: "OPEN",
  priority: "MEDIUM",
  visibility: "PROJECT",
  sortOrder: 1,
  assignedToId: null,
  createdById: "user-1",
  dueDate: null,
  completedAt: null,
  createdAt: now,
  updatedAt: now,
  followers: [],
  subtasks: [],
  comments: [],
  _count: { comments: 0, followers: 0, subtasks: 0 }
};

const buildRequest = (init: { method: string; body?: unknown; headers?: HeadersInit }) =>
  new Request("http://localhost/api/tasks/task-123", {
    method: init.method,
    headers: {
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest",
      "x-tenant-id": "tenant-1",
      ...(init.headers ?? {})
    },
    body: init.body ? JSON.stringify(init.body) : undefined
  });

beforeEach(() => {
  vi.clearAllMocks();
  getSupabaseSessionMock.mockResolvedValue({
    data: { session: { access_token: "token-123" } }
  });
  getTasksAuthContextMock.mockResolvedValue({
    organizationId: "org-1",
    tenantId: "tenant-1",
    userId: "user-1",
    roles: ["MEMBER"]
  });
  fetchOwnerMapMock.mockResolvedValue(new Map());
  transformTaskMock.mockReturnValue({ id: "task-123" });
  getTaskByIdMock.mockResolvedValue({ ...baseTask });
  updateTaskMock.mockResolvedValue({ ...baseTask });
  permissionEvaluatorMock.mockImplementation((action: string) => action === "view");
});

describe("PATCH /api/tasks/[taskId]", () => {
  it("forbids sort-only updates when edit permission is missing", async () => {
    const request = buildRequest({
      method: "PATCH",
      body: { sortOrder: 5 }
    });

    const response = await PATCH(request, { params: { taskId: "task-123" } });

    expect(response.status).toBe(403);
    expect(updateTaskMock).not.toHaveBeenCalled();
  });

  it("passes null project IDs through to the data layer", async () => {
    permissionEvaluatorMock.mockImplementation(() => true);
    updateTaskMock.mockResolvedValue({ ...baseTask, projectId: null });

    const request = buildRequest({
      method: "PATCH",
      body: { projectId: null }
    });

    const response = await PATCH(request, { params: { taskId: "task-123" } });

    expect(response.status).toBe(200);
    expect(updateTaskMock).toHaveBeenCalledWith(
      expect.anything(),
      "task-123",
      "tenant-1",
      expect.objectContaining({ projectId: null })
    );
  });

  it("maps task_not_found errors to 404 responses", async () => {
    permissionEvaluatorMock.mockImplementation(() => true);
    updateTaskMock.mockRejectedValue(new Error("task_not_found"));

    const request = buildRequest({
      method: "PATCH",
      body: { title: "Renamed task" }
    });

    const response = await PATCH(request, { params: { taskId: "task-123" } });
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(payload.error).toBe("task_not_found");
  });
});

describe("DELETE /api/tasks/[taskId]", () => {
  it("cancels queued due-soon notifications after deleting", async () => {
    permissionEvaluatorMock.mockImplementation((action: string) => action === "manage" || action === "view");

    const request = buildRequest({ method: "DELETE" });
    const response = await DELETE(request, { params: { taskId: "task-123" } });

    expect(response.status).toBe(204);
    expect(deleteTaskMock).toHaveBeenCalledWith(expect.anything(), "task-123", "tenant-1");
    expect(cancelDueSoonNotificationMock).toHaveBeenCalledWith("task-123");
  });
});
