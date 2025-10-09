import { addHours } from "date-fns";
import {
  AddOrganizationMemberRequestSchema,
  CreateOrganizationInvitationRequestSchema,
  OrganizationInvitationSchema,
  OrganizationInvitationsResponseSchema,
  OrganizationMemberSchema,
  OrganizationMembersResponseSchema,
  OrganizationSchema,
  OrganizationUpdateRequestSchema,
  UpdateOrganizationMemberRoleRequestSchema
} from "@ma/contracts";
import { buildServiceRoleClaims, logger, type SupabaseJwtClaims } from "@ma/core";
import {
  addUserToOrganization,
  findAuthUserByEmail,
  findInvitationById,
  findOrganizationMemberById,
  getMembershipForClaims,
  getOrganizationForClaims,
  countOwnersForOrganization,
  listInvitationsForClaims,
  listOrganizationMembersForClaims,
  supabaseServiceClient,
  updateOrganizationForClaims,
  createInvitationForClaims,
  markInvitationStatus,
  removeMemberFromOrganization,
  updateMemberRole,
  withAuthorizationTransaction,
  Prisma
} from "@ma/db";
import { type FastifyPluginAsync } from "fastify";

const ensureAdmin = async (claims: SupabaseJwtClaims | null) => {
  const membership = await getMembershipForClaims(claims);
  if (!membership) {
    return null;
  }

  if (membership.role === "OWNER" || membership.role === "ADMIN") {
    return membership;
  }

  return null;
};

const organizationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/organization", async (request, reply) => {
    const organization = await getOrganizationForClaims(request.supabaseClaims);

    if (!organization) {
      fastify.log.warn("Organization lookup failed for request");
      reply.status(404);
      return { error: "Organization not found" };
    }

    return OrganizationSchema.parse({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString()
    });
  });

  fastify.put("/organization", async (request, reply) => {
    const adminMembership = await ensureAdmin(request.supabaseClaims);
    if (!adminMembership) {
      reply.status(403);
      return { error: "Admin role required" };
    }

    const payload = OrganizationUpdateRequestSchema.parse(request.body ?? {});

    try {
      const updated = await updateOrganizationForClaims(request.supabaseClaims, {
        name: payload.name,
        slug: payload.slug ?? null
      });

      if (!updated) {
        reply.status(404);
        return { error: "Organization not found" };
      }

      return OrganizationSchema.parse({
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString()
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        reply.status(409);
        return { error: "Organization slug is already in use" };
      }
      logger.error({ error }, "Failed to update organization");
      reply.status(400);
      return { error: "Unable to update organization" };
    }
  });

  fastify.get("/organization/members", async (request) => {
    const members = await listOrganizationMembersForClaims(request.supabaseClaims);

    return OrganizationMembersResponseSchema.parse({
      members: members.map((member) => ({
        id: member.id,
        organizationId: member.organizationId,
        role: member.role,
        userId: member.userId,
        email: member.user.email,
        fullName: member.user.fullName,
        createdAt: member.createdAt.toISOString(),
        updatedAt: member.updatedAt.toISOString()
      }))
    });
  });

  fastify.post(
    "/organization/invitations",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
    const adminMembership = await ensureAdmin(request.supabaseClaims);
    if (!adminMembership) {
      reply.status(403);
      return { error: "Admin role required" };
    }

    const payload = CreateOrganizationInvitationRequestSchema.parse(request.body ?? {});
    const organizationId = request.supabaseClaims?.organization_id;

    if (!organizationId) {
      reply.status(400);
      return { error: "Organization context missing" };
    }

    const existingUser = await findAuthUserByEmail(payload.email);
    if (existingUser) {
      const organizationClaim = existingUser.appMetadata?.organization_id as string | undefined;
      if (organizationClaim && organizationClaim !== organizationId) {
        reply.status(409);
        return { error: "User already belongs to another organization" };
      }
    }

    const existingMember = await withAuthorizationTransaction(
      buildServiceRoleClaims(organizationId),
      (tx) =>
        tx.organizationMember.findFirst({
          where: {
            organizationId,
            user: {
              email: payload.email
            }
          }
        })
    );

    if (existingMember) {
      reply.status(409);
      return { error: "This email already belongs to an organization member" };
    }

    const pendingInvitation = await withAuthorizationTransaction(
      buildServiceRoleClaims(organizationId),
      (tx) =>
        tx.organizationInvitation.findFirst({
          where: {
            organizationId,
            email: payload.email,
            status: "PENDING"
          }
        })
    );

    if (pendingInvitation) {
      reply.status(409);
      return { error: "An invitation is already pending for this email" };
    }

    const expiresAt = addHours(new Date(), payload.expiresInHours);

    if (payload.role === "OWNER" && adminMembership.role !== "OWNER") {
      reply.status(403);
      return { error: "Only organization owners can invite additional owners." };
    }

    const issuedIpHeader = request.headers["x-forwarded-for"];
    const issuedIp = Array.isArray(issuedIpHeader)
      ? issuedIpHeader[0]
      : issuedIpHeader ?? request.ip;

    try {
      const created = await createInvitationForClaims({
        claims: request.supabaseClaims,
        email: payload.email,
        role: payload.role,
        invitedByUserId: adminMembership.userId,
        expiresAt,
        issuedIp
      });

      if (!created) {
        reply.status(400);
        return { error: "Unable to create invitation" };
      }

      const { invitation, token } = created;

      return OrganizationInvitationSchema.parse({
        id: invitation.id,
        organizationId: invitation.organizationId,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        token,
        tokenHint: invitation.tokenHint ?? undefined,
        issuedIp: invitation.issuedIp ?? undefined,
        acceptedIp: invitation.acceptedIp ?? undefined,
        acceptedAt: invitation.acceptedAt?.toISOString(),
        invitedById: invitation.invitedById,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
        updatedAt: invitation.updatedAt.toISOString()
      });
    } catch (error) {
      logger.error({ error }, "Failed to create invitation");
      reply.status(400);
      return { error: "Unable to create invitation" };
    }
  });

  fastify.get("/organization/invitations", async (request) => {
    const invitations = await listInvitationsForClaims(request.supabaseClaims);

    return OrganizationInvitationsResponseSchema.parse({
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        organizationId: invitation.organizationId,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        tokenHint: invitation.tokenHint ?? undefined,
        issuedIp: invitation.issuedIp ?? undefined,
        acceptedIp: invitation.acceptedIp ?? undefined,
        acceptedAt: invitation.acceptedAt?.toISOString(),
        invitedById: invitation.invitedById,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
        updatedAt: invitation.updatedAt.toISOString()
      }))
    });
  });

  fastify.delete("/organization/invitations/:id", async (request, reply) => {
    const adminMembership = await ensureAdmin(request.supabaseClaims);
    if (!adminMembership) {
      reply.status(403);
      return { error: "Admin role required" };
    }

    const { id } = request.params as { id: string };
    const invitation = await findInvitationById(id);

    if (!invitation || invitation.organizationId !== adminMembership.organizationId) {
      reply.status(404);
      return { error: "Invitation not found" };
    }

    if (invitation.status !== "PENDING") {
      reply.status(409);
      return { error: "Invitation can no longer be revoked" };
    }

    await markInvitationStatus(invitation.id, "REVOKED");

    reply.status(204);
  });

  fastify.post("/organization/members", async (request, reply) => {
    const adminMembership = await ensureAdmin(request.supabaseClaims);
    if (!adminMembership) {
      reply.status(403);
      return { error: "Admin role required" };
    }

    const payload = AddOrganizationMemberRequestSchema.parse(request.body ?? {});
    const organizationId = request.supabaseClaims?.organization_id;

    if (!organizationId) {
      reply.status(400);
      return { error: "Organization context missing" };
    }

    const existingUser = await findAuthUserByEmail(payload.email);

    if (!existingUser) {
      reply.status(404);
      return { error: "No user found for the provided email" };
    }

    const organizationClaim = existingUser.appMetadata?.organization_id as string | undefined;

    if (organizationClaim && organizationClaim !== organizationId) {
      reply.status(409);
      return { error: "User already belongs to another organization" };
    }

    const alreadyMember = await withAuthorizationTransaction(
      buildServiceRoleClaims(organizationId),
      (tx) =>
        tx.organizationMember.findFirst({
          where: {
            organizationId,
            userId: existingUser.id
          }
        })
    );

    if (alreadyMember) {
      reply.status(409);
      return { error: "User is already a member of this organization" };
    }

    if (payload.role === "OWNER" && adminMembership.role !== "OWNER") {
      reply.status(403);
      return { error: "Only organization owners can assign the OWNER role." };
    }

    await supabaseServiceClient.auth.admin.updateUserById(existingUser.id, {
      app_metadata: {
        organization_id: organizationId
      },
      user_metadata: {
        ...(existingUser.userMetadata ?? {}),
        ...(payload.fullName ? { full_name: payload.fullName } : {}),
        organization_id: organizationId
      }
    });

    const membership = await addUserToOrganization(
      organizationId,
      existingUser.id,
      payload.email,
      payload.role,
      payload.fullName ?? (existingUser.userMetadata?.full_name as string | undefined)
    );

    return OrganizationMemberSchema.parse({
      id: membership.id,
      organizationId: membership.organizationId,
      role: membership.role,
      userId: membership.userId,
      email: payload.email,
      fullName:
        payload.fullName ?? (existingUser.userMetadata?.full_name as string | undefined) ?? "",
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString()
    });
  });

  fastify.patch("/organization/members/:id", async (request, reply) => {
    const adminMembership = await ensureAdmin(request.supabaseClaims);
    if (!adminMembership) {
      reply.status(403);
      return { error: "Admin role required" };
    }

    const { id } = request.params as { id: string };
    const payload = UpdateOrganizationMemberRoleRequestSchema.parse(request.body ?? {});
    const target = await findOrganizationMemberById(id);

    if (!target || target.organizationId !== adminMembership.organizationId) {
      reply.status(404);
      return { error: "Member not found" };
    }

    if (payload.role === target.role) {
      return OrganizationMemberSchema.parse({
        id: target.id,
        organizationId: target.organizationId,
        role: target.role,
        userId: target.userId,
        email: target.user.email,
        fullName: target.user.fullName,
        createdAt: target.createdAt.toISOString(),
        updatedAt: target.updatedAt.toISOString()
      });
    }

    const isOwnerChanging = target.role === "OWNER";
    const isPromotingToOwner = payload.role === "OWNER";
    const viewerIsOwner = adminMembership.role === "OWNER";

    if (isPromotingToOwner && !viewerIsOwner) {
      reply.status(403);
      return { error: "Only owners can promote new owners." };
    }

    if (isOwnerChanging && !viewerIsOwner) {
      reply.status(403);
      return { error: "Only owners can modify other owners." };
    }

    if (isOwnerChanging && payload.role !== "OWNER") {
      const ownerCount = await countOwnersForOrganization(target.organizationId);
      if (ownerCount <= 1) {
        reply.status(409);
        return { error: "At least one owner is required for the organization." };
      }
    }

    const updated = await updateMemberRole(request.supabaseClaims, id, payload.role);

    return OrganizationMemberSchema.parse({
      id: updated.id,
      organizationId: updated.organizationId,
      role: updated.role,
      userId: updated.userId,
      email: target.user.email,
      fullName: target.user.fullName,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    });
  });

  fastify.delete("/organization/members/:id", async (request, reply) => {
    const adminMembership = await ensureAdmin(request.supabaseClaims);
    if (!adminMembership) {
      reply.status(403);
      return { error: "Admin role required" };
    }

    const { id } = request.params as { id: string };
    const member = await findOrganizationMemberById(id);

    if (!member || member.organizationId !== adminMembership.organizationId) {
      reply.status(404);
      return { error: "Member not found" };
    }

    const viewerIsOwner = adminMembership.role === "OWNER";
    const isRemovingOwner = member.role === "OWNER";
    const isSelf = member.userId === adminMembership.userId;

    if (isRemovingOwner && !viewerIsOwner) {
      reply.status(403);
      return { error: "Only owners can remove other owners." };
    }

    if (isRemovingOwner) {
      const ownerCount = await countOwnersForOrganization(member.organizationId);
      if (ownerCount <= 1) {
        reply.status(409);
        return { error: "Cannot remove the last remaining owner." };
      }
    }

    if (isSelf && isRemovingOwner) {
      const ownerCount = await countOwnersForOrganization(member.organizationId);
      if (ownerCount <= 1) {
        reply.status(409);
        return { error: "Transfer ownership to another member before leaving the organization." };
      }
    }

    await removeMemberFromOrganization(request.supabaseClaims, member.id);

    try {
      const existingAuthUser = await findAuthUserByEmail(member.user.email);
      await supabaseServiceClient.auth.admin.updateUserById(member.userId, {
        app_metadata: {
          organization_id: null
        },
        user_metadata: {
          ...(existingAuthUser?.userMetadata ?? {}),
          full_name: member.user.fullName
        }
      });
    } catch (error) {
      logger.warn({ error, userId: member.userId }, "Failed to detach organization metadata from Supabase user");
    }

    reply.status(204);
  });
};

export default organizationRoutes;
