import type { SupabaseJwtClaims } from "@ma/core";

export class OrganizationScopeError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 403) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const resolveOrganizationIdFromClaims = (
  claims: SupabaseJwtClaims | Record<string, unknown> | null | undefined
): string | null => {
  if (!claims) {
    return null;
  }

  const direct = (claims as Record<string, unknown>).organization_id;
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  const appMetadata = (claims as Record<string, unknown>).app_metadata;
  if (
    appMetadata &&
    typeof appMetadata === "object" &&
    appMetadata !== null &&
    typeof (appMetadata as Record<string, unknown>).organization_id === "string" &&
    ((appMetadata as Record<string, unknown>).organization_id as string).length > 0
  ) {
    return (appMetadata as Record<string, unknown>).organization_id as string;
  }

  const userMetadata = (claims as Record<string, unknown>).user_metadata;
  if (
    userMetadata &&
    typeof userMetadata === "object" &&
    userMetadata !== null &&
    typeof (userMetadata as Record<string, unknown>).organization_id === "string" &&
    ((userMetadata as Record<string, unknown>).organization_id as string).length > 0
  ) {
    return (userMetadata as Record<string, unknown>).organization_id as string;
  }

  return null;
};

export const ensureOrganizationScope = (
  claims: SupabaseJwtClaims | Record<string, unknown> | null | undefined,
  targetOrganizationId: string
): void => {
  const activeOrganizationId = resolveOrganizationIdFromClaims(claims);
  if (activeOrganizationId && activeOrganizationId !== targetOrganizationId) {
    throw new OrganizationScopeError("organization_scope_mismatch");
  }
};
