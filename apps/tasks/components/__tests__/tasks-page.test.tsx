import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TasksPage from "@/app/page";

const mockTenantState = {
  context: {
    activeTenant: {
      tenantId: "tenant-1",
      tenantName: "Tenant One",
      entitlementId: "ent-1",
      roles: ["ADMIN"],
      source: "fallback"
    },
    tenants: [
      {
        id: "tenant-1",
        name: "Tenant One",
        slug: "tenant-one",
        description: null,
        membersCount: 5,
        productsCount: 2
      }
    ],
    projects: [],
    projectSummaries: [],
    permissions: {
      roles: ["ADMIN"],
      effective: {
        canView: true,
        canCreate: true,
        canEdit: true,
        canComment: true,
        canAssign: true,
        canManage: true
      }
    },
    user: {
      id: "user-1",
      email: "owner@example.com",
      fullName: "Owner Name",
      status: "ACTIVE"
    },
    product: {
      id: "product-1",
      slug: "tasks",
      name: "Tasks"
    },
    organization: {
      id: "org-1",
      name: "Org",
      slug: "org"
    },
    entitlements: [],
    notifications: []
  },
  loading: false,
  error: null,
  activeTenantId: "tenant-1",
  tenants: [
    {
      id: "tenant-1",
      name: "Tenant One",
      slug: "tenant-one",
      description: null,
      membersCount: 5,
      productsCount: 2
    }
  ],
  userStatus: "ACTIVE",
  isReadOnly: false,
  notifications: [],
  switchTenant: vi.fn(),
  refresh: vi.fn()
};

vi.mock("@/components/tenant-context", () => ({
  useTenantContext: () => mockTenantState
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("tenantId=tenant-1")
}));

describe("TasksPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders the tasks heading", async () => {
    const makeResponse = <T,>(payload: T): Response =>
      ({
        ok: true,
        json: async () => payload
      }) as unknown as Response;

    vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/users")) {
        return Promise.resolve(makeResponse({ users: [] }));
      }
      if (url.includes("/api/projects")) {
        return Promise.resolve(
          makeResponse({
            projects: [],
            summaries: []
          })
        );
      }
      if (url.includes("/api/tasks")) {
        return Promise.resolve(
          makeResponse({
            view: "list",
            projectId: null,
            search: null,
            tasks: [],
            stats: { total: 0, completed: 0, overdue: 0 },
            board: null,
            permissions: {
              canView: true,
              canCreate: true,
              canEdit: true,
              canComment: true,
              canAssign: true,
              canManage: true
            },
            currentUserId: "user-1"
          })
        );
      }
      return Promise.resolve(makeResponse({}));
    });

    render(<TasksPage />);
    expect(await screen.findByRole("heading", { name: "Tasks" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "New Project" })).toBeInTheDocument();
  });

  it("shows the inline task creator when creation is allowed", async () => {
    const makeResponse = <T,>(payload: T): Response =>
      ({
        ok: true,
        json: async () => payload
      }) as unknown as Response;

    vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/users")) {
        return Promise.resolve(makeResponse({ users: [] }));
      }
      if (url.includes("/api/projects")) {
        return Promise.resolve(
          makeResponse({
            projects: [],
            summaries: []
          })
        );
      }
      if (url.includes("/api/tasks")) {
        return Promise.resolve(
          makeResponse({
            view: "list",
            projectId: null,
            search: null,
            tasks: [],
            stats: { total: 0, completed: 0, overdue: 0 },
            board: null,
            permissions: {
              canView: true,
              canCreate: true,
              canEdit: true,
              canComment: true,
              canAssign: true,
              canManage: true
            },
            currentUserId: "user-1"
          })
        );
      }
      return Promise.resolve(makeResponse({}));
    });

    render(<TasksPage />);
    expect(await screen.findByPlaceholderText("Click Here To Add A Task")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Add task/i })).toBeInTheDocument();
  });
});
