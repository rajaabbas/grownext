import { render, screen } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { vi } from "vitest";

const mockSession = {
  user: {
    id: "user-1",
    email: "admin@example.com",
    app_metadata: { roles: ["super-admin"] },
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString()
  }
} satisfies Partial<Session>;

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerComponentClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: mockSession },
        error: null
      })
    }
  })
}));

vi.mock("next/navigation", async (original) => {
  const actual = (await original()) as Record<string, unknown>;
  return {
    ...actual,
    redirect: vi.fn()
  };
});

vi.mock("@/lib/identity", () => ({
  getAuditLogs: vi.fn().mockResolvedValue({
    events: [
      {
        id: "event-1",
        eventType: "IMPERSONATION_STOPPED",
        description: "Impersonation session stopped",
        organizationId: null,
        tenantId: null,
        productId: null,
        metadata: { actorEmail: "admin@example.com" },
        createdAt: new Date().toISOString()
      }
    ],
    pagination: {
      page: 1,
      pageSize: 1,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    }
  })
}));

import HomePage from "./page";

describe("HomePage", () => {
  it("renders quick links for primary workflows", async () => {
    render(await HomePage());

    expect(screen.getByText(/Super Admin console/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Manage Users/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Audit Activity/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Admin Settings/i })).toBeInTheDocument();
  });
});
