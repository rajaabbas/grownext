import { randomUUID } from "node:crypto";
import type {
  Organization,
  OrganizationInvitation,
  OrganizationMember,
  OrganizationRole,
  ProductEntitlement,
  ProductRole,
  Tenant,
  TenantMember,
  TenantRole
} from "@prisma/client";
import { buildServiceRoleClaims, type SupabaseJwtClaims } from "@ma/core";
import { slugify, generateTenantSlug } from "./utils/slugify";
import {
  withAuthorizationTransaction,
  type PrismaTransaction
} from "./prisma";

interface CreateOrganizationInput {
  id?: string;
  name: string;
  slug?: string | null;
  owner: {
    userId: string;
    email: string;
    fullName: string;
  };
  defaultTenantName?: string;
}

export interface OrganizationWithOwner {
  organization: Organization;
  ownerMembership: OrganizationMember;
  defaultTenant: Tenant;
  defaultTenantMembership: TenantMember;
}

export const createOrganizationWithOwner = async (
  input: CreateOrganizationInput
): Promise<OrganizationWithOwner> => {
  const organizationId = input.id ?? randomUUID();
  const organizationSlug =
    input.slug ??
    slugify(input.name);
  const defaultTenantName = input.defaultTenantName ?? `${input.name} Workspace`;
  const defaultTenantSlug = generateTenantSlug(defaultTenantName);

  return withAuthorizationTransaction(buildServiceRoleClaims(organizationId), async (tx) => {
    const organization = await tx.organization.create({
      data: {
        id: organizationId,
        name: input.name,
        slug: organizationSlug ?? null
      }
    });

    const profile = await tx.userProfile.upsert({
      where: { userId: input.owner.userId },
      update: { email: input.owner.email, fullName: input.owner.fullName },
      create: {
        userId: input.owner.userId,
        email: input.owner.email,
        fullName: input.owner.fullName
      }
    });

    const ownerMembership = await tx.organizationMember.create({
      data: {
        organizationId,
        userId: profile.userId,
        role: "OWNER"
      }
    });

    const defaultTenant = await tx.tenant.create({
      data: {
        id: randomUUID(),
        organizationId,
        name: defaultTenantName,
        slug: defaultTenantSlug
      }
    });

    const defaultTenantMembership = await tx.tenantMember.create({
      data: {
        tenantId: defaultTenant.id,
        organizationMemberId: ownerMembership.id,
        role: "ADMIN"
      }
    });

    return {
      organization,
      ownerMembership,
      defaultTenant,
      defaultTenantMembership
    };
  });
};

export const listTenants = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<Array<Tenant>> => {
  return withAuthorizationTransaction(claims ?? buildServiceRoleClaims(organizationId), (tx) =>
    tx.tenant.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" }
    })
  );
};

interface CreateTenantInput {
  organizationId: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  grantingMemberId: string;
  role: TenantRole;
}

export interface TenantWithMembership {
  tenant: Tenant;
  membership: TenantMember;
}

export const createTenant = async (
  claims: SupabaseJwtClaims | null,
  input: CreateTenantInput
): Promise<TenantWithMembership> => {
  const tenantSlug = input.slug ? slugify(input.slug) : generateTenantSlug(input.name);

  return withAuthorizationTransaction(claims ?? buildServiceRoleClaims(input.organizationId), async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        name: input.name,
        slug: tenantSlug,
        description: input.description ?? null
      }
    });

    const membership = await tx.tenantMember.create({
      data: {
        tenantId: tenant.id,
        organizationMemberId: input.grantingMemberId,
        role: input.role
      }
    });

    return { tenant, membership };
  });
};

export const updateTenant = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string,
  data: Pick<Tenant, "name" | "description">
): Promise<Tenant> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.tenant.update({
      where: { id: tenantId },
      data: {
        name: data.name,
        description: data.description ?? null
      }
    })
  );
};

interface UpdateOrganizationInput {
  name: string;
  slug?: string | null;
}

export const updateOrganization = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string,
  input: UpdateOrganizationInput
): Promise<Organization> => {
  const nextSlug =
    input.slug !== undefined
      ? input.slug === null || input.slug.trim().length === 0
        ? null
        : slugify(input.slug)
      : undefined;

  return withAuthorizationTransaction(claims ?? buildServiceRoleClaims(organizationId), (tx) =>
    tx.organization.update({
      where: { id: organizationId },
      data: {
        name: input.name,
        ...(nextSlug !== undefined ? { slug: nextSlug } : {})
      }
    })
  );
};

export const attachMemberToTenant = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string,
  organizationMemberId: string,
  role: TenantRole
): Promise<TenantMember> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    return tx.tenantMember.upsert({
      where: {
        tenantId_organizationMemberId: {
          tenantId,
          organizationMemberId
        }
      },
      update: { role },
      create: {
        tenantId,
        organizationMemberId,
        role
      }
    });
  });
};

export const listOrganizationMembers = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<Array<OrganizationMember & { user: { email: string; fullName: string } }>> => {
  return withAuthorizationTransaction(claims ?? buildServiceRoleClaims(organizationId), (tx) =>
    tx.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            email: true,
            fullName: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    })
  );
};

interface CreateInvitationInput {
  organizationId: string;
  email: string;
  role: string;
  tenantId?: string;
  tenantRoles?: TenantRole[];
  productIds?: string[];
  invitedById: string;
  expiresAt: Date;
  tokenHash: string;
  tokenHint?: string | null;
  issuedIp?: string | null;
}

export const createOrganizationInvitation = async (
  tx: PrismaTransaction,
  input: CreateInvitationInput
): Promise<OrganizationInvitation> => {
  return tx.organizationInvitation.create({
    data: {
      organizationId: input.organizationId,
      tenantId: input.tenantId ?? null,
      email: input.email,
      role: input.role as unknown as OrganizationInvitation["role"],
      tenantRoles: input.tenantRoles ?? [],
      productIds: input.productIds ?? [],
      invitedById: input.invitedById,
      expiresAt: input.expiresAt,
      tokenHash: input.tokenHash,
      tokenHint: input.tokenHint ?? null,
      issuedIp: input.issuedIp ?? null
    }
  });
};

export const listOrganizationInvitations = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<OrganizationInvitation[]> => {
  return withAuthorizationTransaction(claims ?? buildServiceRoleClaims(organizationId), (tx) =>
    tx.organizationInvitation.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" }
    })
  );
};

export const getInvitationByTokenHash = async (
  tokenHash: string
): Promise<
  (OrganizationInvitation & {
    organization: Organization;
    tenant: Tenant | null;
  }) | null
> => {
  return withAuthorizationTransaction(buildServiceRoleClaims(undefined), (tx) =>
    tx.organizationInvitation.findUnique({
      where: { tokenHash },
      include: {
        organization: true,
        tenant: true
      }
    })
  );
};

const organizationRolePriority: Record<string, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1
};

const resolveTenantRoleFromInvitation = (
  invitation: OrganizationInvitation
): TenantRole => {
  if (invitation.tenantRoles.length > 0) {
    return invitation.tenantRoles[0]!;
  }
  if (invitation.role === "OWNER" || invitation.role === "ADMIN") {
    return "ADMIN";
  }
  return "MEMBER";
};

interface AcceptInvitationInput {
  tokenHash: string;
  userId: string;
  email: string;
  fullName?: string | null;
  ipAddress?: string | null;
}

export const acceptOrganizationInvitation = async (
  input: AcceptInvitationInput
): Promise<{
  invitation: OrganizationInvitation;
  organizationMember: OrganizationMember;
  tenantMembership: TenantMember | null;
  entitlements: ProductEntitlement[];
}> => {
  const invitationRecord = await getInvitationByTokenHash(input.tokenHash);

  if (!invitationRecord) {
    throw new Error("invitation_not_found");
  }

  const now = new Date();
  if (invitationRecord.expiresAt.getTime() < now.getTime()) {
    await withAuthorizationTransaction(
      buildServiceRoleClaims(invitationRecord.organizationId),
      (tx) =>
        tx.organizationInvitation.update({
          where: { id: invitationRecord.id },
          data: { status: "EXPIRED" }
        })
    );
    throw new Error("invitation_expired");
  }

  if (invitationRecord.status === "REVOKED") {
    throw new Error("invitation_revoked");
  }

  if (invitationRecord.status === "ACCEPTED") {
    throw new Error("invitation_already_accepted");
  }

  const roleRank = organizationRolePriority[invitationRecord.role] ?? 1;

  return withAuthorizationTransaction(
    buildServiceRoleClaims(invitationRecord.organizationId),
    async (tx) => {
      const invitation = await tx.organizationInvitation.update({
        where: { id: invitationRecord.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: now,
          acceptedIp: input.ipAddress ?? null
        }
      });

      const profile = await tx.userProfile.upsert({
        where: { userId: input.userId },
        update: {
          email: input.email,
          fullName:
            typeof input.fullName === "string" && input.fullName.trim().length > 0
              ? input.fullName.trim()
              : input.email
        },
        create: {
          userId: input.userId,
          email: input.email,
          fullName:
            typeof input.fullName === "string" && input.fullName.trim().length > 0
              ? input.fullName.trim()
              : input.email
        }
      });

      const existingMembership = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: profile.userId
          }
        }
      });

      let organizationMember: OrganizationMember;
      if (!existingMembership) {
        organizationMember = await tx.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId: profile.userId,
            role: invitation.role
          }
        });
      } else {
        const existingRank = organizationRolePriority[existingMembership.role] ?? 0;
        organizationMember =
          existingRank >= roleRank
            ? existingMembership
            : await tx.organizationMember.update({
                where: { id: existingMembership.id },
                data: { role: invitation.role }
              });
      }

      let tenantMembership: TenantMember | null = null;
      if (invitation.tenantId) {
        const tenantRole = resolveTenantRoleFromInvitation(invitation);
        tenantMembership = await tx.tenantMember.upsert({
          where: {
            tenantId_organizationMemberId: {
              tenantId: invitation.tenantId,
              organizationMemberId: organizationMember.id
            }
          },
          update: {
            role: tenantRole
          },
          create: {
            tenantId: invitation.tenantId,
            organizationMemberId: organizationMember.id,
            role: tenantRole
          }
        });
      }

      const entitlements: ProductEntitlement[] = [];
      if (invitation.productIds.length > 0 && invitation.tenantId) {
        const productRoles = tenantRole === "ADMIN" ? ["ADMIN"] : ["MEMBER"];
        for (const productId of invitation.productIds) {
          const entitlement = await tx.productEntitlement.upsert({
            where: {
              userId_productId_tenantId: {
                userId: organizationMember.userId,
                productId,
                tenantId: invitation.tenantId
              }
            },
            update: {
              roles: productRoles as ProductRole[]
            },
            create: {
              id: randomUUID(),
              organizationId: invitation.organizationId,
              tenantId: invitation.tenantId,
              productId,
              userId: organizationMember.userId,
              roles: productRoles as ProductRole[]
            }
          });
          entitlements.push(entitlement);
        }
      }

      return {
        invitation,
        organizationMember,
        tenantMembership,
        entitlements
      };
    }
  );
};

export const getOrganizationMember = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string,
  userId: string
): Promise<OrganizationMember | null> => {
  return withAuthorizationTransaction(claims ?? buildServiceRoleClaims(organizationId), (tx) =>
    tx.organizationMember.findFirst({
      where: { organizationId, userId }
    })
  );
};

export const getOrganizationById = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<Organization | null> => {
  return withAuthorizationTransaction(claims ?? buildServiceRoleClaims(organizationId), (tx) =>
    tx.organization.findUnique({
      where: { id: organizationId }
    })
  );
};

export interface RemovedOrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  user: {
    email: string;
    fullName: string | null;
  };
}

export const removeOrganizationMember = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string,
  organizationMemberId: string
): Promise<RemovedOrganizationMember | null> => {
  return withAuthorizationTransaction(claims ?? buildServiceRoleClaims(organizationId), async (tx) => {
    const member = await tx.organizationMember.findUnique({
      where: { id: organizationMemberId },
      include: {
        user: {
          select: {
            email: true,
            fullName: true
          }
        }
      }
    });

    if (!member || member.organizationId !== organizationId) {
      return null;
    }

    await tx.tenantMember.deleteMany({ where: { organizationMemberId } });
    await tx.productEntitlement.deleteMany({ where: { organizationId, userId: member.userId } });

    await tx.organizationMember.delete({ where: { id: organizationMemberId } });

    return {
      id: member.id,
      organizationId,
      userId: member.userId,
      role: member.role,
      user: {
        email: member.user.email,
        fullName: member.user.fullName
      }
    };
  });
};

export interface DeletedOrganizationSummary {
  id: string;
  name: string;
  slug: string | null;
}

export const deleteOrganization = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<DeletedOrganizationSummary | null> => {
  return withAuthorizationTransaction(claims ?? buildServiceRoleClaims(organizationId), async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true
      }
    });

    if (!organization) {
      return null;
    }

    await tx.organization.delete({ where: { id: organizationId } });

    return organization;
  });
};
