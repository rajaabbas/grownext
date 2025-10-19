import type { SupabaseJwtClaims } from "@ma/core";
import type { AuditEvent } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { withAuthorizationTransaction } from "./prisma";

type OrganizationMemberWithRelations = Prisma.OrganizationMemberGetPayload<{
  include: {
    organization: true;
    tenantMemberships: {
      include: {
        tenant: true;
      };
    };
  };
}>;

type TenantMembershipWithTenant = Prisma.TenantMemberGetPayload<{
  include: { tenant: true };
}>;

type ProductEntitlementWithRelations = Prisma.ProductEntitlementGetPayload<{
  include: {
    product: true;
    tenant: true;
  };
}>;

type SamlAccountWithConnection = Prisma.SamlAccountGetPayload<{
  include: {
    connection: true;
  };
}>;

type UserProfileSummaryRecord = Prisma.UserProfileGetPayload<{
  include: {
    memberships: {
      include: {
        organization: true;
        tenantMemberships: {
          include: {
            tenant: true;
          };
        };
      };
    };
    entitlements: {
      include: {
        product: true;
        tenant: true;
      };
    };
    auditEvents: true;
  };
}>;

type UserProfileDetailRecord = Prisma.UserProfileGetPayload<{
  include: {
    memberships: {
      include: {
        organization: true;
        tenantMemberships: {
          include: {
            tenant: true;
          };
        };
      };
    };
    entitlements: {
      include: {
        product: true;
        tenant: {
          include: {
            organization: true;
          };
        };
      };
    };
    auditEvents: true;
    samlAccounts: {
      include: {
        connection: true;
      };
    };
  };
}>;

export interface SuperAdminUserListFilters {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface SuperAdminOrganizationSummary {
  id: string;
  name: string;
  slug: string | null;
  role: OrganizationMemberWithRelations["role"];
}

export interface SuperAdminUserSummary {
  id: string;
  email: string;
  fullName: string | null;
  status: "ACTIVE" | "INVITED" | "SUSPENDED" | "DEACTIVATED";
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  organizations: SuperAdminOrganizationSummary[];
  tenantCount: number;
  productSlugs: string[];
  productCount: number;
}

export interface SuperAdminUsersListResult {
  users: SuperAdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface SuperAdminTenantMembership {
  id: string;
  name: string;
  slug: string | null;
  role: string;
}

export interface SuperAdminOrganizationDetail extends SuperAdminOrganizationSummary {
  tenants: SuperAdminTenantMembership[];
}

export interface SuperAdminEntitlementSummary {
  id: string;
  organizationId: string;
  tenantId: string;
  tenantName: string | null;
  productId: string;
  productSlug: string;
  productName: string;
  roles: ProductEntitlementWithRelations["roles"];
  expiresAt: string | null;
  createdAt: string;
}

export interface SuperAdminAuditEventSummary {
  id: string;
  eventType: AuditEvent["eventType"];
  description: string | null;
  organizationId: string | null;
  tenantId: string | null;
  productId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface SuperAdminSamlAccountSummary {
  id: string;
  samlConnectionId: string;
  samlConnectionLabel: string;
  nameId: string;
  email: string;
  createdAt: string;
}

export interface SuperAdminUserDetail {
  id: string;
  email: string;
  fullName: string | null;
  status: "ACTIVE" | "INVITED" | "SUSPENDED" | "DEACTIVATED";
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  organizations: SuperAdminOrganizationDetail[];
  entitlements: SuperAdminEntitlementSummary[];
  auditEvents: SuperAdminAuditEventSummary[];
  samlAccounts: SuperAdminSamlAccountSummary[];
}

const mapOrganizationSummary = (
  membership: OrganizationMemberWithRelations
): SuperAdminOrganizationSummary => ({
  id: membership.organizationId,
  name: membership.organization.name,
  slug: membership.organization.slug,
  role: membership.role
});

const mapTenantMembership = (tenantMembership: TenantMembershipWithTenant): SuperAdminTenantMembership => ({
  id: tenantMembership.tenant.id,
  name: tenantMembership.tenant.name,
  slug: tenantMembership.tenant.slug,
  role: tenantMembership.role
});

const mapEntitlement = (entitlement: ProductEntitlementWithRelations): SuperAdminEntitlementSummary => ({
  id: entitlement.id,
  organizationId: entitlement.organizationId,
  tenantId: entitlement.tenantId,
  tenantName: entitlement.tenant.name,
  productId: entitlement.productId,
  productSlug: entitlement.product.slug,
  productName: entitlement.product.name,
  roles: entitlement.roles,
  expiresAt: entitlement.expiresAt ? entitlement.expiresAt.toISOString() : null,
  createdAt: entitlement.createdAt.toISOString()
});

const mapAuditEvent = (event: AuditEvent): SuperAdminAuditEventSummary => ({
  id: event.id,
  eventType: event.eventType,
  description: event.description ?? null,
  organizationId: event.organizationId,
  tenantId: event.tenantId,
  productId: event.productId,
  metadata: (event.metadata as Record<string, unknown> | null) ?? null,
  createdAt: event.createdAt.toISOString()
});

const mapSamlAccount = (account: SamlAccount): SuperAdminSamlAccountSummary => ({
  id: account.id,
  samlConnectionId: account.connection.id,
  samlConnectionLabel: account.connection.label,
  nameId: account.nameId,
  email: account.email,
  createdAt: account.createdAt.toISOString()
});

const computeTenantCount = (
  memberships: OrganizationMemberWithRelations[],
  entitlements: ProductEntitlementWithRelations[]
) => {
  const tenantIds = new Set<string>();

  for (const membership of memberships) {
    for (const tenantMembership of membership.tenantMemberships) {
      tenantIds.add(tenantMembership.tenantId);
    }
  }

  for (const entitlement of entitlements) {
    tenantIds.add(entitlement.tenantId);
  }

  return tenantIds.size;
};

const computeProducts = (entitlements: ProductEntitlementWithRelations[]) => {
  const slugs = new Set<string>();
  for (const entitlement of entitlements) {
    slugs.add(entitlement.product.slug);
  }
  return {
    productSlugs: Array.from(slugs.values()).sort(),
    productCount: slugs.size
  };
};

const computeLastActivity = (events: AuditEvent[]) => {
  if (events.length === 0) {
    return null;
  }

  const [latest] = events;
  return latest.createdAt.toISOString();
};

export const listUsersForSuperAdmin = async (
  claims: SupabaseJwtClaims | null,
  filters: SuperAdminUserListFilters
): Promise<SuperAdminUsersListResult> => {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);
  const skip = (page - 1) * pageSize;

  return withAuthorizationTransaction(claims, async (tx) => {
    const where: Prisma.UserProfileWhereInput = filters.search
      ? {
          OR: [
            {
              email: {
                contains: filters.search,
                mode: "insensitive"
              }
            },
            {
              fullName: {
                contains: filters.search,
                mode: "insensitive"
              }
            }
          ]
        }
      : {};

    const [total, recordsRaw] = await Promise.all([
      tx.userProfile.count({ where }),
      tx.userProfile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          memberships: {
            include: {
              organization: true,
              tenantMemberships: {
                include: {
                  tenant: true
                }
              }
            }
          },
          entitlements: {
            include: {
              product: true,
              tenant: true
            }
          },
          auditEvents: {
            orderBy: { createdAt: "desc" },
            take: 1
          }
        }
      })
    ]);

    const records = recordsRaw as UserProfileSummaryRecord[];

    const users = records.map((record) => {
      const organizations = record.memberships.map(mapOrganizationSummary);
      const tenantCount = computeTenantCount(record.memberships, record.entitlements);
      const { productSlugs, productCount } = computeProducts(record.entitlements);
      const lastActivityAt = computeLastActivity(record.auditEvents);

      return {
        id: record.userId,
        email: record.email,
        fullName: record.fullName ?? null,
        status: "ACTIVE" as const,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        lastActivityAt,
        organizations,
        tenantCount,
        productSlugs,
        productCount
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      users,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    };
  });
};

export const getUserForSuperAdmin = async (
  claims: SupabaseJwtClaims | null,
  userId: string
): Promise<SuperAdminUserDetail | null> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const record = (await tx.userProfile.findUnique({
      where: { userId },
      include: {
        memberships: {
          include: {
            organization: true,
            tenantMemberships: {
              include: {
                tenant: true
              }
            }
          }
        },
        entitlements: {
          include: {
            product: true,
            tenant: {
              include: {
                organization: true
              }
            }
          }
        },
        auditEvents: {
          orderBy: { createdAt: "desc" },
          take: 50
        },
        samlAccounts: {
          include: {
            connection: true
          }
        }
      }
    })) as UserProfileDetailRecord | null;

    if (!record) {
      return null;
    }

    const organizations: SuperAdminOrganizationDetail[] = record.memberships.map(
      (membership) => ({
        ...mapOrganizationSummary(membership),
        tenants: membership.tenantMemberships.map(mapTenantMembership)
      })
    );

    const entitlements = record.entitlements.map(mapEntitlement);
    const auditEvents = record.auditEvents.map(mapAuditEvent);
    const samlAccounts = record.samlAccounts.map(mapSamlAccount);

    const lastActivityAt = computeLastActivity(record.auditEvents);

    return {
      id: record.userId,
      email: record.email,
      fullName: record.fullName ?? null,
      status: "ACTIVE",
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      lastActivityAt,
      organizations,
      entitlements,
      auditEvents,
      samlAccounts
    };
  });
};
