import { render, screen } from "@testing-library/react";
import type { SuperAdminEntitlement } from "@ma/contracts";
import { UserEntitlementsCard } from "./user-entitlements-card";

describe("UserEntitlementsCard", () => {
  it("renders table rows for entitlements", () => {
    const entitlements: SuperAdminEntitlement[] = [
      {
        id: "ent-1",
        organizationId: "org-1",
        tenantId: "tenant-1",
        tenantName: "Tenant One",
        productId: "prod-1",
        productSlug: "tasks",
        productName: "Tasks",
        roles: ["ADMIN"],
        expiresAt: null,
        createdAt: new Date("2024-01-01T00:00:00Z").toISOString()
      }
    ];

    render(
      <UserEntitlementsCard
        entitlements={entitlements}
        organizations={[
          {
            id: "org-1",
            name: "Acme",
            slug: "acme",
            role: "ADMIN",
            tenants: [{ id: "tenant-1", name: "Tenant One", slug: "tenant-one", role: "ADMIN" }]
          }
        ]}
        onGrant={() => undefined}
      />
    );

    expect(screen.getByText(/Tasks/)).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: /Tenant One/ })).toBeInTheDocument();
    expect(screen.getAllByText(/ADMIN/)[0]).toBeInTheDocument();
  });

  it("disables grant button when required fields are missing", () => {
    render(
      <UserEntitlementsCard
        entitlements={[]}
        organizations={[
          {
            id: "org-1",
            name: "Acme",
            slug: "acme",
            role: "ADMIN",
            tenants: [{ id: "tenant-1", name: "Tenant One", slug: "tenant-one", role: "ADMIN" }]
          }
        ]}
        onGrant={() => undefined}
      />
    );

    const button = screen.getByRole("button", { name: /Add entitlement/i });
    expect(button).toBeDisabled();
  });
});
