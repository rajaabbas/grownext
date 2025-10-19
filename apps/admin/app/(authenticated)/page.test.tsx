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
  const actual = await original();
  return {
    ...actual,
    redirect: vi.fn()
  };
});

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
