import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders existing jobs", () => {
    render(<BulkOperationsPanel initialJobs={[buildJob()]} />);

    expect(screen.getByText(/job-1/)).toBeInTheDocument();
    expect(screen.getByText(/Queue job/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Status/i)).toBeInTheDocument();
  });

  it("shows rate limit feedback when bulk jobs are throttled", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: {
        get: (name: string) => (name.toLowerCase() === "retry-after" ? "75" : null)
      } as Headers,
      json: async () => ({ error: "rate_limited" })
    }));

    global.fetch = fetchMock as unknown as typeof fetch;

    render(<BulkOperationsPanel initialJobs={[]} />);

    fireEvent.change(screen.getByLabelText(/User identifiers/i), { target: { value: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Queue job/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Too many bulk job requests\. Try again in about 1 minute\./i)
      ).toBeInTheDocument();
    });
  });
});
