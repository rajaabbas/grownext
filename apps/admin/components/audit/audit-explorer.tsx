"use client";

import { useMemo, useState, useTransition } from "react";
import type { SuperAdminAuditEvent, SuperAdminAuditLogQuery, SuperAdminAuditLogResponse } from "@ma/contracts";

import { useTelemetry } from "@/components/providers/telemetry-provider";

interface AuditExplorerProps {
  initialData: SuperAdminAuditLogResponse;
  initialQuery?: Partial<SuperAdminAuditLogQuery>;
  canExport?: boolean;
  initialError?: string;
}

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const AuditExplorer = ({
  initialData,
  initialQuery,
  canExport = false,
  initialError
}: AuditExplorerProps) => {
  const [data, setData] = useState<SuperAdminAuditLogResponse>(initialData);
  const [search, setSearch] = useState(initialQuery?.search ?? "");
  const [actorEmail, setActorEmail] = useState(initialQuery?.actorEmail ?? "");
  const [eventType, setEventType] = useState(initialQuery?.eventType ?? "");
  const [start, setStart] = useState<string>(initialQuery?.start ? initialQuery.start.slice(0, 16) : "");
  const [end, setEnd] = useState<string>(initialQuery?.end ? initialQuery.end.slice(0, 16) : "");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isPending, startTransition] = useTransition();
  const telemetry = useTelemetry();

  const eventTypes = useMemo(() => {
    const unique = new Set<string>();
    for (const event of data.events) {
      unique.add(event.eventType);
    }
    return Array.from(unique.values()).sort();
  }, [data.events]);

  const runQuery = (page?: number) => {
    startTransition(() => {
      void (async () => {
        try {
          const params = new URLSearchParams();
          if (search.trim()) params.set("search", search.trim());
          if (actorEmail.trim()) params.set("actorEmail", actorEmail.trim());
          if (eventType) params.set("eventType", eventType);
          if (start) params.set("start", new Date(start).toISOString());
          if (end) params.set("end", new Date(end).toISOString());
          if (page && page > 1) params.set("page", String(page));

          const response = await fetch(
            params.size > 0 ? `/api/super-admin/audit/logs?${params.toString()}` : "/api/super-admin/audit/logs",
            { cache: "no-store" }
          );

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error ?? `Request failed (${response.status})`);
          }

          const payload = (await response.json()) as SuperAdminAuditLogResponse;
          setData(payload);
          setError(null);
          telemetry.recordEvent("audit_logs_fetched", {
            search: search.trim() || undefined,
            actorEmail: actorEmail.trim() || undefined,
            eventType: eventType || undefined,
            page: page ?? 1
          });
        } catch (requestError) {
          setError((requestError as Error).message);
        }
      })();
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runQuery(1);
  };

  const handleReset = () => {
    setSearch("");
    setActorEmail("");
    setEventType("");
    setStart("");
    setEnd("");
    runQuery(1);
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/super-admin/audit/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          search: search.trim() || undefined,
          actorEmail: actorEmail.trim() || undefined,
          eventType: eventType || undefined,
          start: start ? new Date(start).toISOString() : undefined,
          end: end ? new Date(end).toISOString() : undefined
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? `Export failed (${response.status})`);
      }

      const payload = (await response.json()) as { url: string };
      window.open(payload.url, "_blank", "noopener,noreferrer");
      telemetry.recordEvent("audit_export_created", {
        search: search.trim() || undefined,
        actorEmail: actorEmail.trim() || undefined,
        eventType: eventType || undefined
      });
    } catch (exportError) {
      setError((exportError as Error).message);
    }
  };

  const pagination = data.pagination;
  const goToNext = () => {
    if (pagination.hasNextPage && !isPending) {
      runQuery(pagination.page + 1);
    }
  };
  const goToPrevious = () => {
    if (pagination.hasPreviousPage && !isPending) {
      runQuery(Math.max(1, pagination.page - 1));
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Search
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Text or ID in description/metadata"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Actor email
          <input
            type="email"
            value={actorEmail}
            onChange={(event) => setActorEmail(event.target.value)}
            placeholder="admin@example.com"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Event type
          <select
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">All events</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Filtering…" : "Apply"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            Reset
          </button>
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-foreground md:col-span-2">
          Start
          <input
            type="datetime-local"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-foreground md:col-span-2">
          End
          <input
            type="datetime-local"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        {canExport ? (
          <button
            type="button"
            onClick={handleExport}
            disabled={isPending}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            Export CSV
          </button>
        ) : null}
      </form>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 text-left">Event</th>
              <th scope="col" className="px-4 py-3 text-left">Description</th>
              <th scope="col" className="px-4 py-3 text-left">Actor</th>
              <th scope="col" className="px-4 py-3 text-left">Metadata</th>
              <th scope="col" className="px-4 py-3 text-left">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No audit events match the current filters.
                </td>
              </tr>
            ) : (
              data.events.map((event) => (
                <AuditEventRow key={event.id} event={event} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          Page {pagination.page} of {pagination.totalPages} · Total {pagination.total}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPrevious}
            disabled={!pagination.hasPreviousPage || isPending}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={goToNext}
            disabled={!pagination.hasNextPage || isPending}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

const AuditEventRow = ({ event }: { event: SuperAdminAuditEvent }) => {
  const metadata: Record<string, unknown> = {
    ...(event.metadata ?? {})
  };

  const highlights: Array<{ label: string; value: string }> = [];

  const pickHighlight = (keys: string[], label: string) => {
    for (const key of keys) {
      const raw = metadata[key];
      if (typeof raw === "string" && raw.trim().length > 0) {
        delete metadata[key];
        highlights.push({ label, value: raw.trim() });
        return;
      }
    }
  };

  pickHighlight(["guardrail", "throttleReason"], "Guardrail");
  pickHighlight(["impersonatedByEmail", "impersonatedBy"], "Impersonated by");
  pickHighlight(["targetUserEmail", "targetUserId"], "Target user");
  pickHighlight(["requestId"], "Request ID");
  pickHighlight(["actorRole"], "Actor role");
  pickHighlight(["impersonationTokenId"], "Impersonation token");

  const combinedMetadata: Record<string, unknown> = { ...metadata };

  if (event.ipAddress && combinedMetadata.ipAddress === undefined) {
    combinedMetadata.ipAddress = event.ipAddress;
  }

  if (event.userAgent && combinedMetadata.userAgent === undefined) {
    combinedMetadata.userAgent = event.userAgent;
  }

  const metadataEntries = Object.entries(combinedMetadata);

  return (
    <tr className="bg-card">
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-foreground">{event.eventType}</div>
        {event.organizationId ? (
          <div className="text-xs uppercase text-muted-foreground">Org {event.organizationId}</div>
        ) : null}
        {event.tenantId ? (
          <div className="text-xs uppercase text-muted-foreground">Tenant {event.tenantId}</div>
        ) : null}
        {event.productId ? (
          <div className="text-xs uppercase text-muted-foreground">Product {event.productId}</div>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top text-sm text-muted-foreground">{event.description ?? "—"}</td>
      <td className="px-4 py-3 align-top text-sm text-muted-foreground">
        {event.actorEmail ?? event.metadata?.actorEmail ?? "—"}
      </td>
      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
        {highlights.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {highlights.map(({ label, value }) => (
              <span
                key={`${label}-${value}`}
                className="inline-flex items-center rounded-full border border-indigo-300/60 bg-indigo-500/10 px-2 py-1 text-xs font-medium text-indigo-200"
              >
                <span className="mr-1 uppercase text-[10px] tracking-wider text-indigo-300">{label}</span>
                <span className="text-indigo-100">{value}</span>
              </span>
            ))}
          </div>
        ) : null}
        {metadataEntries.length === 0 ? "—" : (
          <div className="space-y-1">
            {metadataEntries.map(([key, value]) => (
              <div key={key}>
                <span className="font-medium text-foreground">{key}: </span>
                <span>{typeof value === "string" ? value : JSON.stringify(value)}</span>
              </div>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3 align-top text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</td>
    </tr>
  );
};
