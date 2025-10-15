import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TasksPage from "@/app/page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("tenantId=tenant-1")
}));

describe("TasksPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders the tasks heading", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ tasks: [] })
    } satisfies Pick<Response, "ok" | "json">;

    vi.spyOn(global, "fetch").mockResolvedValue(mockResponse as Response);

    render(<TasksPage />);
    expect(await screen.findByText(/Tasks/)).toBeInTheDocument();
  });
});
