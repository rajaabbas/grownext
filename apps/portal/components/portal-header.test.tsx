import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PortalPermission } from "@ma/contracts";
import { PortalHeader } from "./portal-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/"
}));

const baseUser = {
  email: "user@example.com",
  fullName: "User Example",
  organization: "Example Org"
};

describe("PortalHeader", () => {
  it("omits billing nav when feature flag disabled", () => {
    const permissions = new Set<PortalPermission>(["organization:billing"]);
    render(<PortalHeader user={baseUser} permissions={permissions} billingEnabled={false} />);

    expect(screen.queryByText("Billing")).not.toBeInTheDocument();
  });

  it("renders billing nav when enabled and permission granted", () => {
    const permissions = new Set<PortalPermission>(["organization:billing"]);
    render(<PortalHeader user={baseUser} permissions={permissions} billingEnabled />);

    const link = screen.getByRole("link", { name: "Billing" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/billing");
  });
});
