import type { Tenant, TenantApplication, TenantMember } from "@prisma/client";
import { withAuthorizationTransaction } from "./prisma";
import type { SupabaseJwtClaims } from "@ma/core";

export interface TenantSummary {
  id: string;
  organizationId: string;
  name: string;
  slug: string | null;
  description: string | null;
  membersCount: number;
  productsCount: number;
}

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

export const listTenantSummariesForOrganization = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<TenantSummary[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.tenant
      .findMany({
        where: { organizationId },
        select: {
          id: true,
          organizationId: true,
          name: true,
          slug: true,
          description: true,
          _count: {
            select: {
              members: true,
              entitlements: true
            }
          }
        },
        orderBy: { createdAt: "asc" }
      })
      .then((tenants) =>
        tenants.map((tenant) => ({
          id: tenant.id,
          organizationId: tenant.organizationId,
          name: tenant.name,
          slug: tenant.slug,
          description: tenant.description,
          membersCount: tenant._count.members,
          productsCount: tenant._count.entitlements
        }))
      )
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
