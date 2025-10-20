"use client";

import Link from "next/link";
import { BookOpenIcon, ClockIcon } from "@heroicons/react/24/outline";
import type { SuperAdminAuditEvent } from "@ma/contracts";

const RUNBOOK_LINKS = [
  {
    label: "Impersonation safeguards",
    description: "Steps to start, monitor, and safely stop admin impersonation sessions.",
    href: "/docs/operations/runbooks/identity#impersonation-safeguards"
  },
  {
    label: "Bulk job troubleshooting",
    description: "Queue monitoring, failure triage, and export handling guidance.",
    href: "/docs/operations/runbooks/identity#bulk-job-command-center"
  }
];

const formatRelativeTime = (value: string) => {
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) {
    return value;
  }

  const diffMs = Date.now() - target;
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

export const UserGuidanceCard = ({
  auditEvents,
  userEmail
}: {
  auditEvents: SuperAdminAuditEvent[];
  userEmail: string;
}) => {
  const latestEvent = auditEvents.at(0) ?? null;
  const latestDescription = latestEvent?.description ?? latestEvent?.eventType ?? "No recent changes recorded.";
  const actorEmail = (latestEvent?.metadata as { actorEmail?: string } | null)?.actorEmail ?? null;

  return (
    <aside className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <header className="flex items-start gap-3">
          <BookOpenIcon className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <h4 className="text-base font-semibold text-foreground">Operational guidance</h4>
            <p className="text-sm text-muted-foreground">
              Review the runbooks before impersonating or launching bulk changes for {userEmail}.
            </p>
          </div>
        </header>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          {RUNBOOK_LINKS.map((link) => (
            <li key={link.href} className="space-y-1">
              <Link href={link.href} className="font-medium text-primary underline-offset-4 hover:underline">
                {link.label}
              </Link>
              <p>{link.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <header className="flex items-start gap-3">
          <ClockIcon className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <h4 className="text-base font-semibold text-foreground">Recent change</h4>
            <p className="text-sm text-muted-foreground">
              Latest privileged activity touching this account.
            </p>
          </div>
        </header>
        {latestEvent ? (
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p className="text-foreground">{latestDescription}</p>
            <p>
              Captured {formatRelativeTime(latestEvent.createdAt)}
              {actorEmail ? ` by ${actorEmail}` : ""}.
            </p>
            <p className="text-xs">
              Event type: <span className="font-medium text-foreground">{latestEvent.eventType}</span>
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No audit entries found for this user yet.</p>
        )}
      </section>
    </aside>
  );
};
