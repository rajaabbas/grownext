import { describe, expect, it, vi } from "vitest";

import { processSuperAdminBulkJob, type BulkJobMetric } from "./super-admin-bulk-job";

describe("processSuperAdminBulkJob", () => {
  it("completes export jobs successfully", async () => {
    const updateJob = vi.fn(async (jobId: string, payload: Record<string, unknown>) => {
      void jobId;
      void payload;
    });
    const publishMetric = vi.fn(async (metric: BulkJobMetric) => {
      void metric;
    });

    await processSuperAdminBulkJob(
      {
        jobId: "job-1",
        action: "EXPORT_USERS",
        userIds: ["user-1", "user-2"]
      },
      { updateJob, publishMetric }
    );

    const finalCall = updateJob.mock.calls.at(-1);
    expect(finalCall).toBeDefined();
    if (!finalCall) {
      throw new Error("updateJob mock was not called");
    }
    const [jobId, payload] = finalCall;
    expect(jobId).toBe("job-1");
    expect(payload).toEqual(
      expect.objectContaining({
        status: "SUCCEEDED",
        completedCount: 2,
        failedCount: 0,
        resultUrl: expect.stringContaining("data:text/csv"),
        resultExpiresAt: expect.any(String)
      })
    );
    expect(publishMetric).toHaveBeenCalled();
  });

  it("captures failures for problematic users", async () => {
    const updateJob = vi.fn(async (jobId: string, payload: Record<string, unknown>) => {
      void jobId;
      void payload;
    });

    await processSuperAdminBulkJob(
      {
        jobId: "job-2",
        action: "ACTIVATE_USERS",
        userIds: ["user-1", "fail:user-2"]
      },
      { updateJob }
    );

    const finalCall = updateJob.mock.calls.at(-1);
    expect(finalCall).toBeDefined();
    if (!finalCall) {
      throw new Error("updateJob mock was not called");
    }
    const [jobId, payload] = finalCall;
    expect(jobId).toBe("job-2");
    expect(payload).toEqual(
      expect.objectContaining({
        status: "FAILED",
        failedCount: 1,
        failureDetails: expect.arrayContaining([expect.objectContaining({ userId: "fail:user-2" })])
      })
    );
  });
});
