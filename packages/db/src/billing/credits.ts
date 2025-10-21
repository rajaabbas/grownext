import { Prisma } from "@prisma/client";
import type { BillingCreditMemo, BillingCreditReason } from "@prisma/client";
import type { SupabaseJwtClaims } from "@ma/core";
import { withAuthorizationTransaction } from "../prisma";

export interface CreateBillingCreditMemoInput {
  organizationId: string;
  invoiceId?: string | null;
  amountCents: number;
  currency?: string;
  reason: BillingCreditReason;
  expiresAt?: Date | null;
  metadata?: Prisma.JsonValue | null;
}

export const createBillingCreditMemo = async (
  claims: SupabaseJwtClaims | null,
  input: CreateBillingCreditMemoInput
): Promise<BillingCreditMemo> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingCreditMemo.create({
      data: {
        organizationId: input.organizationId,
        invoiceId: input.invoiceId ?? null,
        amountCents: input.amountCents,
        currency: input.currency ?? "usd",
        reason: input.reason,
        expiresAt: input.expiresAt ?? null,
        metadata: input.metadata ?? Prisma.JsonNull
      }
    })
  );
};

export const listBillingCreditMemosForOrganization = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<BillingCreditMemo[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingCreditMemo.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" }
    })
  );
};

export const linkBillingCreditMemoToInvoice = async (
  claims: SupabaseJwtClaims | null,
  creditMemoId: string,
  invoiceId: string | null
): Promise<BillingCreditMemo> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingCreditMemo.update({
      where: { id: creditMemoId },
      data: { invoiceId }
    })
  );
};
