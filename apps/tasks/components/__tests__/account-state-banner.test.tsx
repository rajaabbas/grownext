import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountStateBanner } from "@/components/account-state-banner";

describe("AccountStateBanner", () => {
  it("renders nothing when status is active", () => {
    const { container } = render(<AccountStateBanner status="ACTIVE" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows copy for suspended users", () => {
    render(<AccountStateBanner status="SUSPENDED" />);
    expect(screen.getByText(/Account suspended/i)).toBeInTheDocument();
  });
});
