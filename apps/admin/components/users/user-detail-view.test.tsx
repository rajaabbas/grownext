import { render, screen } from "@testing-library/react";
import type { SuperAdminUserDetail } from "@ma/contracts";
import { UserDetailView } from "./user-detail-view";

describe("UserDetailView", () => {
  it("renders profile summary and related sections", () => {
    const now = new Date().toISOString();
    const detail: SuperAdminUserDetail = {
      id: "user-1",
      email: "user@example.com",
      fullName: "User Example",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      organizations: [
        {
          id: "org-1",
          name: "Acme",
          slug: "acme",
          role: "ADMIN",
          tenants: [
            {
              id: "tenant-1",
              name: "Tenant One",
              slug: "tenant-one",
              role: "ADMIN"
            }
          ]
        }
      ],
      entitlements: [],
      auditEvents: [],
      samlAccounts: []
    };

    render(<UserDetailView initialDetail={detail} />);

    expect(screen.getByText(/User Example/)).toBeInTheDocument();
    expect(screen.getAllByText(/Tenant One/)[0]).toBeInTheDocument();
    expect(screen.getByText(/Account status/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Update status/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Generate session/i })).toBeInTheDocument();
  });

  it("renders read-only notice when management is disabled", () => {
    const now = new Date().toISOString();
    const detail: SuperAdminUserDetail = {
      id: "user-1",
      email: "user@example.com",
      fullName: "User Example",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      organizations: [],
      entitlements: [],
      auditEvents: [],
      samlAccounts: []
    };

    render(<UserDetailView initialDetail={detail} canManageAccess={false} />);

    expect(screen.getByText(/read-only access/i)).toBeInTheDocument();
    expect(screen.queryByText(/Account status/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Update role/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Add entitlement/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Update status/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate session/i })).not.toBeInTheDocument();
  });
});
