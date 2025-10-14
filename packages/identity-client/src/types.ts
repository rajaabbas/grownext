export interface IdentityTokenPayload {
  sub: string;
  aud: string | string[];
  iss: string;
  email?: string;
  scope?: string;
  tenant_id: string;
  organization_id: string;
  product_id: string;
  roles: string[];
  session_id?: string;
  exp: number;
  iat: number;
  entitlements?: Array<{
    product_id: string;
    tenant_id: string;
    organization_id?: string;
    roles?: string[];
  }>;
  [claim: string]: unknown;
}

export interface Entitlement {
  productId: string;
  tenantId: string;
  organizationId?: string;
  roles: string[];
}

export interface TokenValidationResult {
  subject: string;
  payload: IdentityTokenPayload;
  entitlements: Entitlement[];
  issuedAt: Date;
  expiresAt: Date;
}

export interface TokenValidatorOptions {
  expectedAudience: string;
  expectedIssuer: string;
  jwksUrl: string;
  cacheTtlMs?: number;
  clockToleranceSeconds?: number;
}
