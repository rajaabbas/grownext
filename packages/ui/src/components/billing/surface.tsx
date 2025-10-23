import * as React from "react";
import { cn } from "../../lib/cn";

export interface BillingSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "solid" | "muted";
  padded?: boolean;
}

const variantStyles: Record<NonNullable<BillingSurfaceProps["variant"]>, string> = {
  solid: "bg-card/90 text-card-foreground border-border/80",
  muted: "bg-muted/70 text-muted-foreground border-border/60"
};

export const BillingSurface = React.forwardRef<HTMLDivElement, BillingSurfaceProps>(
  ({ variant = "solid", padded = true, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border shadow-sm transition-colors",
        variantStyles[variant],
        padded ? "p-6" : "p-0",
        className
      )}
      {...props}
    />
  )
);
BillingSurface.displayName = "BillingSurface";

