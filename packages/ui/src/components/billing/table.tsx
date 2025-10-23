import * as React from "react";
import { cn } from "../../lib/cn";

export const BillingTableContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("overflow-hidden rounded-xl border border-border/70", className)}
    {...props}
  />
));
BillingTableContainer.displayName = "BillingTableContainer";

export const BillingTable = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table
      ref={ref}
      className={cn("w-full min-w-full divide-y divide-border/60 text-sm", className)}
      {...props}
    />
  )
);
BillingTable.displayName = "BillingTable";

export const BillingTableHead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)}
    {...props}
  />
));
BillingTableHead.displayName = "BillingTableHead";

export const BillingTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("divide-y divide-border/60 text-sm text-foreground", className)} {...props} />
));
BillingTableBody.displayName = "BillingTableBody";

export const BillingTableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn("align-top transition hover:bg-muted/30", className)} {...props} />
  )
);
BillingTableRow.displayName = "BillingTableRow";

export const BillingTableHeaderCell = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th ref={ref} className={cn("px-4 py-3 text-left font-semibold", className)} {...props} />
));
BillingTableHeaderCell.displayName = "BillingTableHeaderCell";

export const BillingTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("px-4 py-3 align-middle text-sm text-foreground", className)} {...props} />
));
BillingTableCell.displayName = "BillingTableCell";
