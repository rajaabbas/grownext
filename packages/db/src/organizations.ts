import { randomUUID } from "node:crypto";
import type {
  Organization,
  OrganizationInvitation,
  OrganizationMember,
  Tenant,
  TenantMember,
  TenantRole
} from "@prisma/client";
import { buildServiceRoleClaims, type SupabaseJwtClaims } from "@ma/core";
import { slugify } from "./utils/slugify";
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
  const defaultTenantSlug = slugify(`${organizationSlug ?? organizationId}-default`);

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
  const tenantSlug =
    input.slug ??
    slugify(`${input.organizationId}-${input.name}`);

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
