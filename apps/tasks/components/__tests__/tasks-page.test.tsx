import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TasksPage from "@/app/page";

describe("TasksPage", () => {
  it("renders the tasks heading", () => {
    render(<TasksPage />);
    expect(screen.getByText(/Tasks/)).toBeInTheDocument();
  });
});
