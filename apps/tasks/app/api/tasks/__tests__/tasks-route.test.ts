import { beforeEach, describe, expect, it, vi } from "vitest";

const createTaskMock = vi.hoisted(() => vi.fn());
const listTasksForTenantMock = vi.hoisted(() => vi.fn());
const listTasksForUserMock = vi.hoisted(() => vi.fn());

vi.mock("@ma/tasks-db", () => ({
  createTask: createTaskMock,
  listTasksForTenant: listTasksForTenantMock,
  listTasksForUser: listTasksForUserMock
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
vi.mock("../owners", () => ({
  fetchOwnerMap: fetchOwnerMapMock
}));

const resolvePermissionEvaluatorMock = vi.hoisted(() =>
  vi.fn(async () => (action: string) => action === "create")
);
vi.mock("../permissions", () => ({
  resolvePermissionEvaluator: resolvePermissionEvaluatorMock
}));

const transformTaskMock = vi.hoisted(() => vi.fn());
vi.mock("../serializer", () => ({
  transformTask: transformTaskMock
}));

const enqueueTaskNotificationMock = vi.hoisted(() => vi.fn());
const cancelDueSoonNotificationMock = vi.hoisted(() => vi.fn());
const dueSoonJobIdMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queues", () => ({
  enqueueTaskNotification: enqueueTaskNotificationMock,
  cancelDueSoonNotification: cancelDueSoonNotificationMock,
  dueSoonJobId: dueSoonJobIdMock
}));

const emitTaskCreatedUsageMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/billing-usage", () => ({
  emitTaskCreatedUsage: emitTaskCreatedUsageMock
}));

import { POST } from "../route";

const buildRequest = (body: unknown) =>
  new Request("http://localhost/api/tasks?tenantId=tenant-1", {
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
  transformTaskMock.mockReturnValue({ id: "task-1" });
  createTaskMock.mockResolvedValue({
    id: "task-1",
    organizationId: "org-1",
    tenantId: "tenant-1",
    projectId: null,
    title: "Sample task",
    description: null,
    status: "OPEN",
    priority: "MEDIUM",
    sortOrder: 1,
    createdById: "user-1",
    assignedToId: null,
    dueDate: null,
    visibility: "PROJECT",
    createdAt: now,
    updatedAt: now,
    followers: [],
    subtasks: [],
    comments: []
  });
});

describe("POST /api/tasks", () => {
  it("emits a billing usage event after creating a task", async () => {
    const response = await POST(
      buildRequest({
        title: "Sample task"
      })
    );

    expect(response.status).toBe(201);
    expect(createTaskMock).toHaveBeenCalled();
    expect(emitTaskCreatedUsageMock).toHaveBeenCalledWith(
      {
        accessToken: "access-token-1",
        organizationId: "org-1",
        tenantId: "tenant-1",
        productId: "product-1"
      },
      expect.objectContaining({
        id: "task-1",
        createdAt: now,
        projectId: null,
        assignedToId: null,
        createdById: "user-1"
      })
    );
  });
});
