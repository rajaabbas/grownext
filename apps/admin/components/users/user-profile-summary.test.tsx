import { render, screen } from "@testing-library/react";
import type { SuperAdminUserDetail } from "@ma/contracts";
import { UserProfileSummary } from "./user-profile-summary";

const buildUser = (overrides: Partial<SuperAdminUserDetail> = {}): SuperAdminUserDetail => ({
  id: "user-1",
  email: "user@example.com",
  fullName: "User Example",
  status: "ACTIVE",
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
  updatedAt: new Date("2024-02-01T00:00:00Z").toISOString(),
  lastActivityAt: new Date("2024-03-01T00:00:00Z").toISOString(),
  organizations: [],
  entitlements: [],
  auditEvents: [],
  samlAccounts: [],
  ...overrides
});

describe("UserProfileSummary", () => {
  it("renders basic profile information", () => {
    const user = buildUser();
    render(<UserProfileSummary user={user} />);

    expect(screen.getByText(/User Example/)).toBeInTheDocument();
    expect(screen.getByText(/user@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/Active/i)).toBeInTheDocument();
  });
});
