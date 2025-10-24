import * as React from "react";
import { cn } from "../../lib/cn";

export interface BillingStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20",
  open: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/20",
  draft: "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/20",
  uncollectible: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20",
  void: "bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30",
  canceled: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/20",
  default: "bg-slate-900/60 text-slate-300 ring-1 ring-slate-700/60"
};

const resolveStatusStyle = (status: string): string => {
  const normalized = status.trim().toLowerCase();

  if (STATUS_STYLES[normalized]) {
    return STATUS_STYLES[normalized];
  }

  return STATUS_STYLES.default;
};

export const BillingStatusBadge = React.forwardRef<HTMLSpanElement, BillingStatusBadgeProps>(
  ({ status, className, children, ...props }, ref) => {
    const content = children ?? status.trim().toLowerCase();

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize tracking-wide",
          resolveStatusStyle(status),
          className
        )}
        {...props}
      >
        {content}
      </span>
    );
  }
);
BillingStatusBadge.displayName = "BillingStatusBadge";
