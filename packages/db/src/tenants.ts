import type { Product, Tenant, TenantApplication, TenantMember } from "@prisma/client";
import { Prisma, withAuthorizationTransaction } from "./prisma";
import { buildServiceRoleClaims, type SupabaseJwtClaims } from "@ma/core";

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

export const getTenantBySlug = async (
  claims: SupabaseJwtClaims | null,
  slug: string
): Promise<Tenant | null> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.tenant.findUnique({
      where: { slug }
    })
  );
};

export const listTenantMembers = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string
): Promise<
  Array<
    TenantMember & {
      organizationMember: {
        id: string;
        userId: string;
        role: string;
        user: {
          email: string;
          fullName: string;
        };
      };
    }
  >
> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.tenantMember.findMany({
      where: { tenantId },
      include: {
        organizationMember: {
          select: {
            id: true,
            userId: true,
            role: true,
            user: {
              select: {
                email: true,
                fullName: true
              }
            }
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
  return withAuthorizationTransaction(claims, async (tx) => {
    const [tenants, productEntitlements] = await Promise.all([
      tx.tenant.findMany({
        where: { organizationId },
        select: {
          id: true,
          organizationId: true,
          name: true,
          slug: true,
          description: true,
          _count: {
            select: {
              members: true
            }
          }
        },
        orderBy: { createdAt: "asc" }
      }),
      tx.productEntitlement.findMany({
        where: { organizationId },
        select: {
          tenantId: true,
          productId: true
        },
        distinct: ["tenantId", "productId"]
      })
    ]);

    const productsByTenant = new Map<string, number>();
    for (const entitlement of productEntitlements) {
      productsByTenant.set(
        entitlement.tenantId,
        (productsByTenant.get(entitlement.tenantId) ?? 0) + 1
      );
    }

    return tenants.map((tenant) => ({
      id: tenant.id,
      organizationId: tenant.organizationId,
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description,
      membersCount: tenant._count.members,
      productsCount: productsByTenant.get(tenant.id) ?? 0
    }));
  });
};

export const countDistinctTenantMembersForOrganization = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<number> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const members = await tx.tenantMember.findMany({
      where: {
        tenant: { organizationId }
      },
      select: {
        organizationMemberId: true
      },
      distinct: [Prisma.TenantMemberScalarFieldEnum.organizationMemberId]
    });

    return members.length;
  });
};

export const listTenantMembershipsForUser = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string,
  userId: string
): Promise<Array<{ tenantId: string; role: string }>> => {
  return withAuthorizationTransaction(claims ?? buildServiceRoleClaims(organizationId), (tx) =>
    tx.tenantMember.findMany({
      where: {
        tenant: { organizationId },
        organizationMember: { userId }
      },
      select: {
        tenantId: true,
        role: true
      }
    })
  );
};

export const listTenantApplications = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string
): Promise<Array<TenantApplication & { product: Product }>> => {
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

export const removeTenantMember = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string,
  organizationMemberId: string
): Promise<void> => {
  await withAuthorizationTransaction(claims, (tx) =>
    tx.tenantMember.delete({
      where: {
        tenantId_organizationMemberId: {
          tenantId,
          organizationMemberId
        }
      }
    })
  );
};

export const deleteTenant = async (claims: SupabaseJwtClaims | null, tenantId: string): Promise<void> => {
  await withAuthorizationTransaction(claims, (tx) =>
    tx.tenant.delete({
      where: { id: tenantId }
    })
  );
};
