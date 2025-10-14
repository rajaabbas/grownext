import type { Tenant, TenantApplication, TenantMember } from "@prisma/client";
import { withAuthorizationTransaction } from "./prisma";
import type { SupabaseJwtClaims } from "@ma/core";

export const getTenantById = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string
): Promise<Tenant | null> => {
  return withAuthorizationTransaction(claims, (tx) => tx.tenant.findUnique({ where: { id: tenantId } }));
};

export const listTenantMembers = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string
): Promise<Array<TenantMember & { organizationMember: { userId: string } }>> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.tenantMember.findMany({
      where: { tenantId },
      include: {
        organizationMember: {
          select: {
            userId: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    })
  );
};

export const listTenantApplications = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string
): Promise<Array<TenantApplication & { product: { id: string; name: string; slug: string } }>> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.tenantApplication.findMany({
      where: { tenantId },
      include: {
        product: true
      },
      orderBy: { createdAt: "asc" }
    })
  );
};
