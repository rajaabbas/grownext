-- Identity platform RLS policies
-- Apply via `supabase db push` or `pnpm db:push`

-- Tenants
ALTER TABLE core.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_read_member ON core.tenants;
DROP POLICY IF EXISTS tenants_manage_service ON core.tenants;
CREATE POLICY tenants_read_member ON core.tenants
  FOR SELECT
  USING ((auth.jwt()->>'organization_id')::text = organization_id);
CREATE POLICY tenants_manage_service ON core.tenants
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Tenant members
ALTER TABLE core.tenant_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_members_read_service ON core.tenant_members;
DROP POLICY IF EXISTS tenant_members_manage_service ON core.tenant_members;
CREATE POLICY tenant_members_read_service ON core.tenant_members
  FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY tenant_members_manage_service ON core.tenant_members
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Products
ALTER TABLE core.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_read_public ON core.products;
DROP POLICY IF EXISTS products_manage_service ON core.products;
CREATE POLICY products_read_public ON core.products
  FOR SELECT
  USING (TRUE);
CREATE POLICY products_manage_service ON core.products
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Product entitlements
ALTER TABLE core.product_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_entitlements_read_self ON core.product_entitlements;
DROP POLICY IF EXISTS product_entitlements_manage_service ON core.product_entitlements;
CREATE POLICY product_entitlements_read_self ON core.product_entitlements
  FOR SELECT
  USING ((auth.uid() = user_id));
CREATE POLICY product_entitlements_manage_service ON core.product_entitlements
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Refresh tokens restricted to service role only
ALTER TABLE core.refresh_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refresh_tokens_service_only ON core.refresh_tokens;
CREATE POLICY refresh_tokens_service_only ON core.refresh_tokens
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Audit events readable by service role and organization owners
ALTER TABLE core.audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_events_read_owner ON core.audit_events;
DROP POLICY IF EXISTS audit_events_manage_service ON core.audit_events;
CREATE POLICY audit_events_read_owner ON core.audit_events
  FOR SELECT
  USING (((auth.jwt()->>'organization_id')::text = organization_id) OR auth.role() = 'service_role');
CREATE POLICY audit_events_manage_service ON core.audit_events
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
