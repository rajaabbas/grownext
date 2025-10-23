export const isAdminBillingEnabled = (): boolean =>
  (process.env.ADMIN_BILLING_ENABLED ?? "false").toLowerCase() === "true";
