"use client";

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

const mockSwitchTenant = vi.fn();

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

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams()
}));

describe("AppShell", () => {
  it("renders navigation items and profile menu", async () => {
    render(
      <AppShell>
        <div data-testid="content">Content</div>
      </AppShell>
    );

    expect(screen.getAllByRole("link", { name: "Projects" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Tasks" })[0]).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Task Templates" })).toBeNull();
    expect(screen.getByRole("combobox")).toHaveValue("tenant-1");

    const profileButton = screen.getByRole("button", { name: /user menu/i });
    fireEvent.click(profileButton);

    expect(screen.queryByRole("menuitem", { name: "Settings" })).not.toBeInTheDocument();
    expect(await screen.findByRole("menuitem", { name: "Logout" })).toBeInTheDocument();
  });
});
