import type { SupabaseJwtClaims } from "@ma/core";
import { env } from "@ma/core";
import {
  Prisma,
  type AuditEvent,
  type AuditEventType,
  type UserLifecycleStatus,
  type SuperAdminBulkAction,
  type SuperAdminBulkJobStatus
} from "@prisma/client";
import { randomUUID, createHmac } from "crypto";
import { withAuthorizationTransaction } from "./prisma";
import { supabaseServiceClient } from "./supabase";

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

export interface SuperAdminAuditLogFilters {
  search?: string;
  actorEmail?: string;
  eventType?: string;
  start?: Date;
  end?: Date;
  page?: number;
  pageSize?: number;
}

export interface SuperAdminAuditLogResult {
  events: SuperAdminAuditEventSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface UpdateUserStatusForSuperAdminInput {
  userId: string;
  status: UserLifecycleStatus;
}

export interface CreateImpersonationSessionInput {
  userId: string;
  createdById: string;
  reason?: string | null;
  productSlug?: string | null;
  expiresAt: Date;
}

export interface SuperAdminImpersonationSession {
  tokenId: string;
  token: string;
  userId: string;
  createdById: string;
  expiresAt: string;
  createdAt: string;
  reason: string | null;
  productSlug: string | null;
}

export interface ActiveImpersonationSessionSummary {
  tokenId: string;
  userId: string;
  createdById: string;
  createdByEmail: string | null;
  createdByName: string | null;
  reason: string | null;
  productSlug: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface CreateBulkJobInput {
  action: SuperAdminBulkAction;
  userIds: string[];
  initiatedById: string;
  reason?: string | null;
}

export interface UpdateBulkJobInput {
  jobId: string;
  status?: SuperAdminBulkJobStatus;
  completedCount?: number;
  failedCount?: number;
  errorMessage?: string | null;
  progressMessage?: string | null;
  progressUpdatedAt?: Date | string | null;
  failureDetails?: SuperAdminBulkJobFailureDetail[] | null;
  resultUrl?: string | null;
  resultExpiresAt?: Date | string | null;
}

export interface SuperAdminBulkJobFailureDetail {
  userId: string;
  email?: string | null;
  reason: string | null;
}

export interface SuperAdminBulkJobSummary {
  id: string;
  action: SuperAdminBulkAction;
  status: SuperAdminBulkJobStatus;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
  initiatedBy: {
    id: string;
    email: string;
  };
  errorMessage: string | null;
  reason: string | null;
  progressMessage: string | null;
  progressUpdatedAt: string | null;
  failureDetails: SuperAdminBulkJobFailureDetail[];
  resultUrl: string | null;
  resultExpiresAt: string | null;
}

export interface SuperAdminBulkJobDetail extends SuperAdminBulkJobSummary {
  userIds: string[];
}

type BulkJobRecord = Prisma.SuperAdminBulkJobGetPayload<{
  include: {
    initiatedBy: {
      select: {
        userId: true;
        email: true;
      };
    };
  };
}>;

const mapFailureDetails = (
  value: Prisma.JsonValue | null | undefined
): SuperAdminBulkJobFailureDetail[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const details: SuperAdminBulkJobFailureDetail[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const candidate = entry as Record<string, unknown>;
    const userId = typeof candidate.userId === "string" ? candidate.userId : null;
    if (!userId) {
      continue;
    }

    const email =
      typeof candidate.email === "string"
        ? candidate.email
        : candidate.email === null
          ? null
          : null;
    const reason =
      typeof candidate.reason === "string" || candidate.reason === null
        ? (candidate.reason as string | null)
        : null;

    details.push({
      userId,
      email,
      reason
    });
  }

  return details;
};

const mapBulkJobRecord = (record: BulkJobRecord): SuperAdminBulkJobSummary => ({
  id: record.id,
  action: record.action,
  status: record.status,
  totalCount: record.totalCount,
  completedCount: record.completedCount,
  failedCount: record.failedCount,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
  initiatedBy: {
    id: record.initiatedBy.userId,
    email: record.initiatedBy.email
  },
  errorMessage: record.errorMessage ?? null,
  reason: record.reason ?? null,
  progressMessage: record.progressMessage ?? null,
  progressUpdatedAt: record.progressUpdatedAt
    ? record.progressUpdatedAt.toISOString()
    : null,
  failureDetails: mapFailureDetails(record.failureDetails as Prisma.JsonValue | null),
  resultUrl: record.resultUrl ?? null,
  resultExpiresAt: record.resultExpiresAt ? record.resultExpiresAt.toISOString() : null
});

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

type AuditEventWithActor = AuditEvent & {
  actor?: {
    email: string | null;
  } | null;
};

const mapAuditEvent = (event: AuditEventWithActor): SuperAdminAuditEventSummary => {
  const metadata = (event.metadata as Record<string, unknown> | null) ?? null;
  const actorEmail = event.actor?.email ?? null;

  const metadataWithActor = actorEmail
    ? {
        ...(metadata ?? {}),
        actorEmail: (metadata ?? {}).actorEmail ?? actorEmail
      }
    : metadata;

  return {
    id: event.id,
    eventType: event.eventType,
    description: event.description ?? null,
    organizationId: event.organizationId,
    tenantId: event.tenantId,
    productId: event.productId,
    metadata: metadataWithActor,
    createdAt: event.createdAt.toISOString()
  };
};

const mapSamlAccount = (account: SamlAccountWithConnection): SuperAdminSamlAccountSummary => ({
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
        status: record.status as UserLifecycleStatus,
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
  userId: string,
  verifiedEmail?: string
): Promise<SuperAdminUserDetail | null> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const whereClause = verifiedEmail
      ? {
          OR: [
            { userId },
            {
              email: verifiedEmail
            }
          ]
        }
      : { userId };

    const include: Prisma.UserProfileInclude = {
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
        take: 50,
        include: {
          actor: true
        }
      }
    };

    if (env.IDENTITY_SAML_ENABLED) {
      include.samlAccounts = {
        include: {
          connection: true
        }
      };
    }

    const record = (await tx.userProfile.findFirst({
      where: whereClause,
      include
    })) as UserProfileDetailRecord | null;

    if (!record) {
      if (!verifiedEmail) {
        return null;
      }

      try {
        const { data, error } = await supabaseServiceClient.auth.admin.listUsers({
          page: 1,
          perPage: 1,
          email: verifiedEmail
        } as Parameters<(typeof supabaseServiceClient.auth.admin)["listUsers"]>[0]);

        if (error || !data || !Array.isArray(data.users)) {
          return null;
        }

        const supabaseUser = data.users.find((candidate) => candidate.email?.toLowerCase() === verifiedEmail.toLowerCase());

        if (!supabaseUser) {
          return null;
        }

        const createdAtIso = supabaseUser.created_at ?? new Date().toISOString();
        const updatedAtIso = supabaseUser.updated_at ?? createdAtIso;
        const lastActivityIso = supabaseUser.last_sign_in_at ?? null;
        const fullName =
          (typeof supabaseUser.user_metadata?.full_name === "string" && supabaseUser.user_metadata.full_name.length > 0
            ? supabaseUser.user_metadata.full_name
            : null);
        const status: UserLifecycleStatus = supabaseUser.email_confirmed_at ? "ACTIVE" : "INVITED";

        return {
          id: supabaseUser.id,
          email: supabaseUser.email ?? verifiedEmail,
          fullName,
          status,
          createdAt: createdAtIso,
          updatedAt: updatedAtIso,
          lastActivityAt: lastActivityIso,
          organizations: [],
          entitlements: [],
          auditEvents: [],
          samlAccounts: []
        };
      } catch (error) {
        console.warn("Failed to hydrate user detail from Supabase", error);
        return null;
      }
    }

    const organizations: SuperAdminOrganizationDetail[] = record.memberships.map(
      (membership) => ({
        ...mapOrganizationSummary(membership),
        tenants: membership.tenantMemberships.map(mapTenantMembership)
      })
    );

    const entitlements = record.entitlements.map(mapEntitlement);
    const auditEvents = record.auditEvents.map(mapAuditEvent);
    const samlAccountRecords = Array.isArray((record as Partial<UserProfileDetailRecord>).samlAccounts)
      ? ((record as Partial<UserProfileDetailRecord>).samlAccounts as UserProfileDetailRecord["samlAccounts"])
      : [];
    const samlAccounts = samlAccountRecords.map(mapSamlAccount);

    const lastActivityAt = computeLastActivity(record.auditEvents);

    return {
      id: record.userId,
      email: record.email,
      fullName: record.fullName ?? null,
      status: record.status as UserLifecycleStatus,
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

const buildAuditWhereClause = (filters: SuperAdminAuditLogFilters): Prisma.AuditEventWhereInput => {
  const andConditions: Prisma.AuditEventWhereInput[] = [];

  if (filters.eventType) {
    const normalized = filters.eventType.toUpperCase() as AuditEventType;
    andConditions.push({ eventType: normalized });
  }

  if (filters.actorEmail) {
    andConditions.push({
      actor: {
        email: {
          equals: filters.actorEmail,
          mode: "insensitive"
        }
      }
    });
  }

  if (filters.start || filters.end) {
    andConditions.push({
      createdAt: {
        gte: filters.start ?? undefined,
        lte: filters.end ?? undefined
      }
    });
  }

  if (filters.search) {
    andConditions.push({
      OR: [
        {
          description: {
            contains: filters.search,
            mode: "insensitive"
          }
        },
        { organizationId: filters.search },
        { tenantId: filters.search },
        { productId: filters.search }
      ]
    });
  }

  if (andConditions.length === 0) {
    return {};
  }

  return {
    AND: andConditions
  };
};

const buildPagination = (page: number, pageSize: number, total: number) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
};

export const listAuditLogsForSuperAdmin = async (
  claims: SupabaseJwtClaims | null,
  filters: SuperAdminAuditLogFilters
): Promise<SuperAdminAuditLogResult> => {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);
  const skip = (page - 1) * pageSize;

  return withAuthorizationTransaction(claims, async (tx) => {
    const where = buildAuditWhereClause(filters);

    const [total, events] = await Promise.all([
      tx.auditEvent.count({ where }),
      tx.auditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          actor: true
        }
      })
    ]);

    const summaries = events.map((event) => mapAuditEvent(event as AuditEventWithActor));

    return {
      events: summaries,
      pagination: buildPagination(page, pageSize, total)
    };
  });
};

export const updateUserStatusForSuperAdmin = async (
  claims: SupabaseJwtClaims | null,
  input: UpdateUserStatusForSuperAdminInput
): Promise<UserLifecycleStatus> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const updated = await tx.userProfile.update({
      where: { userId: input.userId },
      data: {
        status: input.status
      },
      select: {
        status: true
      }
    });

    return updated.status;
  });
};

const DEFAULT_IMPERSONATION_MINUTES = 30;

export const createImpersonationSessionForSuperAdmin = async (
  claims: SupabaseJwtClaims | null,
  input: CreateImpersonationSessionInput
): Promise<SuperAdminImpersonationSession> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const rawToken = randomUUID();
    const impersonationSecret =
      env.SUPER_ADMIN_IMPERSONATION_SECRET ?? "super-admin-impersonation-secret";
    const token = createHmac("sha256", impersonationSecret)
      .update(`${rawToken}:${input.userId}:${input.createdById}:${Date.now()}`)
      .digest("hex");
    const expiresAt = input.expiresAt ?? new Date(Date.now() + DEFAULT_IMPERSONATION_MINUTES * 60 * 1000);

    await tx.superAdminImpersonationToken.updateMany({
      where: {
        createdById: input.createdById,
        userId: input.userId,
        expiresAt: {
          gt: new Date()
        }
      },
      data: {
        expiresAt: new Date()
      }
    });

    const record = await tx.superAdminImpersonationToken.create({
      data: {
        token,
        userId: input.userId,
        createdById: input.createdById,
        reason: input.reason ?? null,
        productSlug: input.productSlug ?? null,
        expiresAt
      }
    });

    return {
      tokenId: record.id,
      token: record.token,
      userId: record.userId,
      createdById: record.createdById,
      expiresAt: record.expiresAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      reason: record.reason ?? null,
      productSlug: record.productSlug ?? null
    };
  });
};

export const stopImpersonationSessionForSuperAdmin = async (
  claims: SupabaseJwtClaims | null,
  tokenId: string
): Promise<SuperAdminImpersonationSession | null> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    try {
      const record = await tx.superAdminImpersonationToken.delete({
        where: { id: tokenId }
      });

      return {
        tokenId: record.id,
        token: record.token,
        userId: record.userId,
        createdById: record.createdById,
        expiresAt: record.expiresAt.toISOString(),
        createdAt: record.createdAt.toISOString(),
        reason: record.reason ?? null,
        productSlug: record.productSlug ?? null
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return null;
      }
      throw error;
    }
  });
};

export interface ExpiredImpersonationSessionSummary {
  tokenId: string;
  userId: string;
  createdById: string;
  expiresAt: string;
  createdAt: string;
  reason: string | null;
  productSlug: string | null;
}

export const cleanupExpiredImpersonationSessionsForSuperAdmin = async (
  claims: SupabaseJwtClaims | null,
  limit = 200
): Promise<ExpiredImpersonationSessionSummary[]> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const now = new Date();
    const expired = await tx.superAdminImpersonationToken.findMany({
      where: {
        expiresAt: {
          lt: now
        }
      },
      take: limit,
      orderBy: {
        expiresAt: "asc"
      }
    });

    if (expired.length === 0) {
      return [];
    }

    await tx.superAdminImpersonationToken.deleteMany({
      where: {
        id: {
          in: expired.map((record) => record.id)
        }
      }
    });

    return expired.map((record) => ({
      tokenId: record.id,
      userId: record.userId,
      createdById: record.createdById,
      expiresAt: record.expiresAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      reason: record.reason ?? null,
      productSlug: record.productSlug ?? null
    }));
  });
};

export const findActiveImpersonationSessionForUser = async (
  claims: SupabaseJwtClaims | null,
  userId: string
): Promise<ActiveImpersonationSessionSummary | null> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const record = await tx.superAdminImpersonationToken.findFirst({
      where: {
        userId,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        createdBy: {
          select: {
            userId: true,
            email: true,
            fullName: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (!record) {
      return null;
    }

    return {
      tokenId: record.id,
      userId: record.userId,
      createdById: record.createdById,
      createdByEmail: record.createdBy?.email ?? null,
      createdByName: record.createdBy?.fullName ?? null,
      reason: record.reason ?? null,
      productSlug: record.productSlug ?? null,
      createdAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt.toISOString()
    };
  });
};

export const createBulkJobForSuperAdmin = async (
  claims: SupabaseJwtClaims | null,
  input: CreateBulkJobInput
): Promise<SuperAdminBulkJobSummary> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const totalCount = input.userIds.length;
    const initialStatus: SuperAdminBulkJobStatus = totalCount === 0 ? "SUCCEEDED" : "PENDING";

    const record = await tx.superAdminBulkJob.create({
      data: {
        action: input.action,
        status: initialStatus,
        userIds: input.userIds,
        reason: input.reason ?? null,
        totalCount,
        completedCount: initialStatus === "SUCCEEDED" ? totalCount : 0,
        failedCount: 0,
        errorMessage: null,
        progressMessage: null,
        progressUpdatedAt: null,
        failureDetails: [] as Prisma.JsonArray,
        resultUrl: null,
        resultExpiresAt: null,
        initiatedById: input.initiatedById
      },
      include: {
        initiatedBy: {
          select: {
            userId: true,
            email: true
          }
        }
      }
    });

    return mapBulkJobRecord(record);
  });
};

export const listBulkJobsForSuperAdmin = async (
  claims: SupabaseJwtClaims | null
): Promise<SuperAdminBulkJobSummary[]> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const records = await tx.superAdminBulkJob.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        initiatedBy: {
          select: {
            userId: true,
            email: true
          }
        }
      },
      take: 50
    });

    return records.map((record) => mapBulkJobRecord(record));
  });
};

export const getBulkJobByIdForSuperAdmin = async (
  claims: SupabaseJwtClaims | null,
  jobId: string
): Promise<SuperAdminBulkJobDetail | null> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const record = await tx.superAdminBulkJob.findUnique({
      where: { id: jobId },
      include: {
        initiatedBy: {
          select: {
            userId: true,
            email: true
          }
        }
      }
    });

    if (!record) {
      return null;
    }

    return {
      ...mapBulkJobRecord(record),
      userIds: record.userIds
    };
  });
};

export const updateBulkJobForSuperAdmin = async (
  claims: SupabaseJwtClaims | null,
  input: UpdateBulkJobInput
): Promise<SuperAdminBulkJobSummary | null> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const data: Prisma.SuperAdminBulkJobUpdateInput = {};

    if (input.status) {
      data.status = input.status;
    }
    if (typeof input.completedCount === "number") {
      data.completedCount = input.completedCount;
    }
    if (typeof input.failedCount === "number") {
      data.failedCount = input.failedCount;
    }
    if (input.errorMessage !== undefined) {
      data.errorMessage = input.errorMessage;
    }
    if (input.progressMessage !== undefined) {
      data.progressMessage = input.progressMessage;
    }
    if (input.progressUpdatedAt !== undefined) {
      if (input.progressUpdatedAt === null) {
        data.progressUpdatedAt = null;
      } else {
        data.progressUpdatedAt =
          input.progressUpdatedAt instanceof Date
            ? input.progressUpdatedAt
            : new Date(input.progressUpdatedAt);
      }
    } else if (input.progressMessage !== undefined) {
      data.progressUpdatedAt = new Date();
    }
    if (input.failureDetails !== undefined) {
      if (input.failureDetails === null) {
        data.failureDetails = Prisma.JsonNull;
      } else {
        data.failureDetails = input.failureDetails as unknown as Prisma.JsonArray;
      }
    }
    if (input.resultUrl !== undefined) {
      data.resultUrl = input.resultUrl;
    }
    if (input.resultExpiresAt !== undefined) {
      if (input.resultExpiresAt === null) {
        data.resultExpiresAt = null;
      } else {
        data.resultExpiresAt =
          input.resultExpiresAt instanceof Date
            ? input.resultExpiresAt
            : new Date(input.resultExpiresAt);
      }
    }

    if (Object.keys(data).length === 0) {
      const existing = await tx.superAdminBulkJob.findUnique({
        where: { id: input.jobId },
        include: {
          initiatedBy: {
            select: {
              userId: true,
              email: true
            }
          }
        }
      });

      return existing ? mapBulkJobRecord(existing) : null;
    }

    try {
      const record = await tx.superAdminBulkJob.update({
        where: { id: input.jobId },
        data,
        include: {
          initiatedBy: {
            select: {
              userId: true,
              email: true
            }
          }
        }
      });

      return mapBulkJobRecord(record);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return null;
      }
      throw error;
    }
  });
};

export const listRecentBulkJobsImpactingUser = async (
  claims: SupabaseJwtClaims | null,
  userId: string,
  options?: { limit?: number; actions?: SuperAdminBulkAction[] }
): Promise<SuperAdminBulkJobSummary[]> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const records = await tx.superAdminBulkJob.findMany({
      where: {
        userIds: {
          has: userId
        },
        action: options?.actions ? { in: options.actions } : undefined
      },
      include: {
        initiatedBy: {
          select: {
            userId: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: options?.limit ?? 5
    });

    return records.map(mapBulkJobRecord);
  });
};
