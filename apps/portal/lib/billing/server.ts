"use server";

import { redirect, notFound } from "next/navigation";
import type { BillingAccess } from "@/lib/billing/access";
import { requireBillingAccess } from "@/lib/billing/access";

const handleError = (access: Extract<BillingAccess, { kind: "error" }>): never => {
  const status = access.response.status;

  if (status === 404) {
    return notFound();
  }

  if (status === 401) {
    return redirect("/login?reason=expired");
  }

  if (status === 403) {
    return redirect("/");
  }

  throw new Error(`Failed to resolve billing access (${status})`);
};

export const getBillingAccessOrThrow = async (): Promise<
  Extract<BillingAccess, { kind: "allowed" }>
> => {
  const access = await requireBillingAccess();
  if (access.kind === "allowed") {
    return access;
  }
  return handleError(access);
};
