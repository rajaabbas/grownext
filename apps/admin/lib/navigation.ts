import type { AdminRole } from "./roles";

export type NavigationFeatureFlag = "billing";

export interface NavigationItem {
  label: string;
  href: string;
  description?: string;
  roles: readonly AdminRole[];
  featureFlag?: NavigationFeatureFlag;
}

export const PRIMARY_NAVIGATION: NavigationItem[] = [
  {
    label: "Overview",
    href: "/",
    roles: ["super-admin", "support", "auditor"]
  },
  {
    label: "Users",
    href: "/users",
    description: "Global directory of all accounts across products.",
    roles: ["super-admin", "support"]
  },
  {
    label: "Bulk Ops",
    href: "/users/bulk",
    description: "Queue and monitor high-volume user jobs.",
    roles: ["super-admin"]
  },
  {
    label: "Audit Logs",
    href: "/audit",
    description: "Search privileged activity and export compliance trails.",
    roles: ["super-admin", "auditor", "support"]
  },
  {
    label: "Billing",
    href: "/billing",
    description: "Manage packages, subscriptions, invoices, and usage telemetry.",
    roles: ["super-admin"],
    featureFlag: "billing"
  },
  {
    label: "Settings",
    href: "/settings",
    description: "Feature flags, policies, and environment controls.",
    roles: ["super-admin"]
  }
];
