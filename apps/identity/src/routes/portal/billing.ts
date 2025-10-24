import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  DEFAULT_PORTAL_ROLE_PERMISSIONS,
  PortalBillingOverviewResponseSchema,
  PortalBillingUsageResponseSchema,
  PortalBillingSubscriptionChangeRequestSchema,
  PortalBillingSubscriptionChangeResponseSchema,
  PortalBillingSubscriptionCancelRequestSchema,
  PortalBillingInvoiceListResponseSchema,
  PortalBillingContactsResponseSchema,
  PortalBillingContactsUpdateRequestSchema,
  PortalBillingPaymentMethodsResponseSchema,
  PortalBillingPaymentMethodUpsertRequestSchema,
  PortalBillingSetDefaultPaymentMethodRequestSchema,
  BillingUsageQuerySchema
} from "@ma/contracts";
import { buildServiceRoleClaims, env } from "@ma/core";
import {
  getOrganizationMember,
  listPortalRolePermissionsForOrganization,
  getActiveBillingSubscriptionForOrganization,
  getBillingPackageById,
  listBillingSubscriptionSchedules,
  listBillingUsageAggregates,
  listBillingInvoicesForOrganization,
  listBillingPaymentMethodsForOrganization,
  upsertBillingPaymentMethod,
  setDefaultBillingPaymentMethod,
  removeBillingPaymentMethod,
  listBillingContacts,
  replaceBillingContacts,
  listBillingTaxIds,
  updateBillingSubscription,
  scheduleBillingSubscriptionChange,
  cancelBillingSubscription
} from "@ma/db";
import type { BillingSubscription } from "@ma/db";
import { resolveOrganizationIdFromClaims } from "../../lib/claims";

const normalizeRole = (role: string | null | undefined): string =>
  typeof role === "string" && role.length > 0 ? role.toUpperCase() : "MEMBER";

const buildPortalPermissionMap = (
  records: Array<{ role: string; permissions: string[] }>
): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const [role, permissions] of Object.entries(DEFAULT_PORTAL_ROLE_PERMISSIONS)) {
    map.set(role.toUpperCase(), permissions.slice());
  }

  for (const record of records) {
    map.set(normalizeRole(record.role), record.permissions.slice());
  }

  return map;
};

const resolvePortalPermissionSet = (
  role: string | null | undefined,
  permissionMap: Map<string, string[]>
): Set<string> => {
  const normalizedRole = normalizeRole(role);
  const fallback = permissionMap.get("MEMBER") ?? DEFAULT_PORTAL_ROLE_PERMISSIONS.MEMBER ?? [];
  const permissions = permissionMap.get(normalizedRole) ?? fallback;
  return new Set(permissions);
};

const ensureFeatureEnabled = () => {
  if (!env.PORTAL_BILLING_ENABLED) {
    const disabledError = new Error("portal_billing_disabled");
    disabledError.name = "PortalBillingDisabled";
    throw disabledError;
  }
};

type UsagePoint = {
  periodStart: string;
  periodEnd: string;
  quantity: string;
  unit: string;
  source: string;
};

const resolveOrganizationContext = async (request: FastifyRequest) => {
  const claims = request.supabaseClaims;
  if (!claims?.sub) {
    const error = new Error("not_authenticated");
    error.name = "Unauthorized";
    throw error;
  }

  const organizationId = resolveOrganizationIdFromClaims(claims);
  if (!organizationId) {
    const error = new Error("organization_context_missing");
    error.name = "BadRequest";
    throw error;
  }

  const [membership, customPermissions] = await Promise.all([
    getOrganizationMember(buildServiceRoleClaims(organizationId), organizationId, claims.sub),
    listPortalRolePermissionsForOrganization(buildServiceRoleClaims(organizationId), organizationId)
  ]);

  if (!membership) {
    const error = new Error("membership_not_found");
    error.name = "Forbidden";
    throw error;
  }

  const permissionMap = buildPortalPermissionMap(
    customPermissions.map((record) => ({ role: record.role, permissions: record.permissions }))
  );
  const permissionSet = resolvePortalPermissionSet(membership.role, permissionMap);

  return {
    claims,
    organizationId,
    membership,
    permissionSet
  };
};

const ensureBillingPermission = (context: Awaited<ReturnType<typeof resolveOrganizationContext>>) => {
  if (!context.permissionSet.has("organization:billing")) {
    const error = new Error("forbidden");
    error.name = "Forbidden";
    throw error;
  }
};

const serializeSubscription = (subscription: BillingSubscription | null) => {
  if (!subscription) return null;
  return {
    ...subscription,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    trialEndsAt: subscription.trialEndsAt ? subscription.trialEndsAt.toISOString() : null,
    canceledAt: subscription.canceledAt ? subscription.canceledAt.toISOString() : null
  };
};

const billingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    try {
      ensureFeatureEnabled();
      await resolveOrganizationContext(request);
    } catch (error) {
      if ((error as Error).name === "PortalBillingDisabled") {
        reply.status(404);
        reply.send({ error: "billing_disabled" });
        return reply;
      }
      if ((error as Error).name === "Unauthorized") {
        reply.status(401);
        reply.send({ error: "not_authenticated" });
        return reply;
      }
      if ((error as Error).name === "BadRequest") {
        reply.status(400);
        reply.send({ error: (error as Error).message });
        return reply;
      }
      if ((error as Error).name === "Forbidden") {
        reply.status(403);
        reply.send({ error: "forbidden" });
        return reply;
      }
      throw error;
    }
  });

  fastify.get("/overview", async (request, reply) => {
    try {
      const context = await resolveOrganizationContext(request);
      ensureBillingPermission(context);

      const serviceClaims = buildServiceRoleClaims(context.organizationId);

      const subscriptionRecord = await getActiveBillingSubscriptionForOrganization(
        serviceClaims,
        context.organizationId
      );
      const subscriptionId = subscriptionRecord?.id ?? null;

      const [schedules, paymentMethods, contacts, taxIds, invoices, usageAggregates] = await Promise.all([
        subscriptionId
          ? listBillingSubscriptionSchedules(serviceClaims, subscriptionId)
          : Promise.resolve([]),
        listBillingPaymentMethodsForOrganization(serviceClaims, context.organizationId),
        listBillingContacts(serviceClaims, context.organizationId),
        listBillingTaxIds(serviceClaims, context.organizationId),
        listBillingInvoicesForOrganization(serviceClaims, context.organizationId, { includeLines: true }),
        listBillingUsageAggregates(serviceClaims, context.organizationId, {
          subscriptionId: subscriptionId ?? undefined,
          resolution: "MONTHLY",
          limit: 24
        })
      ]);

      const activeSubscription = subscriptionRecord
        ? serializeSubscription(subscriptionRecord)
        : null;

      const activePackage = subscriptionRecord
        ? await getBillingPackageById(serviceClaims, subscriptionRecord.packageId)
        : null;

      const packageLimits = new Map(
        activePackage?.featureLimits.map((limit) => [limit.featureKey, limit]) ?? []
      );

      const usageSummaries = usageAggregates.map((aggregate) => {
        const limit = packageLimits.get(aggregate.featureKey);
        const quantity = aggregate.quantity.toString();
        const limitValue = limit?.limitValue ?? null;
        const percentageUsed =
          limitValue && limitValue > 0
            ? Number(aggregate.quantity.toNumber() / limitValue * 100)
            : null;

        return {
          featureKey: aggregate.featureKey,
          resolution: aggregate.resolution,
          totalQuantity: quantity,
          unit: aggregate.unit,
          periodStart: aggregate.periodStart.toISOString(),
          periodEnd: aggregate.periodEnd.toISOString(),
          limitType: limit?.limitType ?? null,
          limitValue,
          limitUnit: limit?.limitUnit ?? null,
          usagePeriod: limit?.usagePeriod ?? null,
          percentageUsed: percentageUsed !== null ? Number(percentageUsed.toFixed(2)) : null
        };
      });

      const featureWarnings = usageSummaries
        .filter((summary) => summary.percentageUsed !== null && summary.percentageUsed >= 80)
        .map((summary) => ({
          featureKey: summary.featureKey,
          status: summary.percentageUsed && summary.percentageUsed >= 100 ? "exceeded" : "approaching",
          thresholdPercent: 80,
          currentPercent: summary.percentageUsed ?? 0,
          message:
            summary.percentageUsed && summary.percentageUsed >= 100
              ? "This feature has exceeded its plan limit."
              : "This feature is approaching its plan limit."
        }));

      const outstandingBalanceCents = invoices
        .filter((invoice) => ["OPEN", "UNCOLLECTIBLE"].includes(invoice.status))
        .reduce((total, invoice) => total + invoice.balanceCents, 0);

      const upcomingInvoice = invoices
        .filter((invoice) => ["OPEN", "DRAFT"].includes(invoice.status))
        .sort((a, b) => (a.dueAt ?? a.issuedAt).getTime() - (b.dueAt ?? b.issuedAt).getTime())[0] ?? null;

      const recentInvoices = invoices
        .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())
        .slice(0, 5)
        .map((invoice) => ({
          ...invoice,
          issuedAt: invoice.issuedAt.toISOString(),
          dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
          paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
          voidedAt: invoice.voidedAt ? invoice.voidedAt.toISOString() : null,
          lines: invoice.lines?.map((line) => ({
            ...line,
            usagePeriodStart: line.usagePeriodStart ? line.usagePeriodStart.toISOString() : null,
            usagePeriodEnd: line.usagePeriodEnd ? line.usagePeriodEnd.toISOString() : null,
            quantity: line.quantity.toString()
          }))
        }));

      const overview = PortalBillingOverviewResponseSchema.parse({
        overview: {
          organizationId: context.organizationId,
          subscription: activeSubscription,
          activePackage: activePackage ?? null,
          scheduledChanges: schedules.map((schedule) => ({
            ...schedule,
            effectiveAt: schedule.effectiveAt.toISOString()
          })),
          usageSummaries,
          paymentMethods: paymentMethods,
          defaultPaymentMethodId: paymentMethods.find((method) => method.isDefault)?.id ?? null,
          contacts,
          taxIds,
          outstandingBalanceCents,
          upcomingInvoice: upcomingInvoice
            ? {
                ...upcomingInvoice,
                issuedAt: upcomingInvoice.issuedAt.toISOString(),
                dueAt: upcomingInvoice.dueAt ? upcomingInvoice.dueAt.toISOString() : null,
                paidAt: upcomingInvoice.paidAt ? upcomingInvoice.paidAt.toISOString() : null,
                voidedAt: upcomingInvoice.voidedAt ? upcomingInvoice.voidedAt.toISOString() : null,
                lines: upcomingInvoice.lines?.map((line) => ({
                  ...line,
                  usagePeriodStart: line.usagePeriodStart ? line.usagePeriodStart.toISOString() : null,
                  usagePeriodEnd: line.usagePeriodEnd ? line.usagePeriodEnd.toISOString() : null,
                  quantity: line.quantity.toString()
                }))
              }
            : null,
          recentInvoices,
          featureWarnings,
          metadata: activeSubscription?.metadata ?? null,
          lastUpdated: new Date().toISOString()
        }
      });

      reply.header("Cache-Control", "no-store");
      return overview;
    } catch (error) {
      if ((error as Error).name === "Forbidden") {
        reply.status(403);
        return { error: "forbidden" };
      }
      if ((error as Error).name === "BadRequest") {
        reply.status(400);
        return { error: (error as Error).message };
      }
      throw error;
    }
  });

  fastify.get("/usage", async (request, reply) => {
    const query = BillingUsageQuerySchema.parse(request.query ?? {});

    const context = await resolveOrganizationContext(request);
    ensureBillingPermission(context);

    const serviceClaims = buildServiceRoleClaims(context.organizationId);

    const aggregates = await listBillingUsageAggregates(serviceClaims, context.organizationId, {
      featureKey: query.featureKey,
      resolution: query.resolution,
      subscriptionId: undefined,
      periodStart: query.from ? new Date(query.from) : undefined,
      periodEnd: query.to ? new Date(query.to) : undefined,
      limit: 200
    });

    const grouped = new Map<
      string,
      { featureKey: string; unit: string; resolution: string; points: UsagePoint[] }
    >();

    for (const aggregate of aggregates) {
      const key = `${aggregate.featureKey}:${aggregate.unit}:${aggregate.resolution}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          featureKey: aggregate.featureKey,
          unit: aggregate.unit,
          resolution: aggregate.resolution,
          points: []
        });
      }
      grouped.get(key)!.points.push({
        periodStart: aggregate.periodStart.toISOString(),
        periodEnd: aggregate.periodEnd.toISOString(),
        quantity: aggregate.quantity.toString(),
        unit: aggregate.unit,
        source: aggregate.source
      });
    }

    const series = Array.from(grouped.values()).map((entry) => ({
      featureKey: entry.featureKey,
      unit: entry.unit,
      resolution: entry.resolution,
      points: entry.points.map((point) => ({
        periodStart: point.periodStart,
        periodEnd: point.periodEnd,
        quantity: point.quantity,
        unit: point.unit,
        source: point.source
      }))
    }));

    const summaries = series.map((entry) => {
      const total = entry.points.reduce((sum, point) => sum + Number(point.quantity), 0);
      return {
        featureKey: entry.featureKey,
        resolution: entry.resolution,
        totalQuantity: total.toString(),
        unit: entry.unit,
        periodStart: entry.points.at(-1)?.periodStart ?? entry.points[0]?.periodStart ?? new Date().toISOString(),
        periodEnd: entry.points[0]?.periodEnd ?? entry.points.at(-1)?.periodEnd ?? new Date().toISOString(),
        limitType: null,
        limitValue: null,
        limitUnit: null,
        usagePeriod: null,
        percentageUsed: null
      };
    });

    const payload = PortalBillingUsageResponseSchema.parse({
      series,
      summaries
    });

    reply.header("Cache-Control", "no-store");
    return payload;
  });

  fastify.post("/subscription/change", async (request, reply) => {
    const context = await resolveOrganizationContext(request);
    ensureBillingPermission(context);

    const parsed = PortalBillingSubscriptionChangeRequestSchema.parse(request.body);
    const serviceClaims = buildServiceRoleClaims(context.organizationId);

    const subscription = await getActiveBillingSubscriptionForOrganization(
      serviceClaims,
      context.organizationId
    );

    if (!subscription) {
      reply.status(404);
      return { error: "subscription_not_found" };
    }

    const targetPackage = await getBillingPackageById(serviceClaims, parsed.packageId);
    if (!targetPackage) {
      reply.status(404);
      return { error: "package_not_found" };
    }

    if (parsed.timing === "immediate") {
      await updateBillingSubscription(serviceClaims, subscription.id, {
        packageId: targetPackage.id,
        amountCents: targetPackage.amountCents,
        billingInterval: targetPackage.interval,
        currency: targetPackage.currency,
        metadata: parsed.metadata ?? undefined
      });
    } else if (parsed.timing === "scheduled") {
      if (!parsed.effectiveAt) {
        reply.status(400);
        return { error: "effective_at_required" };
      }
      await scheduleBillingSubscriptionChange(serviceClaims, {
        subscriptionId: subscription.id,
        targetPackageId: targetPackage.id,
        effectiveAt: new Date(parsed.effectiveAt),
        metadata: parsed.metadata ?? null
      });
    } else {
      await scheduleBillingSubscriptionChange(serviceClaims, {
        subscriptionId: subscription.id,
        targetPackageId: targetPackage.id,
        effectiveAt: subscription.currentPeriodEnd,
        metadata: parsed.metadata ?? null
      });
    }

    const [updatedSubscription, schedules] = await Promise.all([
      getActiveBillingSubscriptionForOrganization(serviceClaims, context.organizationId).then((record) =>
        record ? serializeSubscription(record) : null
      ),
      subscription.id ? listBillingSubscriptionSchedules(serviceClaims, subscription.id).then((records) =>
        records.map((schedule) => ({
          ...schedule,
          effectiveAt: schedule.effectiveAt.toISOString()
        }))
      ) : Promise.resolve([])
    ]);

    const response = PortalBillingSubscriptionChangeResponseSchema.parse({
      subscription: updatedSubscription,
      schedules
    });

    reply.header("Cache-Control", "no-store");
    return response;
  });

  fastify.post("/subscription/cancel", async (request, reply) => {
    const context = await resolveOrganizationContext(request);
    ensureBillingPermission(context);
    const parsed = PortalBillingSubscriptionCancelRequestSchema.parse(request.body ?? {});
    const serviceClaims = buildServiceRoleClaims(context.organizationId);

    const subscription = await getActiveBillingSubscriptionForOrganization(
      serviceClaims,
      context.organizationId
    );

    if (!subscription) {
      reply.status(404);
      return { error: "subscription_not_found" };
    }

    if (parsed.cancelAtPeriodEnd) {
      await updateBillingSubscription(serviceClaims, subscription.id, {
        cancelAtPeriodEnd: true,
        metadata: parsed.reason ? { cancelReason: parsed.reason } : undefined
      });
    } else {
      await cancelBillingSubscription(serviceClaims, subscription.id, {
        invoiceThruPeriod: false
      });
    }

    const [updatedSubscription, schedules] = await Promise.all([
      getActiveBillingSubscriptionForOrganization(serviceClaims, context.organizationId).then((record) =>
        record ? serializeSubscription(record) : null
      ),
      subscription.id ? listBillingSubscriptionSchedules(serviceClaims, subscription.id).then((records) =>
        records.map((schedule) => ({
          ...schedule,
          effectiveAt: schedule.effectiveAt.toISOString()
        }))
      ) : Promise.resolve([])
    ]);

    const response = PortalBillingSubscriptionChangeResponseSchema.parse({
      subscription: updatedSubscription,
      schedules
    });

    reply.header("Cache-Control", "no-store");
    return response;
  });

  fastify.get("/invoices", async (request, reply) => {
    const context = await resolveOrganizationContext(request);
    ensureBillingPermission(context);
    const serviceClaims = buildServiceRoleClaims(context.organizationId);

    const invoices = await listBillingInvoicesForOrganization(serviceClaims, context.organizationId, {
      includeLines: true
    });

    const payload = PortalBillingInvoiceListResponseSchema.parse({
      invoices: invoices.map((invoice) => ({
        ...invoice,
        issuedAt: invoice.issuedAt.toISOString(),
        dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
        paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
        voidedAt: invoice.voidedAt ? invoice.voidedAt.toISOString() : null,
        lines: invoice.lines?.map((line) => ({
          ...line,
          quantity: line.quantity.toString(),
          usagePeriodStart: line.usagePeriodStart ? line.usagePeriodStart.toISOString() : null,
          usagePeriodEnd: line.usagePeriodEnd ? line.usagePeriodEnd.toISOString() : null
        }))
      }))
    });

    reply.header("Cache-Control", "no-store");
    return payload;
  });

  fastify.get("/contacts", async (request, reply) => {
    const context = await resolveOrganizationContext(request);
    ensureBillingPermission(context);
    const serviceClaims = buildServiceRoleClaims(context.organizationId);

    const [contacts, taxIds] = await Promise.all([
      listBillingContacts(serviceClaims, context.organizationId),
      listBillingTaxIds(serviceClaims, context.organizationId)
    ]);

    const payload = PortalBillingContactsResponseSchema.parse({ contacts, taxIds });

    reply.header("Cache-Control", "no-store");
    return payload;
  });

  fastify.patch("/contacts", async (request, reply) => {
    const context = await resolveOrganizationContext(request);
    ensureBillingPermission(context);
    const parsed = PortalBillingContactsUpdateRequestSchema.parse(request.body);

    const serviceClaims = buildServiceRoleClaims(context.organizationId);

    const contacts = await replaceBillingContacts(
      serviceClaims,
      context.organizationId,
      parsed.contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        role: contact.role,
        phone: contact.phone ?? null,
        metadata: contact.metadata ?? null
      }))
    );

    const existingTaxIds = await listBillingTaxIds(serviceClaims, context.organizationId);

    const payload = PortalBillingContactsResponseSchema.parse({
      contacts,
      taxIds: existingTaxIds
    });

    reply.header("Cache-Control", "no-store");
    return payload;
  });

  fastify.get("/payment-methods", async (request, reply) => {
    const context = await resolveOrganizationContext(request);
    ensureBillingPermission(context);
    const serviceClaims = buildServiceRoleClaims(context.organizationId);

    const paymentMethods = await listBillingPaymentMethodsForOrganization(
      serviceClaims,
      context.organizationId
    );

    const payload = PortalBillingPaymentMethodsResponseSchema.parse({
      paymentMethods,
      defaultPaymentMethodId: paymentMethods.find((method) => method.isDefault)?.id ?? null
    });

    reply.header("Cache-Control", "no-store");
    return payload;
  });

  fastify.post("/payment-methods", async (request, reply) => {
    const context = await resolveOrganizationContext(request);
    ensureBillingPermission(context);
    const parsed = PortalBillingPaymentMethodUpsertRequestSchema.parse(request.body);
    const serviceClaims = buildServiceRoleClaims(context.organizationId);

    let providerHandled = false;

    try {
      const providerResult = await fastify.paymentProvider.syncPaymentMethod({
        organizationId: context.organizationId,
        paymentMethodId: parsed.providerId,
        setDefault: parsed.setDefault ?? false
      });
      providerHandled = Boolean(providerResult);
    } catch (error) {
      fastify.log.error(
        { error, organizationId: context.organizationId, providerId: parsed.providerId },
        "Failed to synchronize payment method with provider"
      );
    }

    if (!providerHandled) {
      await upsertBillingPaymentMethod(serviceClaims, {
        organizationId: context.organizationId,
        providerId: parsed.providerId,
        type: parsed.type,
        status: parsed.status ?? "ACTIVE",
        reference: parsed.reference ?? null,
        brand: parsed.brand ?? null,
        last4: parsed.last4 ?? null,
        expMonth: parsed.expMonth ?? null,
        expYear: parsed.expYear ?? null,
        isDefault: parsed.setDefault ?? false,
        metadata: parsed.metadata ?? null
      });
    }

    const paymentMethods = await listBillingPaymentMethodsForOrganization(
      serviceClaims,
      context.organizationId
    );

    const payload = PortalBillingPaymentMethodsResponseSchema.parse({
      paymentMethods,
      defaultPaymentMethodId: paymentMethods.find((method) => method.isDefault)?.id ?? null
    });

    reply.header("Cache-Control", "no-store");
    return payload;
  });

  fastify.patch("/payment-methods/default", async (request, reply) => {
    const context = await resolveOrganizationContext(request);
    ensureBillingPermission(context);
    const parsed = PortalBillingSetDefaultPaymentMethodRequestSchema.parse(request.body);
    const serviceClaims = buildServiceRoleClaims(context.organizationId);

    const currentMethods = await listBillingPaymentMethodsForOrganization(
      serviceClaims,
      context.organizationId
    );

    const targetMethod = currentMethods.find((method) => method.id === parsed.paymentMethodId);

    if (!targetMethod) {
      reply.status(404);
      return { error: "payment_method_not_found" };
    }

    if (targetMethod.providerId && targetMethod.providerId.length > 0) {
      try {
        await fastify.paymentProvider.syncPaymentMethod({
          organizationId: context.organizationId,
          paymentMethodId: targetMethod.providerId,
          setDefault: true
        });
      } catch (error) {
        fastify.log.error(
          { error, organizationId: context.organizationId, paymentMethodId: parsed.paymentMethodId },
          "Failed to set default payment method with provider; falling back to datastore update"
        );
      }
    }

    await setDefaultBillingPaymentMethod(
      serviceClaims,
      context.organizationId,
      parsed.paymentMethodId
    );

    const paymentMethods = await listBillingPaymentMethodsForOrganization(
      serviceClaims,
      context.organizationId
    );

    const payload = PortalBillingPaymentMethodsResponseSchema.parse({
      paymentMethods,
      defaultPaymentMethodId: paymentMethods.find((method) => method.isDefault)?.id ?? null
    });

    reply.header("Cache-Control", "no-store");
    return payload;
  });

  fastify.delete("/payment-methods/:paymentMethodId", async (request, reply) => {
    const context = await resolveOrganizationContext(request);
    ensureBillingPermission(context);
    const paramsSchema = z.object({ paymentMethodId: z.string().min(1) });
    const params = paramsSchema.parse(request.params);
    const serviceClaims = buildServiceRoleClaims(context.organizationId);

    await removeBillingPaymentMethod(serviceClaims, params.paymentMethodId);

    const paymentMethods = await listBillingPaymentMethodsForOrganization(
      serviceClaims,
      context.organizationId
    );

    const payload = PortalBillingPaymentMethodsResponseSchema.parse({
      paymentMethods,
      defaultPaymentMethodId: paymentMethods.find((method) => method.isDefault)?.id ?? null
    });

    reply.header("Cache-Control", "no-store");
    return payload;
  });
};

export default billingRoutes;
