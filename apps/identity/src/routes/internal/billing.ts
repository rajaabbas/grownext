import { performance } from "node:perf_hooks";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { buildServiceRoleClaims, env } from "@ma/core";
import {
  getActiveBillingSubscriptionForOrganization,
  recordBillingUsageEvents,
  type RecordBillingUsageEventInput,
  prisma,
  Prisma,
  upsertBillingUsageAggregate,
  type UsageAggregateKey,
  getBillingSubscriptionById,
  createBillingInvoice,
  addBillingInvoiceLine,
  recordBillingInvoicePayment,
  updateBillingInvoiceStatus,
  createBillingCreditMemo,
  getBillingInvoiceById,
  type BillingSubscription,
  type BillingInvoice,
  type BillingInvoiceStatus,
  type BillingInvoiceLineType,
  type BillingUsageResolution,
  type BillingUsageSource
} from "@ma/db";
import {
  BillingUsageResolutionValues,
  BillingUsageSourceValues,
  BillingInvoiceStatusValues,
  BillingInvoiceLineTypeValues,
  BillingCreditReasonValues
} from "@ma/contracts";

const usageEventSchema = z.object({
  organizationId: z.string().min(1),
  subscriptionId: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
  featureKey: z.string().min(1),
  quantity: z.number().finite(),
  unit: z.string().min(1),
  recordedAt: z.string().datetime().optional(),
  source: z.enum(BillingUsageSourceValues).default("API"),
  metadata: z.record(z.any()).nullable().optional(),
  fingerprint: z.string().min(1).optional()
});

const usageAggregateSchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
  subscriptionId: z.string().min(1, "subscriptionId is required"),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  resolution: z.enum(BillingUsageResolutionValues).default("DAILY"),
  source: z.enum(BillingUsageSourceValues).default("WORKER"),
  featureKeys: z.array(z.string().min(1)).optional(),
  backfill: z.boolean().optional(),
  context: z.record(z.any()).optional()
});

const usageChargeSchema = z.object({
  featureKey: z.string().min(1),
  unitAmountCents: z.number().int().nonnegative(),
  unit: z.string().min(1),
  description: z.string().optional(),
  minimumAmountCents: z.number().int().nonnegative().optional(),
  resolution: z.enum(BillingUsageResolutionValues).default("DAILY"),
  usagePeriodStart: z.string().datetime().optional(),
  usagePeriodEnd: z.string().datetime().optional()
});

const extraLineSchema = z.object({
  lineType: z.enum(BillingInvoiceLineTypeValues).default("ADJUSTMENT"),
  description: z.string().optional(),
  featureKey: z.string().optional(),
  quantity: z.number().finite().default(1),
  unitAmountCents: z.number().int(),
  amountCents: z.number().int(),
  usagePeriodStart: z.string().datetime().optional(),
  usagePeriodEnd: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional()
});

const invoiceJobSchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
  subscriptionId: z.string().min(1).optional(),
  invoiceNumber: z.string().min(1).optional(),
  currency: z.string().min(3).default("usd"),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  recurringAmountCents: z.number().int().nonnegative().optional(),
  recurringDescription: z.string().optional(),
  status: z.enum(BillingInvoiceStatusValues).default("OPEN"),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  taxCents: z.number().int().nonnegative().optional(),
  metadata: z.record(z.any()).optional(),
  usageCharges: z.array(usageChargeSchema).default([]),
  extraLines: z.array(extraLineSchema).default([]),
  settle: z
    .object({
      amountCents: z.number().int().nonnegative().optional(),
      paidAt: z.string().datetime().optional()
    })
    .optional()
});

const paymentSyncEvents = [
  "payment_succeeded",
  "payment_failed",
  "payment_disputed",
  "payment_refunded",
  "sync_status"
] as const;

const paymentSyncJobSchema = z.object({
  organizationId: z.string().min(1),
  invoiceId: z.string().min(1),
  event: z.enum(paymentSyncEvents),
  amountCents: z.number().int().nonnegative().optional(),
  paidAt: z.string().datetime().optional(),
  status: z.enum(BillingInvoiceStatusValues).optional(),
  externalPaymentId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  note: z.string().optional(),
  credit: z
    .object({
      amountCents: z.number().int().nonnegative(),
      reason: z.enum(BillingCreditReasonValues).optional(),
      metadata: z.record(z.any()).optional()
    })
    .optional()
});

type UsageAggregatePayload = z.infer<typeof usageAggregateSchema>;
type InvoiceJobPayload = z.infer<typeof invoiceJobSchema>;
type PaymentSyncJobPayload = z.infer<typeof paymentSyncJobSchema>;

type PrismaUsageGroup = {
  featureKey: string;
  unit: string;
  _sum: {
    quantity: Prisma.Decimal | null;
  };
};

interface UsageTotalsAccumulator {
  quantity: Prisma.Decimal;
  unit: string | null;
}

const keyForUsageTotal = (featureKey: string, resolution: BillingUsageResolution) =>
  `${featureKey}::${resolution}`;

const formatDateKey = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const generateInvoiceNumber = (organizationId: string, issuedAt: Date): string => {
  const suffix =
    organizationId.slice(-6).replace(/[^a-zA-Z0-9]/g, "").toUpperCase() ||
    Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${formatDateKey(issuedAt)}-${suffix}`;
};

const resolveUsageTotals = async (
  payload: InvoiceJobPayload,
  subscription: BillingSubscription
): Promise<Map<string, UsageTotalsAccumulator>> => {
  const totals = new Map<string, UsageTotalsAccumulator>();

  if (payload.usageCharges.length === 0) {
    return totals;
  }

  const periodStart = new Date(payload.periodStart);
  const periodEnd = new Date(payload.periodEnd);

  const featureKeys = Array.from(new Set(payload.usageCharges.map((charge) => charge.featureKey)));
  const resolutions = Array.from(
    new Set(
      payload.usageCharges.map(
        (charge) => charge.resolution as BillingUsageResolution
      )
    )
  );

  for (const charge of payload.usageCharges) {
    totals.set(keyForUsageTotal(charge.featureKey, charge.resolution as BillingUsageResolution), {
      quantity: new Prisma.Decimal(0),
      unit: charge.unit ?? null
    });
  }

  const rows = await prisma.billingUsageAggregate.findMany({
    where: {
      organizationId: payload.organizationId,
      subscriptionId: subscription.id,
      featureKey: { in: featureKeys },
      resolution: { in: resolutions },
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd }
    }
  });

  for (const row of rows) {
    const key = keyForUsageTotal(row.featureKey, row.resolution as BillingUsageResolution);
    const accumulator = totals.get(key);
    if (!accumulator) continue;

    accumulator.quantity = accumulator.quantity.plus(row.quantity);
    accumulator.unit = row.unit;
  }

  return totals;
};

const resolveCreditAmount = (payload: PaymentSyncJobPayload, invoice: BillingInvoice): number => {
  if (payload.credit?.amountCents !== undefined) {
    return payload.credit.amountCents;
  }
  if (payload.amountCents !== undefined) {
    return payload.amountCents;
  }
  return invoice.balanceCents;
};

const resolveCreditReason = (
  payload: PaymentSyncJobPayload,
  fallback: "REFUND" | "SERVICE_FAILURE"
) => payload.credit?.reason ?? fallback;

const billingInternalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/usage/events", async (request, reply) => {
    if (!env.IDENTITY_BILLING_ENABLED) {
      reply.status(404);
      return { error: "billing_disabled" };
    }

    const body = z
      .object({ events: z.array(usageEventSchema).min(1) })
      .parse(request.body ?? {});

    const eventsByOrganization = new Map<
      string,
      {
        claims: ReturnType<typeof buildServiceRoleClaims>;
        subscriptionId: string | null;
        events: RecordBillingUsageEventInput[];
      }
    >();

    const orgsNeedingSubscriptionLookup = new Set<string>();

    for (const event of body.events) {
      if (!eventsByOrganization.has(event.organizationId)) {
        eventsByOrganization.set(event.organizationId, {
          claims: buildServiceRoleClaims(event.organizationId),
          subscriptionId: null,
          events: []
        });
      }

      if (!event.subscriptionId) {
        orgsNeedingSubscriptionLookup.add(event.organizationId);
      }
    }

    for (const organizationId of orgsNeedingSubscriptionLookup) {
      const context = eventsByOrganization.get(organizationId);
      if (!context) continue;

      try {
        const subscription = await getActiveBillingSubscriptionForOrganization(
          context.claims,
          organizationId
        );
        context.subscriptionId = subscription?.id ?? null;
      } catch (error) {
        fastify.log.error(
          { error, organizationId },
          "Failed to resolve active billing subscription for usage event"
        );
        context.subscriptionId = null;
      }
    }

    let attempted = 0;
    let accepted = 0;

    for (const event of body.events) {
      const context = eventsByOrganization.get(event.organizationId);
      if (!context) continue;

      context.events.push({
        organizationId: event.organizationId,
        subscriptionId: event.subscriptionId ?? context.subscriptionId ?? null,
        tenantId: event.tenantId ?? null,
        productId: event.productId ?? null,
        featureKey: event.featureKey,
        quantity: event.quantity,
        unit: event.unit,
        recordedAt: event.recordedAt ? new Date(event.recordedAt) : new Date(),
        source: event.source,
        metadata: event.metadata ?? null,
        fingerprint: event.fingerprint ?? null
      });
      attempted += 1;
    }

    for (const [organizationId, entry] of eventsByOrganization.entries()) {
      if (entry.events.length === 0) continue;

      try {
        const result = await recordBillingUsageEvents(entry.claims, entry.events);
        accepted += result;
      } catch (error) {
        fastify.log.error(
          { error, organizationId, events: entry.events.length },
          "Failed to record billing usage events"
        );
      }
    }

    if (accepted < attempted) {
      fastify.log.warn(
        {
          attempted,
          accepted,
          dropped: attempted - accepted
        },
        "billing_usage_event_drop"
      );
    }

    reply.code(202);
    return { accepted };
  });

  fastify.post("/usage/aggregate", async (request, reply) => {
    if (!env.IDENTITY_BILLING_ENABLED) {
      reply.status(404);
      return { error: "billing_disabled" };
    }

    const payload = usageAggregateSchema.parse(request.body ?? {});
    const periodStart = new Date(payload.periodStart);
    const periodEnd = new Date(payload.periodEnd);

    if (periodEnd <= periodStart) {
      throw new Error("periodEnd must be later than periodStart");
    }

    const startedAt = performance.now();
    const claims = buildServiceRoleClaims(payload.organizationId);
    const resolution = payload.resolution as BillingUsageResolution;
    const source = payload.source as BillingUsageSource;

    const rawGroups = await prisma.billingUsageEvent.groupBy({
      by: ["featureKey", "unit"],
      where: {
        organizationId: payload.organizationId,
        subscriptionId: payload.subscriptionId,
        featureKey: payload.featureKeys ? { in: payload.featureKeys } : undefined,
        recordedAt: {
          gte: periodStart,
          lt: periodEnd
        }
      },
      _sum: { quantity: true }
    });
    const groups = rawGroups as PrismaUsageGroup[];

    let aggregated = 0;

    for (const group of groups) {
      const quantity = group._sum.quantity ?? new Prisma.Decimal(0);
      const key: UsageAggregateKey = {
        organizationId: payload.organizationId,
        subscriptionId: payload.subscriptionId,
        featureKey: group.featureKey,
        resolution,
        periodStart,
        periodEnd
      };

      await upsertBillingUsageAggregate(claims, key, quantity, group.unit, source);
      aggregated += 1;
    }

    const durationMs = performance.now() - startedAt;

    reply.code(200);
    return {
      aggregated,
      durationMs
    };
  });

  fastify.post("/invoices", async (request, reply) => {
    if (!env.IDENTITY_BILLING_ENABLED) {
      reply.status(404);
      return { error: "billing_disabled" };
    }

    const payload = invoiceJobSchema.parse(request.body ?? {});
    const startedAt = performance.now();
    const periodStart = new Date(payload.periodStart);
    const periodEnd = new Date(payload.periodEnd);

    if (periodEnd <= periodStart) {
      throw new Error("periodEnd must be later than periodStart");
    }

    const claims = buildServiceRoleClaims(payload.organizationId);

    let subscription: BillingSubscription | null = null;
    if (payload.subscriptionId) {
      subscription = await getBillingSubscriptionById(claims, payload.subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription ${payload.subscriptionId} not found`);
      }
    } else {
      subscription = await getActiveBillingSubscriptionForOrganization(
        claims,
        payload.organizationId
      );
      if (!subscription) {
        throw new Error(`No active subscription found for organization ${payload.organizationId}`);
      }
    }

    const issuedAt = payload.issueDate ? new Date(payload.issueDate) : new Date();
    const dueAt = payload.dueDate ? new Date(payload.dueDate) : new Date(periodEnd);
    const invoiceNumber =
      payload.invoiceNumber ?? generateInvoiceNumber(payload.organizationId, issuedAt);

    let subtotalCents = 0;
    const preparedLines: Array<{
      lineType: BillingInvoiceLineType;
      description?: string | null;
      featureKey?: string | null;
      quantity: Prisma.Decimal | number;
      unitAmountCents: number;
      amountCents: number;
      usagePeriodStart?: Date | null;
      usagePeriodEnd?: Date | null;
      metadata?: Prisma.JsonValue | null;
    }> = [];

    const recurringAmount = payload.recurringAmountCents ?? subscription.amountCents ?? 0;
    if (recurringAmount > 0) {
      subtotalCents += recurringAmount;
      preparedLines.push({
        lineType: "RECURRING",
        description: payload.recurringDescription ?? "subscription",
        featureKey: "subscription",
        quantity: 1,
        unitAmountCents: recurringAmount,
        amountCents: recurringAmount
      });
    }

    if (payload.usageCharges.length > 0) {
      const totals = await resolveUsageTotals(payload, subscription);
      for (const charge of payload.usageCharges) {
        const key = keyForUsageTotal(
          charge.featureKey,
          charge.resolution as BillingUsageResolution
        );
        const usage = totals.get(key);

        const quantity = usage?.quantity ?? new Prisma.Decimal(0);
        const billedAmount = quantity.mul(charge.unitAmountCents).toNumber();
        const minimum = charge.minimumAmountCents ?? 0;
        const amountCents = billedAmount < minimum ? minimum : billedAmount;

        if (amountCents === 0 && minimum === 0) {
          continue;
        }

        subtotalCents += amountCents;
        preparedLines.push({
          lineType: "USAGE",
          description: charge.description ?? `Usage for ${charge.featureKey}`,
          featureKey: charge.featureKey,
          quantity,
          unitAmountCents: charge.unitAmountCents,
          amountCents,
          usagePeriodStart: charge.usagePeriodStart
            ? new Date(charge.usagePeriodStart)
            : periodStart,
          usagePeriodEnd: charge.usagePeriodEnd ? new Date(charge.usagePeriodEnd) : periodEnd,
          metadata: {
            unit: usage?.unit ?? charge.unit,
            resolution: charge.resolution,
            minimumAmountCents: charge.minimumAmountCents ?? null
          }
        });
      }
    }

    for (const line of payload.extraLines) {
      subtotalCents += line.amountCents;
      preparedLines.push({
        lineType: line.lineType as BillingInvoiceLineType,
        description: line.description ?? null,
        featureKey: line.featureKey ?? null,
        quantity: new Prisma.Decimal(line.quantity ?? 1),
        unitAmountCents: line.unitAmountCents,
        amountCents: line.amountCents,
        usagePeriodStart: line.usagePeriodStart ? new Date(line.usagePeriodStart) : null,
        usagePeriodEnd: line.usagePeriodEnd ? new Date(line.usagePeriodEnd) : null,
        metadata: (line.metadata as Prisma.JsonValue | undefined) ?? null
      });
    }

    if (preparedLines.length === 0 && !payload.taxCents && !payload.settle) {
      throw new Error("Invoice job did not produce any billable lines");
    }

    const taxCents =
      payload.taxCents ??
      (payload.taxRateBps !== undefined
        ? Math.round((subtotalCents * payload.taxRateBps) / 10_000)
        : 0);

    const totalCents = subtotalCents + taxCents;

    const invoice = await createBillingInvoice(claims, {
      organizationId: payload.organizationId,
      subscriptionId: subscription.id,
      number: invoiceNumber,
      status: payload.status as BillingInvoiceStatus,
      currency: payload.currency ?? subscription.currency ?? "usd",
      subtotalCents,
      taxCents,
      totalCents,
      balanceCents: totalCents,
      issuedAt,
      dueAt,
      metadata: payload.metadata as Prisma.JsonValue | undefined
    });

    for (const line of preparedLines) {
      await addBillingInvoiceLine(claims, {
        invoiceId: invoice.id,
        lineType: line.lineType,
        description: line.description ?? undefined,
        featureKey: line.featureKey ?? undefined,
        quantity: line.quantity,
        unitAmountCents: line.unitAmountCents,
        amountCents: line.amountCents,
        usagePeriodStart: line.usagePeriodStart ?? undefined,
        usagePeriodEnd: line.usagePeriodEnd ?? undefined,
        metadata: line.metadata ?? undefined
      });
    }

    if (taxCents > 0) {
      await addBillingInvoiceLine(claims, {
        invoiceId: invoice.id,
        lineType: "TAX",
        description: "Tax",
        quantity: 1,
        unitAmountCents: taxCents,
        amountCents: taxCents
      });
    }

    let finalInvoice = invoice;
    if (payload.settle) {
      const amount = payload.settle.amountCents ?? totalCents;
      const paidAt = payload.settle.paidAt ? new Date(payload.settle.paidAt) : new Date();
      finalInvoice = await recordBillingInvoicePayment(claims, invoice.id, amount, paidAt);
    }

    const durationMs = performance.now() - startedAt;
    const lineCount = preparedLines.length + (taxCents > 0 ? 1 : 0);

    reply.code(200);
    return {
      invoiceId: finalInvoice.id,
      status: finalInvoice.status,
      subtotalCents,
      taxCents,
      totalCents,
      lineCount,
      durationMs
    };
  });

  fastify.post("/payment-sync", async (request, reply) => {
    if (!env.IDENTITY_BILLING_ENABLED) {
      reply.status(404);
      return { error: "billing_disabled" };
    }

    const payload = paymentSyncJobSchema.parse(request.body ?? {});
    const startedAt = performance.now();
    const claims = buildServiceRoleClaims(payload.organizationId);

    const invoice = await getBillingInvoiceById(claims, payload.invoiceId);
    if (!invoice) {
      throw new Error(`Invoice ${payload.invoiceId} not found`);
    }

    let updatedInvoice: BillingInvoice;
    let action: "PAYMENT_RECORDED" | "STATUS_UPDATED" | "CREDIT_ISSUED";

    switch (payload.event) {
      case "payment_succeeded": {
        const amount = payload.amountCents ?? invoice.totalCents;
        const paidAt = payload.paidAt ? new Date(payload.paidAt) : new Date();
        updatedInvoice = await recordBillingInvoicePayment(claims, invoice.id, amount, paidAt);
        action = "PAYMENT_RECORDED";
        break;
      }
      case "payment_failed": {
        const status = payload.status ?? "UNCOLLECTIBLE";
        updatedInvoice = await updateBillingInvoiceStatus(claims, invoice.id, status, {
          metadata: payload.metadata ?? undefined
        });
        action = "STATUS_UPDATED";
        break;
      }
      case "payment_disputed": {
        const amount = resolveCreditAmount(payload, invoice);
        await createBillingCreditMemo(claims, {
          organizationId: payload.organizationId,
          invoiceId: invoice.id,
          amountCents: amount,
          currency: invoice.currency,
          reason: resolveCreditReason(payload, "SERVICE_FAILURE"),
          metadata: payload.credit?.metadata ?? payload.metadata ?? undefined
        });
        const status = payload.status ?? "UNCOLLECTIBLE";
        updatedInvoice = await updateBillingInvoiceStatus(claims, invoice.id, status, {
          metadata: payload.metadata ?? undefined
        });
        action = "CREDIT_ISSUED";
        break;
      }
      case "payment_refunded": {
        const amount = resolveCreditAmount(payload, invoice);
        await createBillingCreditMemo(claims, {
          organizationId: payload.organizationId,
          invoiceId: invoice.id,
          amountCents: amount,
          currency: invoice.currency,
          reason: resolveCreditReason(payload, "REFUND"),
          metadata: payload.credit?.metadata ?? payload.metadata ?? undefined
        });
        const status = payload.status ?? "VOID";
        const voidedAt = payload.paidAt ? new Date(payload.paidAt) : new Date();
        updatedInvoice = await updateBillingInvoiceStatus(claims, invoice.id, status, {
          voidedAt,
          metadata: payload.metadata ?? undefined
        });
        action = "CREDIT_ISSUED";
        break;
      }
      case "sync_status": {
        const status = payload.status ?? invoice.status;
        updatedInvoice = await updateBillingInvoiceStatus(claims, invoice.id, status, {
          metadata: payload.metadata ?? undefined
        });
        action = "STATUS_UPDATED";
        break;
      }
      default: {
        throw new Error(`Unhandled payment sync event: ${payload.event}`);
      }
    }

    const durationMs = performance.now() - startedAt;

    reply.code(200);
    return {
      invoiceId: updatedInvoice.id,
      status: updatedInvoice.status,
      action,
      durationMs
    };
  });
};

export default billingInternalRoutes;
