import * as React from "react";
import { cn } from "../../lib/cn";

export interface BillingSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "solid" | "muted";
  padded?: boolean;
}

const variantStyles: Record<NonNullable<BillingSurfaceProps["variant"]>, string> = {
  solid: "bg-slate-950/70 text-slate-100 border-slate-800 shadow-lg shadow-slate-950/30",
  muted: "bg-slate-900/60 text-slate-300 border-slate-800"
};

export const BillingSurface = React.forwardRef<HTMLDivElement, BillingSurfaceProps>(
  ({ variant = "solid", padded = true, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border ring-1 ring-slate-800/60 transition-colors",
        variantStyles[variant],
        padded ? "p-6" : "p-0",
        className
      )}
      {...props}
    />
  )
);
BillingSurface.displayName = "BillingSurface";
