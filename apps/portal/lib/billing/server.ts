"use server";

import { redirect, notFound } from "next/navigation";
import type { BillingAccess } from "@/lib/billing/access";
import { requireBillingAccess } from "@/lib/billing/access";

const handleError = (access: Extract<BillingAccess, { kind: "error" }>) => {
  const status = access.response.status;

  if (status === 404) {
    notFound();
  }

  if (status === 401) {
    redirect("/login?reason=expired");
  }

  if (status === 403) {
    redirect("/");
  }

  throw new Error(`Failed to resolve billing access (${status})`);
};

export const getBillingAccessOrThrow = async () => {
  const access = await requireBillingAccess();
  if (access.kind === "error") {
    handleError(access);
  }
  return access;
};
