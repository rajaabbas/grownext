import { render, screen } from "@testing-library/react";

import { BulkOperationsPanel } from "./bulk-operations-panel";

const buildJob = () => ({
  id: "job-1",
  action: "ACTIVATE_USERS" as const,
  status: "PENDING" as const,
  totalCount: 3,
  completedCount: 0,
  failedCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  initiatedBy: { id: "admin-1", email: "admin@example.com" },
  errorMessage: null,
  reason: null,
  progressMessage: null,
  progressUpdatedAt: null,
  failureDetails: [],
  resultUrl: null,
  resultExpiresAt: null
});

describe("BulkOperationsPanel", () => {
  it("renders existing jobs", () => {
    render(<BulkOperationsPanel initialJobs={[buildJob()]} />);

    expect(screen.getByText(/job-1/)).toBeInTheDocument();
    expect(screen.getByText(/Queue job/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Status/i)).toBeInTheDocument();
  });
});
