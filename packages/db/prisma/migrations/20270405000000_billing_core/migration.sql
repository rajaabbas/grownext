-- Create billing enums
CREATE TYPE "core"."BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "core"."BillingLimitType" AS ENUM ('HARD', 'SOFT', 'UNLIMITED');
CREATE TYPE "core"."BillingUsagePeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL', 'LIFETIME');
CREATE TYPE "core"."BillingSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED');
CREATE TYPE "core"."BillingSubscriptionScheduleStatus" AS ENUM ('PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELED');
CREATE TYPE "core"."BillingUsageSource" AS ENUM ('PORTAL', 'TASKS', 'ADMIN', 'WORKER', 'API');
CREATE TYPE "core"."BillingUsageResolution" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE "core"."BillingInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');
CREATE TYPE "core"."BillingInvoiceLineType" AS ENUM ('RECURRING', 'USAGE', 'ONE_TIME', 'CREDIT', 'TAX', 'ADJUSTMENT');
CREATE TYPE "core"."BillingPaymentMethodType" AS ENUM ('CARD', 'BANK_ACCOUNT', 'EXTERNAL');
CREATE TYPE "core"."BillingPaymentMethodStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "core"."BillingCreditReason" AS ENUM ('ADJUSTMENT', 'REFUND', 'PROMOTION', 'SERVICE_FAILURE', 'OTHER');
CREATE TYPE "core"."BillingContactRole" AS ENUM ('primary', 'finance', 'technical', 'legal');

-- Billing packages and feature limits
CREATE TABLE "core"."billing_packages" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "interval" "core"."BillingInterval" NOT NULL DEFAULT 'MONTHLY',
  "amount_cents" INTEGER NOT NULL,
  "trial_period_days" INTEGER,
  "metadata" JSONB,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_packages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_packages_slug_key" UNIQUE ("slug")
);

CREATE TABLE "core"."billing_feature_limits" (
  "id" TEXT NOT NULL,
  "package_id" TEXT NOT NULL,
  "feature_key" TEXT NOT NULL,
  "limit_type" "core"."BillingLimitType" NOT NULL,
  "limit_value" INTEGER,
  "limit_unit" TEXT,
  "usage_period" "core"."BillingUsagePeriod",
  "metadata" JSONB,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_feature_limits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_feature_limits_package_id_feature_key_key" UNIQUE ("package_id", "feature_key"),
  CONSTRAINT "billing_feature_limits_package_id_fkey"
    FOREIGN KEY ("package_id") REFERENCES "core"."billing_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "billing_feature_limits_package_id_idx"
  ON "core"."billing_feature_limits"("package_id");

-- Billing subscriptions and schedules
CREATE TABLE "core"."billing_subscriptions" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "package_id" TEXT NOT NULL,
  "status" "core"."BillingSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "amount_cents" INTEGER NOT NULL,
  "billing_interval" "core"."BillingInterval" NOT NULL,
  "current_period_start" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  "current_period_end" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  "trial_ends_at" TIMESTAMP WITHOUT TIME ZONE,
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "canceled_at" TIMESTAMP WITHOUT TIME ZONE,
  "external_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_subscriptions_external_id_key" UNIQUE ("external_id"),
  CONSTRAINT "billing_subscriptions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "billing_subscriptions_package_id_fkey"
    FOREIGN KEY ("package_id") REFERENCES "core"."billing_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "billing_subscriptions_organization_id_idx"
  ON "core"."billing_subscriptions"("organization_id");
CREATE INDEX "billing_subscriptions_package_id_idx"
  ON "core"."billing_subscriptions"("package_id");

CREATE TABLE "core"."billing_subscription_schedules" (
  "id" TEXT NOT NULL,
  "subscription_id" TEXT NOT NULL,
  "target_package_id" TEXT NOT NULL,
  "status" "core"."BillingSubscriptionScheduleStatus" NOT NULL DEFAULT 'PENDING',
  "effective_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_subscription_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_subscription_schedules_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "core"."billing_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "billing_subscription_schedules_target_package_id_fkey"
    FOREIGN KEY ("target_package_id") REFERENCES "core"."billing_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "billing_subscription_schedules_subscription_id_idx"
  ON "core"."billing_subscription_schedules"("subscription_id");
CREATE INDEX "billing_subscription_schedules_target_package_id_idx"
  ON "core"."billing_subscription_schedules"("target_package_id");

-- Usage events and aggregates
CREATE TABLE "core"."billing_usage_events" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "tenant_id" TEXT,
  "subscription_id" TEXT,
  "product_id" TEXT,
  "feature_key" TEXT NOT NULL,
  "quantity" DECIMAL(20, 6) NOT NULL,
  "unit" TEXT NOT NULL,
  "recorded_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  "source" "core"."BillingUsageSource" NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_usage_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_usage_events_fingerprint_key" UNIQUE ("fingerprint"),
  CONSTRAINT "billing_usage_events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "billing_usage_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "billing_usage_events_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "core"."billing_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "billing_usage_events_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "core"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "billing_usage_events_org_feature_recorded_idx"
  ON "core"."billing_usage_events"("organization_id", "feature_key", "recorded_at");
CREATE INDEX "billing_usage_events_subscription_id_idx"
  ON "core"."billing_usage_events"("subscription_id");
CREATE INDEX "billing_usage_events_tenant_id_idx"
  ON "core"."billing_usage_events"("tenant_id");

CREATE TABLE "core"."billing_usage_aggregates" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "subscription_id" TEXT,
  "feature_key" TEXT NOT NULL,
  "period_start" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  "period_end" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  "resolution" "core"."BillingUsageResolution" NOT NULL,
  "quantity" DECIMAL(20, 6) NOT NULL,
  "unit" TEXT NOT NULL,
  "source" "core"."BillingUsageSource" NOT NULL,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_usage_aggregates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_usage_aggregates_organization_id_subscription_id_feature_key_resolution_period_start_period_end_key"
    UNIQUE ("organization_id", "subscription_id", "feature_key", "resolution", "period_start", "period_end"),
  CONSTRAINT "billing_usage_aggregates_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "billing_usage_aggregates_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "core"."billing_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "billing_usage_aggregates_org_feature_resolution_idx"
  ON "core"."billing_usage_aggregates"("organization_id", "feature_key", "resolution", "period_start");
CREATE INDEX "billing_usage_aggregates_subscription_id_idx"
  ON "core"."billing_usage_aggregates"("subscription_id");

-- Billing contacts and tax IDs
CREATE TABLE "core"."billing_contacts" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "core"."BillingContactRole" NOT NULL,
  "phone" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_contacts_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "billing_contacts_organization_id_idx"
  ON "core"."billing_contacts"("organization_id");

CREATE TABLE "core"."billing_tax_ids" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "country" TEXT,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_tax_ids_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_tax_ids_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "billing_tax_ids_organization_id_idx"
  ON "core"."billing_tax_ids"("organization_id");

-- Billing invoices and lines
CREATE TABLE "core"."billing_invoices" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "subscription_id" TEXT,
  "number" TEXT NOT NULL,
  "status" "core"."BillingInvoiceStatus" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "subtotal_cents" INTEGER NOT NULL,
  "tax_cents" INTEGER NOT NULL,
  "total_cents" INTEGER NOT NULL,
  "balance_cents" INTEGER NOT NULL,
  "due_at" TIMESTAMP WITHOUT TIME ZONE,
  "issued_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  "paid_at" TIMESTAMP WITHOUT TIME ZONE,
  "voided_at" TIMESTAMP WITHOUT TIME ZONE,
  "external_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_invoices_number_key" UNIQUE ("number"),
  CONSTRAINT "billing_invoices_external_id_key" UNIQUE ("external_id"),
  CONSTRAINT "billing_invoices_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "billing_invoices_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "core"."billing_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "billing_invoices_organization_id_idx"
  ON "core"."billing_invoices"("organization_id");
CREATE INDEX "billing_invoices_subscription_id_idx"
  ON "core"."billing_invoices"("subscription_id");

CREATE TABLE "core"."billing_invoice_lines" (
  "id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "line_type" "core"."BillingInvoiceLineType" NOT NULL,
  "description" TEXT,
  "feature_key" TEXT,
  "quantity" DECIMAL(20, 6) NOT NULL,
  "unit_amount_cents" INTEGER NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "usage_period_start" TIMESTAMP WITHOUT TIME ZONE,
  "usage_period_end" TIMESTAMP WITHOUT TIME ZONE,
  "metadata" JSONB,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_invoice_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_invoice_lines_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "core"."billing_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "billing_invoice_lines_invoice_id_idx"
  ON "core"."billing_invoice_lines"("invoice_id");

-- Billing payment methods
CREATE TABLE "core"."billing_payment_methods" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "type" "core"."BillingPaymentMethodType" NOT NULL,
  "status" "core"."BillingPaymentMethodStatus" NOT NULL DEFAULT 'ACTIVE',
  "provider_id" TEXT NOT NULL,
  "reference" TEXT,
  "brand" TEXT,
  "last4" TEXT,
  "exp_month" INTEGER,
  "exp_year" INTEGER,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_payment_methods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_payment_methods_organization_id_provider_id_key" UNIQUE ("organization_id", "provider_id"),
  CONSTRAINT "billing_payment_methods_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "billing_payment_methods_organization_id_idx"
  ON "core"."billing_payment_methods"("organization_id");

-- Billing credit memos
CREATE TABLE "core"."billing_credit_memos" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "invoice_id" TEXT,
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "reason" "core"."BillingCreditReason" NOT NULL,
  "expires_at" TIMESTAMP WITHOUT TIME ZONE,
  "metadata" JSONB,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_credit_memos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_credit_memos_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "billing_credit_memos_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "core"."billing_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "billing_credit_memos_organization_id_idx"
  ON "core"."billing_credit_memos"("organization_id");
CREATE INDEX "billing_credit_memos_invoice_id_idx"
  ON "core"."billing_credit_memos"("invoice_id");
