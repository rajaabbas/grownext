"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type KeyboardEvent,
  type MouseEvent
} from "react";
import type { SuperAdminBulkJob } from "@ma/contracts";

import { useTelemetry } from "@/components/providers/telemetry-provider";
import { formatRateLimitMessage } from "@/lib/rate-limit";

const ACTION_OPTIONS = [
  { value: "ACTIVATE_USERS", label: "Activate users" },
  { value: "SUSPEND_USERS", label: "Suspend users" },
  { value: "EXPORT_USERS", label: "Export users" }
] as const;

type BulkAction = (typeof ACTION_OPTIONS)[number]["value"];

const STATUS_FILTERS = [
  { value: "ALL" as const, label: "All statuses" },
  { value: "PENDING" as const, label: "Pending" },
  { value: "RUNNING" as const, label: "Running" },
  { value: "SUCCEEDED" as const, label: "Succeeded" },
  { value: "FAILED" as const, label: "Failed" }
];

const ACTION_FILTERS = [
  { value: "ALL" as const, label: "All actions" },
  ...ACTION_OPTIONS
];

type StatusFilter = "ALL" | SuperAdminBulkJob["status"];
type ActionFilter = "ALL" | BulkAction;

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("ALL");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const telemetry = useTelemetry();

  const parsedUserIds = useMemo(() => {
    return userIds
      .split(/[\s,\n]+/)
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }, [userIds]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const statusMatches = statusFilter === "ALL" || job.status === statusFilter;
      const actionMatches = actionFilter === "ALL" || job.action === actionFilter;
      return statusMatches && actionMatches;
    });
  }, [actionFilter, jobs, statusFilter]);

  const selectedJob = useMemo(() => {
    if (!selectedJobId) {
      return null;
    }
    return jobs.find((job) => job.id === selectedJobId) ?? null;
  }, [jobs, selectedJobId]);

  const hasInFlightJobs = useMemo(
    () => jobs.some((job) => job.status === "PENDING" || job.status === "RUNNING"),
    [jobs]
  );

  const refreshJobs = useCallback(
    async (options?: { silent?: boolean }) => {
      try {
        if (!options?.silent) {
          setIsRefreshing(true);
        }
        const response = await fetch("/api/super-admin/bulk-jobs", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to refresh jobs (${response.status})`);
        }
        const payload = (await response.json()) as { jobs: SuperAdminBulkJob[] };
        setJobs(payload.jobs);
        setLastRefreshedAt(new Date().toISOString());
        telemetry.recordEvent("bulk_jobs_refreshed", {
          jobCount: payload.jobs.length,
          source: options?.silent ? "poll" : "manual"
        });
      } catch (refreshError) {
        console.error("Failed to refresh bulk jobs", refreshError);
      } finally {
        setIsRefreshing(false);
      }
    },
    [telemetry]
  );

  useEffect(() => {
    if (!hasInFlightJobs) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshJobs({ silent: true });
    }, 5_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasInFlightJobs, refreshJobs]);

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
            const rateLimited = response.status === 429;
            const errorMessage = rateLimited
              ? formatRateLimitMessage("bulk job", response.headers.get("retry-after"))
              : (payload?.message as string | undefined) ?? (payload?.error as string | undefined);

            throw new Error(errorMessage ?? `Request failed (${response.status})`);
          }

          const payload = (await response.json()) as SuperAdminBulkJob;
          setJobs((previous) => [payload, ...previous.filter((job) => job.id !== payload.id)]);
          setSelectedJobId(payload.id);
          setLastRefreshedAt(new Date().toISOString());
          setSuccess("Bulk job queued successfully.");
          setError(null);
          setUserIds("");
          setReason("");
          telemetry.recordEvent("bulk_job_queued", {
            action,
            userCount: parsedUserIds.length,
            jobId: payload.id
          });
          void refreshJobs({ silent: true });
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
            className="size-4"
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
            onClick={() => {
              void refreshJobs();
            }}
            disabled={isRefreshing}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Action
              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value as ActionFilter)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {ACTION_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="text-xs text-muted-foreground">
            Last updated: {lastRefreshedAt ? formatTimestamp(lastRefreshedAt) : "—"}
          </div>
        </div>

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
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {jobs.length === 0
                      ? "No jobs have run yet. Queue a job above to get started."
                      : "No jobs match the current filters."}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  const progress = computeProgress(job);
                  return (
                    <tr
                      key={job.id}
                      className="cursor-pointer transition hover:bg-muted/40"
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{job.id}</div>
                        <div className="text-xs uppercase text-muted-foreground">{job.action.replace(/_/g, " ")}</div>
                        <div className="text-xs text-muted-foreground">Initiated by {job.initiatedBy.email}</div>
                        {job.reason ? (
                          <div className="text-xs text-muted-foreground">Reason: {job.reason}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[job.status]}`}>
                          {job.status}
                        </span>
                        {job.progressMessage ? (
                          <div className="mt-1 text-xs text-muted-foreground">{job.progressMessage}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-muted-foreground">
                          {job.completedCount} / {job.totalCount} completed
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary transition-[width]"
                            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatTimestamp(job.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatTimestamp(job.updatedAt)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div className="space-y-1">
                          <div>
                            {job.errorMessage
                              ? job.errorMessage
                              : job.failedCount > 0
                                ? `${job.failedCount} failure${job.failedCount === 1 ? "" : "s"}`
                                : "—"}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedJobId(job.id);
                              }}
                              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                            >
                              View details
                            </button>
                            {job.action === "EXPORT_USERS" && job.resultUrl ? (
                              <a
                                href={job.resultUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                              >
                                Download CSV
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <BulkJobDetailDrawer job={selectedJob} onClose={() => setSelectedJobId(null)} />
    </div>
  );
};

interface BulkJobDetailDrawerProps {
  job: SuperAdminBulkJob | null;
  onClose: () => void;
}

const BulkJobDetailDrawer = ({ job, onClose }: BulkJobDetailDrawerProps) => {
  if (!job) {
    return null;
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleBackdropKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClose();
    }
  };

  const exportExpiryText = job.resultExpiresAt
    ? `Link expires ${formatTimestamp(job.resultExpiresAt)}.`
    : "Link remains available until regenerated.";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Close bulk job details"
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 px-4 py-6"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl rounded-t-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Bulk job</p>
            <h4 className="text-lg font-semibold text-foreground">{job.id}</h4>
            <p className="text-sm text-muted-foreground">{job.action.replace(/_/g, " ")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            Close
          </button>
        </header>

        <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">Status:</span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[job.status]}`}>
              {job.status}
            </span>
          </div>
          <div>
            <span className="font-medium text-foreground">Created:</span> {formatTimestamp(job.createdAt)}
          </div>
          <div>
            <span className="font-medium text-foreground">Updated:</span> {formatTimestamp(job.updatedAt)}
          </div>
          <div>
            <span className="font-medium text-foreground">Initiated by:</span> {job.initiatedBy.email}
          </div>
          {job.reason ? (
            <div>
              <span className="font-medium text-foreground">Reason:</span> {job.reason}
            </div>
          ) : null}
          {job.progressMessage ? (
            <div>
              <span className="font-medium text-foreground">Progress:</span> {job.progressMessage}
              {job.progressUpdatedAt ? (
                <span className="ml-2 text-xs">(Updated {formatTimestamp(job.progressUpdatedAt)})</span>
              ) : null}
            </div>
          ) : null}
          {job.errorMessage ? (
            <div className="text-destructive">
              <span className="font-medium text-foreground">Error:</span> {job.errorMessage}
            </div>
          ) : null}
        </div>

        <section className="mt-5 space-y-2">
          <header className="flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground">Failure details</h5>
            <span className="text-xs text-muted-foreground">{job.failedCount} recorded</span>
          </header>
          {job.failureDetails.length === 0 ? (
            <p className="text-sm text-muted-foreground">No failures recorded for this run.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left">User ID</th>
                    <th scope="col" className="px-3 py-2 text-left">Email</th>
                    <th scope="col" className="px-3 py-2 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {job.failureDetails.map((failure, index) => (
                    <tr key={`${failure.userId}-${index}`}>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{failure.userId}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{failure.email ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{failure.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {job.action === "EXPORT_USERS" && job.resultUrl ? (
          <section className="mt-5 space-y-2">
            <h5 className="text-sm font-semibold text-foreground">Export results</h5>
            <p className="text-sm text-muted-foreground">{exportExpiryText}</p>
            <a
              href={job.resultUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary underline-offset-4 hover:bg-primary/20"
            >
              Download CSV
            </a>
          </section>
        ) : null}
      </div>
    </div>
  );
};
