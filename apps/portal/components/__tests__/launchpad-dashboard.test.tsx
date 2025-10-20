import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { LaunchpadDashboard } from "../launchpad-dashboard";

const baseProps = {
  stats: [
    { label: "Tenants", value: 2, description: "Accessible workspaces." },
    { label: "Active sessions", value: 5, description: "Current sessions." },
    { label: "Members", value: 42, description: "Members across tenants." }
  ],
  adminActions: [
    {
      id: "action-1",
      eventType: "ADMIN_ACTION",
      description: "Suspended user jane@example.com.",
      createdAt: new Date().toISOString(),
      actor: { id: "admin-1", email: "admin@example.com", name: "Admin User" },
      tenant: { id: "tenant-1", name: "Core" },
      metadata: { reason: "policy_violation" }
    }
  ],
  notifications: [
    {
      id: "notification-1",
      type: "bulk-job" as const,
      title: "Bulk export ready",
      description: "Download the CSV before it expires.",
      createdAt: new Date().toISOString(),
      actionUrl: "https://example.com/export.csv",
      meta: { status: "SUCCEEDED" }
    }
  ],
  supportLinks: [
    {
      label: "Tenant Support Runbook",
      href: "/docs/operations/runbooks/identity",
      description: "Escalation steps and safeguards.",
      external: false
    }
  ]
};

describe("LaunchpadDashboard", () => {
  it("renders sections with provided data", () => {
    render(<LaunchpadDashboard {...baseProps} />);

    expect(screen.getByText("Organization snapshot")).toBeInTheDocument();
    expect(screen.getByText("Recent admin actions")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Quick links")).toBeInTheDocument();
    expect(screen.getByText("Tenant Support Runbook")).toBeInTheDocument();
  });

  it("is accessible", async () => {
    const { container } = render(<LaunchpadDashboard {...baseProps} />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
