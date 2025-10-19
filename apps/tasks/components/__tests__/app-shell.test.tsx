"use client";

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

const mockSwitchTenant = vi.fn();
const mockRouter = {
  replace: vi.fn(),
  refresh: vi.fn()
};
const mockSignOut = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/components/tenant-context", () => ({
  useTenantContext: () => ({
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
      ]
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
    switchTenant: mockSwitchTenant,
    refresh: vi.fn()
  })
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    auth: {
      signOut: mockSignOut
    }
  })
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => mockRouter
}));

describe("AppShell", () => {
  beforeEach(() => {
    mockRouter.replace.mockReset();
    mockRouter.refresh.mockReset();
    mockSignOut.mockReset();
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("renders navigation items and profile menu", async () => {
    render(
      <AppShell>
        <div data-testid="content">Content</div>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "My Tasks" })).toHaveAttribute("href", "/my-tasks");
    expect(screen.getAllByRole("link", { name: "Projects" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Tasks" })[0]).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("link", { name: "Task Templates" })).toBeNull();
    expect(screen.getByRole("combobox")).toHaveValue("tenant-1");

    const profileButton = screen.getByRole("button", { name: /user menu/i });
    fireEvent.click(profileButton);

    expect(screen.queryByRole("menuitem", { name: "Settings" })).not.toBeInTheDocument();
    expect(await screen.findByRole("menuitem", { name: "Logout" })).toBeInTheDocument();
  });

  it("signs out and refreshes the page on logout", async () => {
    render(
      <AppShell>
        <div data-testid="content">Content</div>
      </AppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: /user menu/i }));
    const logoutButton = await screen.findByRole("menuitem", { name: "Logout" });

    fireEvent.click(logoutButton);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith("/");
      expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
    });
  });
});
