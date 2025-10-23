import { beforeEach, describe, expect, it, vi } from "vitest";

const createCommentMock = vi.hoisted(() => vi.fn());
const listCommentsForTaskMock = vi.hoisted(() => vi.fn());
const getTaskByIdMock = vi.hoisted(() => vi.fn());
vi.mock("@ma/tasks-db", () => ({
  createComment: createCommentMock,
  listCommentsForTask: listCommentsForTaskMock,
  getTaskById: getTaskByIdMock
}));

const buildServiceRoleClaimsMock = vi.hoisted(() => vi.fn(() => ({})));
vi.mock("@ma/core", () => ({
  buildServiceRoleClaims: buildServiceRoleClaimsMock
}));

const getSupabaseSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseRouteHandlerClient: () => ({
    auth: {
      getSession: getSupabaseSessionMock
    }
  })
}));

const getTasksAuthContextMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/identity-context", () => ({
  getTasksAuthContext: getTasksAuthContextMock
}));

const fetchOwnerMapMock = vi.hoisted(() => vi.fn());
vi.mock("../../owners", () => ({
  fetchOwnerMap: fetchOwnerMapMock
}));

const resolvePermissionEvaluatorMock = vi.hoisted(() =>
  vi.fn(async () => (action: string) => action === "comment")
);
vi.mock("../../permissions", () => ({
  resolvePermissionEvaluator: resolvePermissionEvaluatorMock
}));

const transformCommentsMock = vi.hoisted(() => vi.fn());
vi.mock("../../serializer", () => ({
  transformComments: transformCommentsMock
}));

const enqueueTaskNotificationMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queues", () => ({
  enqueueTaskNotification: enqueueTaskNotificationMock
}));

const emitTaskCommentUsageMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/billing-usage", () => ({
  emitTaskCommentUsage: emitTaskCommentUsageMock
}));

import { POST } from "../route";

const buildRequest = (body: unknown) =>
  new Request("http://localhost/api/tasks/task-1/comments?tenantId=tenant-1", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest"
    },
    body: JSON.stringify(body)
  });

const now = new Date();

beforeEach(() => {
  vi.clearAllMocks();
  getSupabaseSessionMock.mockResolvedValue({
    data: { session: { access_token: "access-token-1" } }
  });
  getTasksAuthContextMock.mockResolvedValue({
    organizationId: "org-1",
    tenantId: "tenant-1",
    userId: "user-1",
    roles: ["ADMIN"],
    productId: "product-1",
    productSlug: "tasks",
    activeEntitlementId: "entitlement-1"
  });
  fetchOwnerMapMock.mockResolvedValue(new Map());
  transformCommentsMock.mockReturnValue([{ id: "comment-1" }]);
  createCommentMock.mockResolvedValue({
    id: "comment-1",
    taskId: "task-1",
    body: "Example",
    createdById: "user-1",
    createdAt: now,
    updatedAt: now
  });
  getTaskByIdMock.mockResolvedValue({
    id: "task-1",
    title: "Task",
    tenantId: "tenant-1",
    organizationId: "org-1",
    assignedToId: null,
    followers: [],
    createdById: "user-1"
  });
});

describe("POST /api/tasks/[taskId]/comments", () => {
  it("emits a billing usage event after creating a comment", async () => {
    const response = await POST(
      buildRequest({
        body: "This is a test comment."
      }),
      { params: { taskId: "task-1" } }
    );

    expect(response.status).toBe(201);
    expect(createCommentMock).toHaveBeenCalled();
    expect(emitTaskCommentUsageMock).toHaveBeenCalledWith(
      {
        accessToken: "access-token-1",
        organizationId: "org-1",
        tenantId: "tenant-1",
        productId: "product-1"
      },
      expect.objectContaining({
        id: "comment-1",
        taskId: "task-1",
        createdById: "user-1",
        createdAt: now
      })
    );
  });
});
