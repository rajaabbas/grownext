"use server";

import { env } from "@ma/core";

export const isPortalBillingEnabled = (): boolean => env.PORTAL_BILLING_ENABLED;
