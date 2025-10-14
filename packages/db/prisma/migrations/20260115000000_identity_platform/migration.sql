-- Enums for tenant membership, product entitlements, and audit domains
CREATE TYPE "core"."TenantRole" AS ENUM ('ADMIN', 'MEMBER', 'VIEWER');
CREATE TYPE "core"."TenantApplicationEnvironment" AS ENUM ('PRODUCTION', 'STAGING', 'DEVELOPMENT');
CREATE TYPE "core"."ProductRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'ANALYST', 'CONTRIBUTOR');
CREATE TYPE "core"."AuditEventType" AS ENUM (
  'SIGN_IN',
  'SIGN_OUT',
  'TOKEN_ISSUED',
  'TOKEN_REFRESHED',
  'TOKEN_REVOKED',
  'ENTITLEMENT_GRANTED',
  'ENTITLEMENT_REVOKED',
  'ADMIN_ACTION',
  'MFA_ENROLLED',
  'MFA_DISABLED',
  'ORGANIZATION_UPDATED',
  'TENANT_CREATED',
  'TENANT_UPDATED',
  'PRODUCT_REGISTERED'
);

-- Tenants represent isolated product workspaces under an organization
CREATE TABLE "core"."tenants" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "slug" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "core"."tenants"("slug");
CREATE INDEX "tenants_organization_id_idx" ON "core"."tenants"("organization_id");

ALTER TABLE "core"."tenants"
  ADD CONSTRAINT "tenants_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant membership ties organization members to tenant-level roles
CREATE TABLE "core"."tenant_members" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "organization_member_id" TEXT NOT NULL,
  "role" "core"."TenantRole" NOT NULL DEFAULT 'MEMBER',
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_members_tenant_id_organization_member_id_key"
  ON "core"."tenant_members"("tenant_id", "organization_member_id");
CREATE INDEX "tenant_members_organization_member_id_idx"
  ON "core"."tenant_members"("organization_member_id");

ALTER TABLE "core"."tenant_members"
  ADD CONSTRAINT "tenant_members_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core"."tenant_members"
  ADD CONSTRAINT "tenant_members_organization_member_id_fkey"
  FOREIGN KEY ("organization_member_id") REFERENCES "core"."organization_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Products are OIDC/OAuth2 clients that can be enabled per-tenant
CREATE TABLE "core"."products" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "client_id" TEXT NOT NULL,
  "client_secret_hash" TEXT NOT NULL,
  "redirect_uris" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "post_logout_redirect_uris" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "icon_url" TEXT,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_slug_key" ON "core"."products"("slug");
CREATE UNIQUE INDEX "products_client_id_key" ON "core"."products"("client_id");

-- Mapping between tenants and products with environment-specific settings
CREATE TABLE "core"."tenant_applications" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "environment" "core"."TenantApplicationEnvironment" NOT NULL DEFAULT 'PRODUCTION',
  "consent_required" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_applications_tenant_id_product_id_environment_key"
  ON "core"."tenant_applications"("tenant_id", "product_id", "environment");
CREATE INDEX "tenant_applications_product_id_idx" ON "core"."tenant_applications"("product_id");

ALTER TABLE "core"."tenant_applications"
  ADD CONSTRAINT "tenant_applications_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core"."tenant_applications"
  ADD CONSTRAINT "tenant_applications_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "core"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-user product entitlements scoped to a tenant
CREATE TABLE "core"."product_entitlements" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "roles" "core"."ProductRole"[] NOT NULL DEFAULT ARRAY[]::"core"."ProductRole"[],
  "expires_at" TIMESTAMP WITHOUT TIME ZONE,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_entitlements_user_id_product_id_tenant_id_key"
  ON "core"."product_entitlements"("user_id", "product_id", "tenant_id");
CREATE INDEX "product_entitlements_product_id_idx" ON "core"."product_entitlements"("product_id");
CREATE INDEX "product_entitlements_tenant_id_idx" ON "core"."product_entitlements"("tenant_id");
CREATE INDEX "product_entitlements_organization_id_idx" ON "core"."product_entitlements"("organization_id");

ALTER TABLE "core"."product_entitlements"
  ADD CONSTRAINT "product_entitlements_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core"."product_entitlements"
  ADD CONSTRAINT "product_entitlements_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core"."product_entitlements"
  ADD CONSTRAINT "product_entitlements_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "core"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core"."product_entitlements"
  ADD CONSTRAINT "product_entitlements_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "core"."user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Refresh tokens issued by the identity platform
CREATE TABLE "core"."refresh_tokens" (
  "id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "client_id" TEXT NOT NULL,
  "product_id" TEXT,
  "tenant_id" TEXT,
  "scope" TEXT,
  "session_id" UUID,
  "description" TEXT,
  "user_agent" TEXT,
  "ip_address" TEXT,
  "expires_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  "revoked_at" TIMESTAMP WITHOUT TIME ZONE,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "core"."refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx" ON "core"."refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_product_id_idx" ON "core"."refresh_tokens"("product_id");
CREATE INDEX "refresh_tokens_tenant_id_idx" ON "core"."refresh_tokens"("tenant_id");

ALTER TABLE "core"."refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "core"."user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core"."refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "core"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "core"."refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Audit log for identity and admin events
CREATE TABLE "core"."audit_events" (
  "id" TEXT NOT NULL,
  "event_type" "core"."AuditEventType" NOT NULL,
  "description" TEXT,
  "actor_user_id" UUID,
  "organization_id" TEXT,
  "tenant_id" TEXT,
  "product_id" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_events_event_type_idx" ON "core"."audit_events"("event_type");
CREATE INDEX "audit_events_organization_id_idx" ON "core"."audit_events"("organization_id");
CREATE INDEX "audit_events_tenant_id_idx" ON "core"."audit_events"("tenant_id");
CREATE INDEX "audit_events_product_id_idx" ON "core"."audit_events"("product_id");
CREATE INDEX "audit_events_actor_user_id_idx" ON "core"."audit_events"("actor_user_id");

ALTER TABLE "core"."audit_events"
  ADD CONSTRAINT "audit_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "core"."audit_events"
  ADD CONSTRAINT "audit_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "core"."audit_events"
  ADD CONSTRAINT "audit_events_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "core"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "core"."audit_events"
  ADD CONSTRAINT "audit_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "core"."user_profiles"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Extend invitations with tenant context and product scope
ALTER TABLE "core"."organization_invitations"
  ADD COLUMN "tenant_id" TEXT,
  ADD COLUMN "product_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "tenant_roles" "core"."TenantRole"[] NOT NULL DEFAULT ARRAY[]::"core"."TenantRole"[];

CREATE INDEX "organization_invitations_tenant_id_idx"
  ON "core"."organization_invitations"("tenant_id");

ALTER TABLE "core"."organization_invitations"
  ADD CONSTRAINT "organization_invitations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
