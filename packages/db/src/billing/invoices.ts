import { Prisma } from "@prisma/client";
import type {
  BillingInvoice,
  BillingInvoiceLine,
  BillingInvoiceLineType,
  BillingInvoiceStatus
} from "@prisma/client";
import type { SupabaseJwtClaims } from "@ma/core";
import { withAuthorizationTransaction } from "../prisma";

const toDecimal = (value: Prisma.Decimal | number | string): Prisma.Decimal =>
  Prisma.Decimal.isDecimal(value) ? (value as Prisma.Decimal) : new Prisma.Decimal(value);

export interface CreateBillingInvoiceInput {
  organizationId: string;
  subscriptionId?: string | null;
  number: string;
  status: BillingInvoiceStatus;
  currency?: string;
  subtotalCents: number;
  taxCents?: number;
  totalCents: number;
  balanceCents?: number;
  dueAt?: Date | null;
  issuedAt: Date;
  paidAt?: Date | null;
  voidedAt?: Date | null;
  externalId?: string | null;
  metadata?: Prisma.JsonValue | null;
}

export interface CreateBillingInvoiceLineInput {
  invoiceId: string;
  lineType: BillingInvoiceLineType;
  description?: string | null;
  featureKey?: string | null;
  quantity: Prisma.Decimal | number | string;
  unitAmountCents: number;
  amountCents: number;
  usagePeriodStart?: Date | null;
  usagePeriodEnd?: Date | null;
  metadata?: Prisma.JsonValue | null;
}

export const createBillingInvoice = async (
  claims: SupabaseJwtClaims | null,
  input: CreateBillingInvoiceInput
): Promise<BillingInvoice> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingInvoice.create({
      data: {
        organizationId: input.organizationId,
        subscriptionId: input.subscriptionId ?? null,
        number: input.number,
        status: input.status,
        currency: input.currency ?? "usd",
        subtotalCents: input.subtotalCents,
        taxCents: input.taxCents ?? 0,
        totalCents: input.totalCents,
        balanceCents: input.balanceCents ?? input.totalCents,
        dueAt: input.dueAt ?? null,
        issuedAt: input.issuedAt,
        paidAt: input.paidAt ?? null,
        voidedAt: input.voidedAt ?? null,
        externalId: input.externalId ?? null,
        metadata: input.metadata ?? Prisma.JsonNull
      }
    })
  );
};

export const addBillingInvoiceLine = async (
  claims: SupabaseJwtClaims | null,
  input: CreateBillingInvoiceLineInput
): Promise<BillingInvoiceLine> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingInvoiceLine.create({
      data: {
        invoiceId: input.invoiceId,
        lineType: input.lineType,
        description: input.description ?? null,
        featureKey: input.featureKey ?? null,
        quantity: toDecimal(input.quantity),
        unitAmountCents: input.unitAmountCents,
        amountCents: input.amountCents,
        usagePeriodStart: input.usagePeriodStart ?? null,
        usagePeriodEnd: input.usagePeriodEnd ?? null,
        metadata: input.metadata ?? Prisma.JsonNull
      }
    })
  );
};

export const listBillingInvoicesForOrganization = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string,
  options: { includeLines?: boolean; limit?: number } = {}
): Promise<(BillingInvoice & { lines?: BillingInvoiceLine[] })[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingInvoice.findMany({
      where: { organizationId },
      include: options.includeLines ? { lines: true } : undefined,
      orderBy: { issuedAt: "desc" },
      take: options.limit ?? 50
    })
  );
};

export const getBillingInvoiceById = async (
  claims: SupabaseJwtClaims | null,
  invoiceId: string,
  options: { includeLines?: boolean } = {}
): Promise<(BillingInvoice & { lines?: BillingInvoiceLine[] }) | null> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingInvoice.findUnique({
      where: { id: invoiceId },
      include: options.includeLines ? { lines: true } : undefined
    })
  );
};

export const updateBillingInvoiceStatus = async (
  claims: SupabaseJwtClaims | null,
  invoiceId: string,
  status: BillingInvoiceStatus,
  updates: {
    paidAt?: Date | null;
    voidedAt?: Date | null;
    balanceCents?: number;
    metadata?: Prisma.JsonValue | null;
  } = {}
): Promise<BillingInvoice> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingInvoice.update({
      where: { id: invoiceId },
      data: {
        status,
        paidAt: updates.paidAt ?? undefined,
        voidedAt: updates.voidedAt ?? undefined,
        balanceCents: updates.balanceCents ?? undefined,
        metadata:
          updates.metadata !== undefined ? updates.metadata ?? Prisma.JsonNull : undefined
      }
    })
  );
};

export const recordBillingInvoicePayment = async (
  claims: SupabaseJwtClaims | null,
  invoiceId: string,
  amountCents: number,
  paidAt: Date
): Promise<BillingInvoice> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const invoice = await tx.billingInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const remaining = Math.max(invoice.balanceCents - amountCents, 0);

    return tx.billingInvoice.update({
      where: { id: invoiceId },
      data: {
        balanceCents: remaining,
        paidAt,
        status: remaining === 0 ? "PAID" : invoice.status
      }
    });
  });
};

export const attachExternalBillingInvoiceId = async (
  claims: SupabaseJwtClaims | null,
  invoiceId: string,
  externalId: string
): Promise<BillingInvoice> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingInvoice.update({
      where: { id: invoiceId },
      data: { externalId }
    })
  );
};
