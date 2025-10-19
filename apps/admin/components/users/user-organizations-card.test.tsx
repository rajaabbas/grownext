import { render, screen } from "@testing-library/react";
import type { SuperAdminOrganizationDetail } from "@ma/contracts";
import { UserOrganizationsCard } from "./user-organizations-card";

describe("UserOrganizationsCard", () => {
  it("lists organizations and tenants", () => {
    const organizations: SuperAdminOrganizationDetail[] = [
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
    ];

    render(<UserOrganizationsCard organizations={organizations} />);

    expect(screen.getByText(/Acme/)).toBeInTheDocument();
    expect(screen.getByText(/Tenant One/)).toBeInTheDocument();
  });
});
