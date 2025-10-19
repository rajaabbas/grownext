"use client";

import type { SuperAdminUserDetail } from "@ma/contracts";
import clsx from "clsx";

interface UserProfileSummaryProps {
  user: SuperAdminUserDetail;
}

const STATUS_STYLES: Record<
  SuperAdminUserDetail["status"],
  { background: string; text: string; border: string; label: string }
> = {
  ACTIVE: {
    background: "bg-emerald-100/80 dark:bg-emerald-900/30",
    text: "text-emerald-800 dark:text-emerald-200",
    border: "border border-emerald-200 dark:border-emerald-800",
    label: "Active"
  },
  INVITED: {
    background: "bg-amber-100/80 dark:bg-amber-900/30",
    text: "text-amber-800 dark:text-amber-200",
    border: "border border-amber-200 dark:border-amber-800",
    label: "Invited"
  },
  SUSPENDED: {
    background: "bg-rose-100/80 dark:bg-rose-900/30",
    text: "text-rose-800 dark:text-rose-200",
    border: "border border-rose-200 dark:border-rose-800",
    label: "Suspended"
  },
  DEACTIVATED: {
    background: "bg-slate-200/70 dark:bg-slate-800/50",
    text: "text-slate-700 dark:text-slate-300",
    border: "border border-slate-300 dark:border-slate-700",
    label: "Deactivated"
  }
};

const formatDateTime = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

export const UserProfileSummary = ({ user }: UserProfileSummaryProps) => {
  const statusStyle = STATUS_STYLES[user.status];

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {user.fullName ?? "Unknown user"}
          </h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Created {formatDateTime(user.createdAt)}</span>
            <span className="hidden select-none text-muted-foreground md:inline">•</span>
            <span>Updated {formatDateTime(user.updatedAt)}</span>
            <span className="hidden select-none text-muted-foreground md:inline">•</span>
            <span>Last activity {formatDateTime(user.lastActivityAt)}</span>
          </div>
        </div>
        <span
          className={clsx(
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide",
            statusStyle.background,
            statusStyle.text,
            statusStyle.border
          )}
        >
          {statusStyle.label}
        </span>
      </div>
    </section>
  );
};
