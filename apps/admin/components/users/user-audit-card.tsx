"use client";

import type { SuperAdminAuditEvent } from "@ma/contracts";

interface UserAuditCardProps {
  events: SuperAdminAuditEvent[];
}

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

export const UserAuditCard = ({ events }: UserAuditCardProps) => {
  if (events.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <header className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">Recent activity</h3>
          <p className="text-sm text-muted-foreground">No audit events recorded for this user yet.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">Recent activity</h3>
        <p className="text-sm text-muted-foreground">
          Recent audit events from the identity service. Expand the Audit Logs area to perform deeper investigations.
        </p>
      </header>
      <ol className="mt-4 space-y-3">
        {events.map((event) => (
          <li key={event.id} className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {event.eventType}
              </span>
              <span className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</span>
            </div>
            {event.description ? (
              <p className="mt-2 text-sm text-foreground">{event.description}</p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No description provided.</p>
            )}
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground md:grid-cols-4">
              <div>
                <dt className="font-medium">Organization</dt>
                <dd>{event.organizationId ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium">Tenant</dt>
                <dd>{event.tenantId ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium">Product</dt>
                <dd>{event.productId ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium">Metadata</dt>
                <dd>{event.metadata ? JSON.stringify(event.metadata) : "—"}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
};
