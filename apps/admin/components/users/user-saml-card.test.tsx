import { render, screen } from "@testing-library/react";
import type { SuperAdminSamlAccount } from "@ma/contracts";
import { UserSamlCard } from "./user-saml-card";

describe("UserSamlCard", () => {
  it("renders SAML account details", () => {
    const accounts: SuperAdminSamlAccount[] = [
      {
        id: "saml-1",
        samlConnectionId: "conn-1",
        samlConnectionLabel: "Okta",
        nameId: "user@example.com",
        email: "user@example.com",
        createdAt: new Date("2024-01-01T00:00:00Z").toISOString()
      }
    ];

    render(<UserSamlCard samlAccounts={accounts} />);

    expect(screen.getByText(/Okta/)).toBeInTheDocument();
    expect(screen.getByText(/conn-1/)).toBeInTheDocument();
  });
});
