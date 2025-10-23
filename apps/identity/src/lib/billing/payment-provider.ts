import Stripe from "stripe";
import { buildServiceRoleClaims, env, logger } from "@ma/core";
import {
  Prisma,
  getOrganizationById,
  listBillingContacts,
  upsertBillingPaymentMethod,
  setDefaultBillingPaymentMethod
} from "@ma/db";
import type {
  BillingContact,
  BillingPaymentMethodStatus,
  BillingPaymentMethodType
} from "@ma/db";

const STRIPE_API_VERSION = "2023-10-16" as Stripe.LatestApiVersion;
const METADATA_ORGANIZATION_ID = "gn_organization_id";
const METADATA_INVOICE_ID = "gn_invoice_id";

export interface SyncCustomerOptions {
  organizationId: string;
}

export interface SyncPaymentMethodOptions {
  organizationId: string;
  paymentMethodId: string;
  setDefault?: boolean;
}

export interface PaymentMethodSyncResult {
  providerId: string;
  type: BillingPaymentMethodType;
  status: BillingPaymentMethodStatus;
  reference?: string | null;
  brand?: string | null;
  last4?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
  isDefault?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface HandleWebhookOptions {
  rawBody: string | Buffer;
  signature?: string;
  emitPaymentSyncJob: (name: string, payload: Record<string, unknown>) => Promise<void>;
}

export interface PaymentProvider {
  syncCustomer(options: SyncCustomerOptions): Promise<string | null>;
  syncPaymentMethod(
    options: SyncPaymentMethodOptions
  ): Promise<PaymentMethodSyncResult | null>;
  handleWebhook?(options: HandleWebhookOptions): Promise<void>;
}

class NoopPaymentProvider implements PaymentProvider {
  async syncCustomer(): Promise<string | null> {
    return null;
  }

  async syncPaymentMethod(): Promise<PaymentMethodSyncResult | null> {
    return null;
  }

  async handleWebhook(): Promise<void> {
    return;
  }
}

interface StripePaymentProviderDeps {
  apiKey: string;
  webhookSecret?: string | null;
}

class StripePaymentProvider implements PaymentProvider {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string | null;

  constructor(options: StripePaymentProviderDeps) {
    this.stripe = new Stripe(options.apiKey, { apiVersion: STRIPE_API_VERSION });
    this.webhookSecret = options.webhookSecret ?? null;
  }

  private isDeletedCustomer(
    customer: Stripe.Customer | Stripe.DeletedCustomer
  ): customer is Stripe.DeletedCustomer {
    return "deleted" in customer && customer.deleted === true;
  }

  async syncCustomer({ organizationId }: SyncCustomerOptions): Promise<string | null> {
    const claims = buildServiceRoleClaims(organizationId);
    const organization = await getOrganizationById(claims, organizationId);
    if (!organization) {
      logger.warn(
        { organizationId },
        "Stripe payment provider: organization not found during customer sync"
      );
      return null;
    }

    const contacts = await listBillingContacts(claims, organizationId);
    const primaryContact =
      contacts.find((contact) => contact.role === "primary") ??
      contacts.find((contact) => contact.role === "finance") ??
      contacts[0] ??
      null;

    const existingCustomer = await this.findCustomerByOrganization(organizationId);

    if (existingCustomer) {
      if (this.isDeletedCustomer(existingCustomer)) {
        logger.warn(
          { organizationId, customerId: existingCustomer.id },
          "Stripe payment provider: existing customer was deleted; creating replacement"
        );
      } else {
        await this.updateCustomer(
          existingCustomer,
          organizationId,
          organization.name,
          primaryContact
        );
        return existingCustomer.id;
      }
    }

    const customer = await this.stripe.customers.create({
      name: organization.name,
      email: primaryContact?.email ?? undefined,
      phone: primaryContact?.phone ?? undefined,
      metadata: {
        [METADATA_ORGANIZATION_ID]: organizationId
      }
    });

    logger.info(
      { organizationId, customerId: customer.id },
      "Stripe payment provider: created new customer"
    );

    return customer.id;
  }

  async syncPaymentMethod(
    options: SyncPaymentMethodOptions
  ): Promise<PaymentMethodSyncResult | null> {
    const customerId = await this.syncCustomer({ organizationId: options.organizationId });
    if (!customerId) {
      return null;
    }

    let paymentMethod = await this.stripe.paymentMethods.retrieve(options.paymentMethodId);

    const attachedCustomerId =
      typeof paymentMethod.customer === "string" ? paymentMethod.customer : null;

    if (attachedCustomerId && attachedCustomerId !== customerId) {
      await this.stripe.paymentMethods.detach(paymentMethod.id).catch((error: unknown) => {
        logger.warn(
          { paymentMethodId: paymentMethod.id, error },
          "Stripe payment provider: failed to detach payment method before reattachment"
        );
      });
    }

    if (!attachedCustomerId || attachedCustomerId !== customerId) {
      paymentMethod = await this.stripe.paymentMethods.attach(paymentMethod.id, {
        customer: customerId
      });
    }

    if (options.setDefault) {
      await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethod.id
        }
      });
    }

    const customer = await this.stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"]
    });

    if (this.isDeletedCustomer(customer)) {
      logger.warn(
        { organizationId: options.organizationId, customerId },
        "Stripe payment provider: customer deleted while syncing payment method"
      );
      return null;
    }

    const defaultPaymentMethodId =
      typeof customer.invoice_settings?.default_payment_method === "string"
        ? customer.invoice_settings.default_payment_method
        : customer.invoice_settings?.default_payment_method?.id ?? null;

    const isDefault = options.setDefault ?? defaultPaymentMethodId === paymentMethod.id;
    const details = this.mapPaymentMethod(paymentMethod, customerId, isDefault);
    const claims = buildServiceRoleClaims(options.organizationId);

    const metadataJson =
      details.metadata != null
        ? (details.metadata as unknown as Prisma.JsonValue)
        : undefined;

    const record = await upsertBillingPaymentMethod(claims, {
      organizationId: options.organizationId,
      providerId: details.providerId,
      type: details.type,
      status: details.status,
      reference: details.reference ?? null,
      brand: details.brand ?? null,
      last4: details.last4 ?? null,
      expMonth: details.expMonth ?? null,
      expYear: details.expYear ?? null,
      isDefault: details.isDefault ?? false,
      metadata: metadataJson
    });

    if (details.isDefault) {
      await setDefaultBillingPaymentMethod(
        claims,
        options.organizationId,
        record.id
      ).catch((error: unknown) => {
        logger.warn(
          { organizationId: options.organizationId, paymentMethodId: record.id, error },
          "Stripe payment provider: failed to set default payment method in datastore"
        );
      });
    }

    return details;
  }

  async handleWebhook(options: HandleWebhookOptions): Promise<void> {
    if (!this.webhookSecret) {
      logger.warn(
        "Stripe payment provider: webhook secret missing; ignoring webhook event"
      );
      return;
    }

    if (!options.signature) {
      throw new Error("Missing Stripe signature header");
    }

    const payloadBuffer =
      typeof options.rawBody === "string"
        ? Buffer.from(options.rawBody)
        : options.rawBody;

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payloadBuffer,
        options.signature,
        this.webhookSecret
      );
    } catch (error) {
      logger.error({ error }, "Stripe payment provider: invalid webhook signature");
      throw error;
    }

    switch (event.type) {
      case "invoice.paid": {
        await this.handleInvoiceEvent(event, "payment_succeeded", options.emitPaymentSyncJob);
        break;
      }
      case "invoice.payment_failed": {
        await this.handleInvoiceEvent(event, "payment_failed", options.emitPaymentSyncJob);
        break;
      }
      case "charge.refunded": {
        await this.handleChargeEvent(event, "payment_refunded", options.emitPaymentSyncJob);
        break;
      }
      case "charge.dispute.created":
      case "charge.dispute.closed": {
        await this.handleDisputeEvent(event, options.emitPaymentSyncJob);
        break;
      }
      default: {
        logger.debug({ eventType: event.type }, "Stripe payment provider: ignoring webhook");
      }
    }
  }

  private async findCustomerByOrganization(
    organizationId: string
  ): Promise<Stripe.Customer | Stripe.DeletedCustomer | null> {
    try {
      const search = await this.stripe.customers.search({
        query: `${METADATA_ORGANIZATION_ID}:'${organizationId}'`,
        limit: 1
      });

      if (search.data.length > 0) {
        const candidate = search.data[0]!;
        return candidate;
      }
    } catch (error) {
      logger.debug(
        { error, organizationId },
        "Stripe payment provider: customer search failed, falling back to list"
      );
    }

    const customers = await this.stripe.customers.list({ limit: 100 });
    return (
      customers.data.find(
        (customer) => customer.metadata?.[METADATA_ORGANIZATION_ID] === organizationId
      ) ?? null
    );
  }

  private async updateCustomer(
    customer: Stripe.Customer,
    organizationId: string,
    name: string,
    contact: BillingContact | null
  ): Promise<void> {
    await this.stripe.customers.update(customer.id, {
      name,
      email: contact?.email ?? undefined,
      phone: contact?.phone ?? undefined,
      metadata: {
        ...(customer.metadata ?? {}),
        [METADATA_ORGANIZATION_ID]: organizationId
      }
    });
  }

  private mapPaymentMethod(
    paymentMethod: Stripe.PaymentMethod,
    customerId: string,
    isDefault: boolean
  ): PaymentMethodSyncResult {
    const type = this.resolvePaymentMethodType(paymentMethod);
    const status: BillingPaymentMethodStatus = "ACTIVE";

    if (paymentMethod.type === "card" && paymentMethod.card) {
      const card = paymentMethod.card;
      return {
        providerId: paymentMethod.id,
        type,
        status,
        reference: card.fingerprint ?? null,
        brand: card.brand ?? null,
        last4: card.last4 ?? null,
        expMonth: card.exp_month ?? null,
        expYear: card.exp_year ?? null,
        isDefault,
        metadata: {
          provider: "stripe",
          stripeCustomerId: customerId,
          stripePaymentMethodType: paymentMethod.type,
          stripePaymentMethod: paymentMethod.metadata ?? {}
        }
      };
    }

    if (paymentMethod.type === "us_bank_account" && paymentMethod.us_bank_account) {
      const bank = paymentMethod.us_bank_account;
      return {
        providerId: paymentMethod.id,
        type,
        status,
        reference: bank.bank_name ?? null,
        brand: bank.bank_name ?? null,
        last4: bank.last4 ?? null,
        expMonth: null,
        expYear: null,
        isDefault,
        metadata: {
          provider: "stripe",
          stripeCustomerId: customerId,
          stripePaymentMethodType: paymentMethod.type,
          stripePaymentMethod: paymentMethod.metadata ?? {}
        }
      };
    }

    return {
      providerId: paymentMethod.id,
      type,
      status,
      reference: paymentMethod.id,
      brand: paymentMethod.type,
      last4: null,
      expMonth: null,
      expYear: null,
      isDefault,
      metadata: {
        provider: "stripe",
        stripeCustomerId: customerId,
        stripePaymentMethodType: paymentMethod.type,
        stripePaymentMethod: paymentMethod.metadata ?? {}
      }
    };
  }

  private resolvePaymentMethodType(paymentMethod: Stripe.PaymentMethod): BillingPaymentMethodType {
    switch (paymentMethod.type) {
      case "card":
        return "CARD";
      case "us_bank_account":
      case "acss_debit":
      case "au_becs_debit":
      case "bacs_debit":
      case "sepa_debit":
        return "BANK_ACCOUNT";
      default:
        return "EXTERNAL";
    }
  }

  private async handleInvoiceEvent(
    event: Stripe.Event,
    paymentEvent: "payment_succeeded" | "payment_failed",
    emitPaymentSyncJob: (name: string, payload: Record<string, unknown>) => Promise<void>
  ): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const metadata = invoice.metadata ?? {};
    const organizationId = metadata[METADATA_ORGANIZATION_ID];
    const billingInvoiceId = metadata[METADATA_INVOICE_ID];

    if (!organizationId || !billingInvoiceId) {
      logger.warn(
        {
          eventType: event.type,
          invoiceId: invoice.id,
          metadata
        },
        "Stripe payment provider: missing organization or invoice mapping metadata"
      );
      return;
    }

    const amountCents =
      paymentEvent === "payment_succeeded"
        ? invoice.amount_paid ?? invoice.total ?? 0
        : invoice.amount_due ?? invoice.amount_remaining ?? invoice.total ?? 0;

    const paidAtSeconds =
      invoice.status_transitions?.paid_at ?? invoice.status_transitions?.finalized_at ?? invoice.created;
    const paidAt = new Date((paidAtSeconds ?? invoice.created) * 1000).toISOString();

    const payload = {
      organizationId,
      invoiceId: billingInvoiceId,
      event: paymentEvent,
      amountCents,
      paidAt: paymentEvent === "payment_succeeded" ? paidAt : undefined,
      status: paymentEvent === "payment_succeeded" ? "PAID" : "UNCOLLECTIBLE",
      externalPaymentId:
        typeof invoice.payment_intent === "string"
          ? invoice.payment_intent
          : typeof invoice.charge === "string"
            ? invoice.charge
            : undefined,
      metadata: {
        stripeInvoiceId: invoice.id,
        stripeEventId: event.id,
        stripeCustomerId: invoice.customer
      }
    };

    await emitPaymentSyncJob(`stripe.${paymentEvent}`, payload);
  }

  private async handleChargeEvent(
    event: Stripe.Event,
    paymentEvent: "payment_refunded",
    emitPaymentSyncJob: (name: string, payload: Record<string, unknown>) => Promise<void>
  ): Promise<void> {
    const charge = event.data.object as Stripe.Charge;
    const metadata = charge.metadata ?? {};
    const organizationId =
      metadata[METADATA_ORGANIZATION_ID] ??
      (typeof charge.customer === "string" ? await this.resolveOrganizationFromCustomer(charge.customer) : null);
    const billingInvoiceId = metadata[METADATA_INVOICE_ID];

    if (!organizationId || !billingInvoiceId) {
      logger.warn(
        { chargeId: charge.id, metadata },
        "Stripe payment provider: charge refund missing mapping metadata"
      );
      return;
    }

    const amountCents = charge.amount_refunded ?? charge.amount_captured ?? charge.amount;
    const payload = {
      organizationId,
      invoiceId: billingInvoiceId,
      event: paymentEvent,
      amountCents,
      status: "VOID",
      metadata: {
        stripeChargeId: charge.id,
        stripeEventId: event.id
      }
    };

    await emitPaymentSyncJob(`stripe.${paymentEvent}`, payload);
  }

  private async handleDisputeEvent(
    event: Stripe.Event,
    emitPaymentSyncJob: (name: string, payload: Record<string, unknown>) => Promise<void>
  ): Promise<void> {
    const dispute = event.data.object as Stripe.Dispute;
    const chargeId =
      typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null;

    if (!chargeId) {
      logger.warn(
        { disputeId: dispute.id },
        "Stripe payment provider: dispute has no associated charge"
      );
      return;
    }

    const charge = await this.stripe.charges.retrieve(chargeId);
    const metadata = charge.metadata ?? {};
    const organizationId =
      metadata[METADATA_ORGANIZATION_ID] ??
      (typeof charge.customer === "string" ? await this.resolveOrganizationFromCustomer(charge.customer) : null);
    const billingInvoiceId = metadata[METADATA_INVOICE_ID];

    if (!organizationId || !billingInvoiceId) {
      logger.warn(
        { disputeId: dispute.id, chargeId, metadata },
        "Stripe payment provider: dispute charge missing mapping metadata"
      );
      return;
    }

    const payload = {
      organizationId,
      invoiceId: billingInvoiceId,
      event: "payment_disputed",
      amountCents: charge.amount_captured ?? charge.amount,
      status: "UNCOLLECTIBLE",
      metadata: {
        stripeChargeId: charge.id,
        stripeDisputeId: dispute.id,
        stripeEventId: event.id
      }
    };

    await emitPaymentSyncJob("stripe.payment_disputed", payload);
  }

  private async resolveOrganizationFromCustomer(customerId: string): Promise<string | null> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      if (this.isDeletedCustomer(customer)) {
        return null;
      }
      return customer.metadata?.[METADATA_ORGANIZATION_ID] ?? null;
    } catch (error) {
      logger.warn(
        { customerId, error },
        "Stripe payment provider: failed to resolve organization from customer"
      );
      return null;
    }
  }
}

export const createPaymentProvider = (): PaymentProvider => {
  const provider = env.IDENTITY_PAYMENT_PROVIDER?.toLowerCase();

  if (provider === "stripe") {
    const apiKey = env.IDENTITY_PAYMENT_PROVIDER_API_KEY;
    if (!apiKey) {
      logger.warn("Stripe payment provider selected but API key is missing. Falling back to noop.");
      return new NoopPaymentProvider();
    }

    return new StripePaymentProvider({
      apiKey,
      webhookSecret: env.IDENTITY_PAYMENT_PROVIDER_WEBHOOK_SECRET ?? null
    });
  }

  return new NoopPaymentProvider();
};
