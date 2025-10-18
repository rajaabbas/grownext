import { Buffer } from "node:buffer";
import { decodeJwt, JWTPayload } from "jose";

export interface SupabaseJwtClaims extends JWTPayload {
  sub: string;
  email?: string;
  role?: string;
  organization_id?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export const extractBearerToken = (authorizationHeader?: string | null): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const parts = authorizationHeader.split(" ");

  if (parts.length !== 2) {
    return null;
  }

  const [scheme, token] = parts;

  if (!/^Bearer$/i.test(scheme)) {
    return null;
  }

  return token;
};

export const decodeSupabaseJwt = (token: string): SupabaseJwtClaims | null => {
  try {
    const decoded = decodeJwt(token) as SupabaseJwtClaims;
    return decoded;
  } catch (error) {
    console.warn("Failed to decode Supabase JWT via jose", { error });
    const parts = token.split(".");

    if (parts.length !== 3) {
      console.warn("Invalid JWT format", { tokenLength: token.length });
      return null;
    }

    try {
      const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
      const payload = JSON.parse(payloadJson) as SupabaseJwtClaims;
      console.warn("Decoded Supabase JWT via manual fallback", {
        hasSub: typeof payload.sub === "string",
        hasEmail: typeof payload.email === "string"
      });
      return payload;
    } catch (fallbackError) {
      console.error("Manual JWT decode fallback failed", { error: fallbackError });
      return null;
    }
  }
};

export const getSupabaseClaims = (authorizationHeader?: string | null): SupabaseJwtClaims | null => {
  const token = extractBearerToken(authorizationHeader);

  if (!token) {
    return null;
  }

  return decodeSupabaseJwt(token);
};

export const formatClaimsForPg = (
  claims: SupabaseJwtClaims | null,
  fallbackOrganizationId?: string
): string => {
  const organizationId =
    claims?.organization_id ??
    (claims?.app_metadata?.organization_id as string | undefined) ??
    (claims?.user_metadata?.organization_id as string | undefined) ??
    fallbackOrganizationId;

  const baseClaims: SupabaseJwtClaims = {
    role: "authenticated",
    sub: "service-role",
    ...(organizationId ? { organization_id: organizationId } : {}),
    ...claims
  };

  return JSON.stringify(baseClaims);
};

export const buildServiceRoleClaims = (
  organizationId?: string,
  overrides?: Partial<SupabaseJwtClaims>
): SupabaseJwtClaims => ({
  sub: "service-role",
  role: overrides?.role ?? "authenticated",
  ...(organizationId ? { organization_id: organizationId } : {}),
  ...overrides
});
