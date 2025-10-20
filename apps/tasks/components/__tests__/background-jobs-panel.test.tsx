import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BackgroundJobsPanel } from "@/components/background-jobs-panel";

describe("BackgroundJobsPanel", () => {
  it("renders notification entries", () => {
    render(
      <BackgroundJobsPanel
        notifications={[
          {
            id: "notif-1",
            type: "bulk-job",
            title: "Suspension job succeeded",
            description: "4 users processed.",
            createdAt: new Date().toISOString(),
            actionUrl: null,
            meta: { jobId: "job-1" }
          }
        ]}
      />
    );

    expect(screen.getByText("Suspension job succeeded")).toBeInTheDocument();
    expect(screen.getByText(/Worker runbook/)).toBeInTheDocument();
  });

  it("renders nothing when list is empty", () => {
    const { container } = render(<BackgroundJobsPanel notifications={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
