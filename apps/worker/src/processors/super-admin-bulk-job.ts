"use strict";

import { Buffer } from "node:buffer";
import { z } from "zod";
import { logger } from "@ma/core";
import {
  SuperAdminBulkActionSchema,
  type SuperAdminBulkJobUpdateRequest
} from "@ma/contracts";

const payloadSchema = z.object({
  jobId: z.string().min(1),
  action: SuperAdminBulkActionSchema,
  userIds: z.array(z.string().min(1)),
  reason: z.string().nullable().optional(),
  initiatedById: z.string().min(1).optional(),
  initiatedByEmail: z.string().email().optional(),
  requestedAt: z.string().datetime({ offset: true }).optional(),
  context: z.enum(["initial", "retry"]).optional()
});

export interface BulkJobMetric {
  jobId: string;
  status: string;
  completedCount: number;
  failedCount: number;
  totalCount: number;
  timestamp: string;
}

export interface SuperAdminBulkJobProcessorDeps {
  updateJob: (jobId: string, update: SuperAdminBulkJobUpdateRequest) => Promise<unknown>;
  publishMetric?: (metric: BulkJobMetric) => Promise<void>;
}

const defaultPublishMetric = async () => {};

const buildExportCsv = (userIds: string[]): string => {
  const header = "user_id,exported_at";
  const rows = userIds.map((userId) => `${userId},${new Date().toISOString()}`);
  return [header, ...rows].join("\n");
};

export const processSuperAdminBulkJob = async (
  rawPayload: unknown,
  deps: SuperAdminBulkJobProcessorDeps
): Promise<void> => {
  const payload = payloadSchema.parse(rawPayload);
  const totalCount = payload.userIds.length;
  const publishMetric = deps.publishMetric ?? defaultPublishMetric;

  logger.info(
    {
      jobId: payload.jobId,
      action: payload.action,
      totalCount,
      context: payload.context ?? "initial"
    },
    "Processing super admin bulk job"
  );

  if (totalCount === 0) {
    await deps.updateJob(payload.jobId, {
      status: "SUCCEEDED",
      completedCount: 0,
      failedCount: 0,
      progressMessage: "No user identifiers provided"
    });
    await publishMetric({
      jobId: payload.jobId,
      status: "SUCCEEDED",
      completedCount: 0,
      failedCount: 0,
      totalCount,
      timestamp: new Date().toISOString()
    });
    return;
  }

  let completedCount = 0;
  let failedCount = 0;
  const failureDetails: Array<{ userId: string; reason: string | null }> = [];

  await deps.updateJob(payload.jobId, {
    status: "RUNNING",
    completedCount,
    failedCount,
    progressMessage: `Processing ${totalCount} user${totalCount === 1 ? "" : "s"}`
  });

  await publishMetric({
    jobId: payload.jobId,
    status: "RUNNING",
    completedCount,
    failedCount,
    totalCount,
    timestamp: new Date().toISOString()
  });

  const exportRows: string[] = [];

  for (const userId of payload.userIds) {
    try {
      if (userId.toLowerCase().startsWith("fail:")) {
        throw new Error("Simulated failure");
      }

      // Simulate action execution; in a real system this would call identity APIs.
      if (payload.action === "EXPORT_USERS") {
        exportRows.push(userId);
      }

      completedCount += 1;
      await deps.updateJob(payload.jobId, {
        completedCount,
        failedCount,
        progressMessage: `Processed ${completedCount}/${totalCount}`
      });
    } catch (error) {
      failedCount += 1;
      const reason = error instanceof Error ? error.message : "Unknown failure";
      failureDetails.push({
        userId,
        reason
      });

      await deps.updateJob(payload.jobId, {
        completedCount,
        failedCount,
        failureDetails,
        progressMessage: `Encountered ${failedCount} failure${failedCount === 1 ? "" : "s"}`
      });
    }

    await publishMetric({
      jobId: payload.jobId,
      status: "RUNNING",
      completedCount,
      failedCount,
      totalCount,
      timestamp: new Date().toISOString()
    });
  }

  const jobSucceeded = failedCount === 0;
  const finalUpdate: SuperAdminBulkJobUpdateRequest = {
    status: jobSucceeded ? "SUCCEEDED" : "FAILED",
    completedCount,
    failedCount,
    failureDetails,
    progressMessage: jobSucceeded
      ? "Bulk job completed successfully"
      : "Bulk job completed with failures",
    errorMessage: jobSucceeded ? null : "One or more operations failed"
  };

  if (jobSucceeded && payload.action === "EXPORT_USERS") {
    const csv = buildExportCsv(exportRows);
    finalUpdate.resultUrl = `data:text/csv;base64,${Buffer.from(csv, "utf8").toString("base64")}`;
    finalUpdate.resultExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    finalUpdate.progressMessage = "Export available for download";
  }

  await deps.updateJob(payload.jobId, finalUpdate);

  await publishMetric({
    jobId: payload.jobId,
    status: finalUpdate.status ?? "SUCCEEDED",
    completedCount,
    failedCount,
    totalCount,
    timestamp: new Date().toISOString()
  });

  logger.info(
    {
      jobId: payload.jobId,
      status: finalUpdate.status ?? "SUCCEEDED",
      completedCount,
      failedCount
    },
    "Super admin bulk job processed"
  );
};
