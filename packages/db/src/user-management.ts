import { createHash, randomUUID } from "crypto";
import type {
  InvitationStatus,
  Organization,
  OrganizationInvitation,
  OrganizationMember,
  OrganizationRole,
  Prisma
} from "@prisma/client";
import { buildServiceRoleClaims, type SupabaseJwtClaims } from "@ma/core";
import { withAuthorizationTransaction, type PrismaTransaction } from "./prisma";

interface CreateOrganizationOwnerInput {
  organizationId: string;
  organizationName: string;
  organizationSlug?: string | null;
  ownerUserId: string;
  ownerEmail: string;
  ownerFullName: string;
}

export const createOrganizationWithOwner = async (
  input: CreateOrganizationOwnerInput
): Promise<{
  organization: Organization;
  ownerMembership: OrganizationMember;
}> => {
  const {
    organizationId,
    organizationName,
    organizationSlug,
    ownerUserId,
    ownerEmail,
    ownerFullName
  } = input;

  return withAuthorizationTransaction(buildServiceRoleClaims(organizationId), async (tx) => {
    const organization = await tx.organization.create({
      data: {
        id: organizationId,
        name: organizationName,
        slug: organizationSlug ?? null
      }
    });

    await tx.userProfile.upsert({
      where: { userId: ownerUserId },
      update: { fullName: ownerFullName, email: ownerEmail },
      create: {
        userId: ownerUserId,
        email: ownerEmail,
        fullName: ownerFullName
      }
    });

    const ownerMembership = await tx.organizationMember.create({
      data: {
        organizationId,
        userId: ownerUserId,
        role: "OWNER"
      }
    });

    return { organization, ownerMembership };
  });
};

export const getOrganizationForClaims = async (
  claims: SupabaseJwtClaims | null
): Promise<Organization | null> => {
  const organizationId = claims?.organization_id;
  if (!organizationId) {
    return null;
  }

  return withAuthorizationTransaction(claims, (tx) =>
    tx.organization.findUnique({
      where: { id: organizationId }
    })
  );
};

export const updateOrganizationForClaims = async (
  claims: SupabaseJwtClaims | null,
  data: Pick<Prisma.OrganizationUpdateInput, "name" | "slug">
): Promise<Organization | null> => {
  const organizationId = claims?.organization_id;
  if (!organizationId) {
    return null;
  }

  return withAuthorizationTransaction(claims, (tx) =>
    tx.organization.update({
      where: { id: organizationId },
      data
    })
  );
};

export const getUserProfileForClaims = async (
  claims: SupabaseJwtClaims | null
): Promise<{ userId: string; email: string; fullName: string } | null> => {
  const userId = claims?.sub;
  if (!userId) {
    return null;
  }

  const profile = await withAuthorizationTransaction(claims, (tx) =>
    tx.userProfile.findUnique({
      where: { userId }
    })
  );

  if (!profile) {
    return null;
  }

  return {
    userId: profile.userId,
    email: profile.email,
    fullName: profile.fullName
  };
};

export const upsertUserProfileForClaims = async (
  claims: SupabaseJwtClaims | null,
  fullName: string,
  email: string
): Promise<{ userId: string; email: string; fullName: string } | null> => {
  const userId = claims?.sub;
  if (!userId) {
    return null;
  }

  const profile = await withAuthorizationTransaction(claims, (tx) =>
    tx.userProfile.upsert({
      where: { userId },
      update: {
        fullName,
        email
      },
      create: {
        userId,
        email,
        fullName
      }
    })
  );

  return {
    userId: profile.userId,
    email: profile.email,
    fullName: profile.fullName
  };
};

export interface OrganizationMemberWithProfile extends OrganizationMember {
  user: {
    userId: string;
    email: string;
    fullName: string;
  };
}

export const listOrganizationMembersForClaims = async (
  claims: SupabaseJwtClaims | null
): Promise<OrganizationMemberWithProfile[]> => {
  if (!claims?.organization_id) {
    return [];
  }

  return withAuthorizationTransaction(claims, (tx) =>
    tx.organizationMember.findMany({
      where: {
        organizationId: claims.organization_id
      },
      include: {
        user: true
      },
      orderBy: {
        createdAt: "asc"
      }
    })
  );
};

export const getMembershipForClaims = async (
  claims: SupabaseJwtClaims | null
): Promise<OrganizationMember | null> => {
  if (!claims?.organization_id || !claims?.sub) {
    return null;
  }

  return withAuthorizationTransaction(claims, (tx) =>
    tx.organizationMember.findFirst({
      where: {
        organizationId: claims.organization_id,
        userId: claims.sub
      }
    })
  );
};

interface CreateInvitationInput {
  claims: SupabaseJwtClaims | null;
  email: string;
  role: OrganizationRole;
  invitedByUserId: string;
  expiresAt: Date;
  token?: string;
  issuedIp?: string | null;
}

interface CreateInvitationResult {
  invitation: OrganizationInvitation;
  token: string;
}

export const createInvitationForClaims = async ({
  claims,
  email,
  role,
  invitedByUserId,
  expiresAt,
  token,
  issuedIp
}: CreateInvitationInput): Promise<CreateInvitationResult | null> => {
  const organizationId = claims?.organization_id;
  if (!organizationId) {
    return null;
  }

  const rawToken = token ?? randomUUID().replace(/-/g, "");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const tokenHint = rawToken.slice(-6);

  return withAuthorizationTransaction(claims, async (tx) => {
    const invitation = await tx.organizationInvitation.create({
      data: {
        organizationId,
        email,
        role,
        status: "PENDING",
        tokenHash,
        tokenHint,
        issuedIp: issuedIp ?? null,
        invitedById: invitedByUserId,
        expiresAt
      }
    });

    return { invitation, token: rawToken };
  });
};

export const listInvitationsForClaims = async (
  claims: SupabaseJwtClaims | null,
  statuses: InvitationStatus[] = ["PENDING"]
): Promise<OrganizationInvitation[]> => {
  const organizationId = claims?.organization_id;
  if (!organizationId) {
    return [];
  }

  return withAuthorizationTransaction(claims, (tx) =>
    tx.organizationInvitation.findMany({
      where: {
        organizationId,
        status: { in: statuses }
      },
      orderBy: {
        createdAt: "desc"
      }
    })
  );
};

export const findInvitationByToken = async (
  token: string
): Promise<OrganizationInvitation | null> => {
  const tokenHash = createHash("sha256").update(token).digest("hex");

  return withAuthorizationTransaction(buildServiceRoleClaims(undefined), (tx) =>
    tx.organizationInvitation.findUnique({
      where: { tokenHash }
    })
  );
};

export const findInvitationById = async (
  id: string
): Promise<OrganizationInvitation | null> => {
  return withAuthorizationTransaction(buildServiceRoleClaims(undefined), (tx) =>
    tx.organizationInvitation.findUnique({
      where: { id }
    })
  );
};

export const markInvitationStatus = async (
  invitationId: string,
  status: InvitationStatus,
  metadata?: {
    acceptedIp?: string | null;
    acceptedAt?: Date | null;
  }
): Promise<OrganizationInvitation> => {
  return withAuthorizationTransaction(buildServiceRoleClaims(undefined), (tx) =>
    tx.organizationInvitation.update({
      where: { id: invitationId },
      data: {
        status,
        ...(metadata?.acceptedIp !== undefined ? { acceptedIp: metadata.acceptedIp ?? null } : {}),
        ...(metadata?.acceptedAt !== undefined ? { acceptedAt: metadata.acceptedAt ?? null } : {})
      }
    })
  );
};

export const addUserToOrganization = async (
  organizationId: string,
  userId: string,
  email: string,
  role: OrganizationRole,
  fullName?: string
): Promise<OrganizationMember> => {
  return withAuthorizationTransaction(buildServiceRoleClaims(organizationId), async (tx) => {
    await tx.userProfile.upsert({
      where: { userId },
      update: {
        email,
        ...(fullName ? { fullName } : {})
      },
      create: {
        userId,
        email,
        fullName: fullName ?? ""
      }
    });

    return tx.organizationMember.create({
      data: {
        organizationId,
        userId,
        role
      }
    });
  });
};

export const removeMemberFromOrganization = async (
  claims: SupabaseJwtClaims | null,
  memberId: string
): Promise<void> => {
  await withAuthorizationTransaction(claims, (tx) =>
    tx.organizationMember.delete({
      where: { id: memberId }
    })
  );
};

export const updateMemberRole = async (
  claims: SupabaseJwtClaims | null,
  memberId: string,
  role: OrganizationRole
): Promise<OrganizationMember> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.organizationMember.update({
      where: { id: memberId },
      data: { role }
    })
  );
};

export const findMembershipByUserId = async (
  tx: PrismaTransaction,
  organizationId: string,
  userId: string
): Promise<OrganizationMember | null> => {
  return tx.organizationMember.findFirst({
    where: {
      organizationId,
      userId
    }
  });
};

export const findOrganizationMemberById = async (
  memberId: string
): Promise<OrganizationMemberWithProfile | null> => {
  return withAuthorizationTransaction(buildServiceRoleClaims(undefined), (tx) =>
    tx.organizationMember.findUnique({
      where: { id: memberId },
      include: { user: true }
    })
  );
};

export const countOwnersForOrganization = async (organizationId: string): Promise<number> => {
  const result = await withAuthorizationTransaction(
    buildServiceRoleClaims(organizationId),
    (tx) =>
      tx.organizationMember.count({
        where: {
          organizationId,
          role: "OWNER"
        }
      })
  );

  return result;
};

interface AuthUserRecord {
  id: string;
  email: string;
  appMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
}

export const findAuthUserByEmail = async (email: string): Promise<AuthUserRecord | null> => {
  const results = await withAuthorizationTransaction(buildServiceRoleClaims(undefined), (tx) =>
    tx.$queryRaw<Array<{ id: string; email: string; raw_app_meta_data: Prisma.JsonValue; raw_user_meta_data: Prisma.JsonValue }>>`
      select id::text as id,
             email,
             raw_app_meta_data,
             raw_user_meta_data
      from auth.users
      where email = ${email}
      limit 1
    `
  );

  if (!results || results.length === 0) {
    return null;
  }

  const [user] = results;

  return {
    id: user.id,
    email: user.email,
    appMetadata: (user.raw_app_meta_data as Record<string, unknown>) ?? {},
    userMetadata: (user.raw_user_meta_data as Record<string, unknown>) ?? {}
  };
};

export const deleteOrganizationCascade = async (organizationId: string): Promise<void> => {
  await withAuthorizationTransaction(buildServiceRoleClaims(organizationId), (tx) =>
    tx.organization.delete({ where: { id: organizationId } })
  );
};

interface RemoveUserFromOrganizationOptions {
  deleteProfile?: boolean;
}

export const removeUserFromOrganizationRecords = async (
  organizationId: string,
  userId: string,
  options?: RemoveUserFromOrganizationOptions
): Promise<void> => {
  const { deleteProfile = false } = options ?? {};

  await withAuthorizationTransaction(buildServiceRoleClaims(organizationId), async (tx) => {
    await tx.organizationMember.deleteMany({ where: { organizationId, userId } });

    if (deleteProfile) {
      await tx.userProfile.delete({ where: { userId } }).catch(() => undefined);
    }
  });
};
