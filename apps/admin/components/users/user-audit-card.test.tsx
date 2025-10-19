import { render, screen } from "@testing-library/react";
import type { SuperAdminAuditEvent } from "@ma/contracts";
import { UserAuditCard } from "./user-audit-card";

describe("UserAuditCard", () => {
  it("renders audit events", () => {
    const events: SuperAdminAuditEvent[] = [
      {
        id: "audit-1",
        eventType: "ADMIN_ACTION",
        description: "User promoted",
        organizationId: "org-1",
        tenantId: null,
        productId: null,
        metadata: null,
        createdAt: new Date("2024-01-01T00:00:00Z").toISOString()
      }
    ];

    render(<UserAuditCard events={events} />);

    expect(screen.getByText(/User promoted/)).toBeInTheDocument();
    expect(screen.getByText(/ADMIN_ACTION/)).toBeInTheDocument();
  });
});
