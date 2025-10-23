import * as React from "react";
import { cn } from "../../lib/cn";

export interface BillingMetricProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  align?: "start" | "end";
}

export const BillingMetric = React.forwardRef<HTMLDivElement, BillingMetricProps>(
  ({ label, value, helper, align = "start", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("space-y-1 text-sm", align === "end" ? "text-right" : "text-left", className)}
      {...props}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
      {helper ? <div className="text-sm text-muted-foreground">{helper}</div> : null}
    </div>
  )
);
BillingMetric.displayName = "BillingMetric";

