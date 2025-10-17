import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectsPage from "@/app/projects/page";

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
      fullName: "Owner Name"
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
    entitlements: []
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
  switchTenant: vi.fn(),
  refresh: vi.fn()
};

vi.mock("@/components/tenant-context", () => ({
  useTenantContext: () => mockTenantState
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("tenantId=tenant-1")
}));

describe("ProjectsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders projects and the add button", async () => {
    const makeResponse = <T,>(payload: T): Response =>
      ({
        ok: true,
        json: async () => payload
      }) as unknown as Response;

    vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/projects")) {
        return Promise.resolve(
          makeResponse({
            projects: [
              {
                id: "project-1",
                tenantId: "tenant-1",
                name: "Marketing",
                description: "Launch assets",
                color: "#6366F1",
                archivedAt: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            ],
            summaries: [
              {
                projectId: "project-1",
                name: "Marketing",
                openCount: 3,
                overdueCount: 1,
                completedCount: 2,
                scope: "project"
              }
            ],
            permissions: {
              canManage: true,
              canCreate: true,
              canView: true
            }
          })
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    render(<ProjectsPage />);

    await waitFor(() => expect(screen.getByText("Marketing")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Add Project/i })).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });
});
