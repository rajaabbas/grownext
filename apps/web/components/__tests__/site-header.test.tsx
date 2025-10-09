import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "../site-header";

vi.mock("@supabase/auth-helpers-react", () => ({
  useSupabaseClient: () => ({
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null })
    }
  })
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  })
}));

describe("SiteHeader", () => {
  it("renders guest navigation", () => {
    render(<SiteHeader isAuthenticated={false} />);

    expect(screen.getByText("GrowNext")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Login/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign Up/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Logout/i })).not.toBeInTheDocument();
  });

  it("renders authenticated navigation", () => {
    render(<SiteHeader isAuthenticated={true} />);

    expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Organization/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Profile/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Logout/i })).toBeInTheDocument();
  });
});
