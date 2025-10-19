"use client";

import { useMemo, useState, useTransition } from "react";
import type { SuperAdminBulkJob } from "@ma/contracts";

import { useTelemetry } from "@/components/providers/telemetry-provider";

const ACTION_OPTIONS = [
  { value: "ACTIVATE_USERS", label: "Activate users" },
  { value: "SUSPEND_USERS", label: "Suspend users" },
  { value: "EXPORT_USERS", label: "Export users" }
] as const;

type BulkAction = (typeof ACTION_OPTIONS)[number]["value"];

interface BulkOperationsPanelProps {
  initialJobs: SuperAdminBulkJob[];
  initialError?: string | null;
}

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const computeProgress = (job: SuperAdminBulkJob) => {
  if (job.totalCount === 0) return 0;
  return Math.round((job.completedCount / job.totalCount) * 100);
};

const STATUS_BADGES: Record<SuperAdminBulkJob["status"], string> = {
  PENDING: "border-amber-200 bg-amber-100/70 text-amber-800",
  RUNNING: "border-sky-200 bg-sky-100/70 text-sky-800",
  SUCCEEDED: "border-emerald-200 bg-emerald-100/70 text-emerald-800",
  FAILED: "border-rose-200 bg-rose-100/70 text-rose-800"
};

export const BulkOperationsPanel = ({ initialJobs, initialError = null }: BulkOperationsPanelProps) => {
  const [action, setAction] = useState<BulkAction>("ACTIVATE_USERS");
  const [userIds, setUserIds] = useState("");
  const [reason, setReason] = useState("");
  const [jobs, setJobs] = useState<SuperAdminBulkJob[]>(initialJobs);
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const telemetry = useTelemetry();

  const parsedUserIds = useMemo(() => {
    return userIds
      .split(/[\s,\n]+/)
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }, [userIds]);

  const refreshJobs = () => {
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/super-admin/bulk-jobs", { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`Failed to refresh jobs (${response.status})`);
          }
          const payload = (await response.json()) as { jobs: SuperAdminBulkJob[] };
          setJobs(payload.jobs);
          telemetry.recordEvent("bulk_jobs_refreshed", { jobCount: payload.jobs.length });
        } catch (refreshError) {
          console.error("Failed to refresh bulk jobs", refreshError);
        }
      })();
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (parsedUserIds.length === 0) {
      setError("Provide at least one user identifier.");
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/super-admin/bulk-jobs", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              action,
              userIds: parsedUserIds,
              reason: reason.trim() || undefined
            })
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error ?? `Request failed (${response.status})`);
          }

          const payload = (await response.json()) as SuperAdminBulkJob;
          setJobs((previous) => [payload, ...previous]);
          setSuccess("Bulk job queued successfully.");
          setError(null);
          setUserIds("");
          setReason("");
          telemetry.recordEvent("bulk_job_queued", {
            action,
            userCount: parsedUserIds.length,
            jobId: payload.id
          });
        } catch (requestError) {
          setSuccess(null);
          setError((requestError as Error).message);
          telemetry.recordEvent("bulk_job_queue_failed", {
            action,
            userCount: parsedUserIds.length,
            error: (requestError as Error).message
          });
        }
      })();
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Queue a bulk job</h2>
          <p className="text-sm text-muted-foreground">
            Apply high-volume changes across users. Jobs execute asynchronously; progress and errors are tracked below.
          </p>
        </header>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          {success ? (
            <p
              role="status"
              aria-live="polite"
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            >
              {success}
            </p>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Action</legend>
            <div className="flex flex-wrap gap-3">
              {ACTION_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${action === option.value ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
                >
                  <input
                    type="radio"
                    name="bulk-action"
                    value={option.value}
                    checked={action === option.value}
                    onChange={() => setAction(option.value)}
                    disabled={isPending}
                    className="h-4 w-4"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            User identifiers
            <textarea
              value={userIds}
              onChange={(event) => setUserIds(event.target.value)}
              placeholder="Paste user IDs or emails separated by commas or newlines"
              rows={4}
              disabled={isPending}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <span className="text-xs text-muted-foreground">
              {parsedUserIds.length} user{parsedUserIds.length === 1 ? "" : "s"} selected.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Reason (optional)
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={isPending}
              placeholder="Document why this job is being executed"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={refreshJobs}
              disabled={isPending}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            >
              Refresh jobs
            </button>
            <button
              type="submit"
              disabled={isPending || parsedUserIds.length === 0}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Queuing…" : "Queue job"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Recent jobs</h3>
            <p className="text-sm text-muted-foreground">Monitor progress, completion counts, and failures.</p>
          </div>
          <button
            type="button"
            onClick={refreshJobs}
            disabled={isPending}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            {isPending ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">Job</th>
                <th scope="col" className="px-4 py-3 text-left">Status</th>
                <th scope="col" className="px-4 py-3 text-left">Progress</th>
                <th scope="col" className="px-4 py-3 text-left">Initiated</th>
                <th scope="col" className="px-4 py-3 text-left">Updated</th>
                <th scope="col" className="px-4 py-3 text-left">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No jobs have run yet. Queue a job above to get started.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const progress = computeProgress(job);
                  return (
                    <tr key={job.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{job.id}</div>
                        <div className="text-xs uppercase text-muted-foreground">{job.action.replace(/_/g, " ")}</div>
                        <div className="text-xs text-muted-foreground">Initiated by {job.initiatedBy.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[job.status]}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-muted-foreground">
                          {job.completedCount} / {job.totalCount} completed
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-muted">
                          <div
                            className={`h-2 rounded-full bg-primary transition-[width]`}
                            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatTimestamp(job.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatTimestamp(job.updatedAt)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {job.errorMessage ? job.errorMessage : job.failedCount > 0 ? `${job.failedCount} failures` : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
