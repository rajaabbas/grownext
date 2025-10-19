import { render, screen } from "@testing-library/react";

import type { SuperAdminAuditLogResponse } from "@ma/contracts";
import { AuditExplorer } from "./audit-explorer";

const buildResponse = (): SuperAdminAuditLogResponse => ({
  events: [
    {
      id: "event-1",
      eventType: "USER_SUSPENDED",
      description: "Suspended via admin",
      organizationId: "org-1",
      tenantId: null,
      productId: null,
      metadata: { actorEmail: "admin@example.com" },
      createdAt: new Date().toISOString()
    }
  ],
  pagination: {
    page: 1,
    pageSize: 25,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  }
});

describe("AuditExplorer", () => {
  it("renders audit events", () => {
    render(<AuditExplorer initialData={buildResponse()} canExport />);

    expect(screen.getAllByText(/USER_SUSPENDED/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/admin@example.com/)[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export CSV/i })).toBeInTheDocument();
  });
});
