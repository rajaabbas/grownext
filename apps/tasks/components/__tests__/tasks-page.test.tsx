import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TasksPage from "@/app/page";

describe("TasksPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders the tasks heading", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [] })
    } as any);

    render(<TasksPage />);
    expect(await screen.findByText(/Tasks/)).toBeInTheDocument();
  });
});
