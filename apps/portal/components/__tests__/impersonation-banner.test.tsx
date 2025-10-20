import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { ImpersonationBanner } from "../impersonation-banner";

const impersonation = {
  tokenId: "token-1",
  startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  reason: "Support ticket 123",
  productSlug: "portal",
  initiatedBy: {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin User"
  }
};

describe("ImpersonationBanner", () => {
  it("renders impersonation details", () => {
    render(<ImpersonationBanner impersonation={impersonation} />);
    expect(
      screen.getByText(/You are currently being impersonated/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Support ticket 123/)).toBeInTheDocument();
  });

  it("is accessible", async () => {
    const { container } = render(<ImpersonationBanner impersonation={impersonation} />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
