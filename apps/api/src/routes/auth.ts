import { randomUUID } from "crypto";
import { isAfter } from "date-fns";
import {
  AcceptInvitationRequestSchema,
  AuthFlowResponseSchema,
  AuthSessionSchema,
  InvitationDetailsResponseSchema,
  SignUpRequestSchema,
  PasswordResetRequestSchema,
  PasswordResetResponseSchema
} from "@ma/contracts";
import { buildServiceRoleClaims, env, logger } from "@ma/core";
import {
  addUserToOrganization,
  createOrganizationWithOwner,
  findAuthUserByEmail,
  findInvitationByToken,
  markInvitationStatus,
  deleteOrganizationCascade,
  removeUserFromOrganizationRecords,
  supabaseServiceClient,
  withAuthorizationTransaction,
  Prisma
} from "@ma/db";
import { type FastifyPluginAsync, type FastifyRequest } from "fastify";

const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
};

const buildSessionResponse = (input: {
  userId: string;
  organizationId: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}) => {
  return AuthSessionSchema.parse({
    userId: input.userId,
    organizationId: input.organizationId,
    accessToken: input.access_token,
    refreshToken: input.refresh_token,
    expiresIn: input.expires_in,
    tokenType: input.token_type
  });
};

const buildVerificationRedirect = (next: string) => {
  const confirmPath = `/auth/confirm?next=${encodeURIComponent(next)}`;
  return `${env.APP_BASE_URL}/auth/callback?next=${encodeURIComponent(confirmPath)}`;
};

type AuthAttemptKind = "signup" | "invitation";

const EXTENDED_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const EXTENDED_RATE_LIMIT_MAX_ATTEMPTS = 10;

type AuthAttemptEntry = Record<AuthAttemptKind, number[]>;

const authAttemptStore = new Map<string, AuthAttemptEntry>();

const resolveClientIp = (request: FastifyRequest): string => {
  const override =
    env.NODE_ENV !== "production" ? request.headers["x-testsuite-ip"] : undefined;
  if (override) {
    if (Array.isArray(override)) {
      return override[0] ?? request.ip;
    }
    return override;
  }

  return request.ip;
};

const registerAuthAttempt = (ip: string, kind: AuthAttemptKind): boolean => {
  const now = Date.now();
  const entry = authAttemptStore.get(ip) ?? { signup: [], invitation: [] };

  const cutoff = now - EXTENDED_RATE_LIMIT_WINDOW_MS;
  entry[kind] = entry[kind].filter((timestamp) => timestamp > cutoff);

  if (entry[kind].length >= EXTENDED_RATE_LIMIT_MAX_ATTEMPTS) {
    if (entry.signup.length === 0 && entry.invitation.length === 0) {
      authAttemptStore.delete(ip);
    } else {
      authAttemptStore.set(ip, entry);
    }
    return false;
  }

  entry[kind].push(now);
  if (entry.signup.length === 0 && entry.invitation.length === 0) {
    authAttemptStore.delete(ip);
  } else {
    authAttemptStore.set(ip, entry);
  }

  return true;
};

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/auth/signup",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
    if (!env.E2E_BYPASS_RATE_LIMIT) {
      const clientIp = resolveClientIp(request);
      if (!registerAuthAttempt(clientIp, "signup")) {
        reply.status(429);
        return { error: "Too many signup attempts from this IP. Try again later." };
      }
    }

    const body = SignUpRequestSchema.parse(request.body ?? {});
    const { organizationName, organizationSlug, fullName, email, password } = body;

    const generatedSlug = slugify(organizationName);
    const slug = organizationSlug ?? (generatedSlug.length > 0 ? generatedSlug : null);

    const existingUser = await findAuthUserByEmail(email);
    if (existingUser) {
      reply.status(409);
      return { error: "An account with this email already exists." };
    }

    const organizationId = randomUUID();

    const createdUser = await supabaseServiceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        organization_id: organizationId,
        email_verified: false
      },
      app_metadata: {
        organization_id: organizationId
      }
    });

    if (createdUser.error || !createdUser.data.user) {
      logger.error({ error: createdUser.error }, "Failed to create Supabase user during signup");
      reply.status(500);
      return { error: "Failed to create account" };
    }

    const supabaseUserId = createdUser.data.user.id;
    let organizationCreated = false;

    try {
      await createOrganizationWithOwner({
        organizationId,
        organizationName,
        organizationSlug: slug,
        ownerUserId: supabaseUserId,
        ownerEmail: email,
        ownerFullName: fullName
      });
      organizationCreated = true;
    } catch (error) {
      await supabaseServiceClient.auth.admin.deleteUser(supabaseUserId).catch((cleanupError) => {
        logger.warn({ cleanupError, supabaseUserId }, "Failed to delete Supabase user after signup error");
      });

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        reply.status(409);
        return { error: "Organization slug is already in use" };
      }
      logger.error({ error }, "Failed to create organization records");
      reply.status(500);
      return { error: "Failed to create organization" };
    }

    const sessionResult = await supabaseServiceClient.auth.signInWithPassword({
      email,
      password
    });

    if (sessionResult.error || !sessionResult.data.session) {
      if (organizationCreated) {
        await deleteOrganizationCascade(organizationId).catch((cleanupError) => {
          logger.warn({ cleanupError, organizationId }, "Failed to delete organization after signup session failure");
        });
      }

      await supabaseServiceClient.auth.admin.deleteUser(supabaseUserId).catch((cleanupError) => {
        logger.warn({ cleanupError, supabaseUserId }, "Failed to delete Supabase user after session failure");
      });

      reply.status(500);
      return { error: "Account created but failed to start session" };
    }

    const verification = await supabaseServiceClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        data: {
          full_name: fullName,
          organization_id: organizationId,
          email_verified: false
        },
        redirectTo: buildVerificationRedirect("/dashboard")
      }
    });

    if (verification.error) {
      logger.warn(
        { error: verification.error },
        "Failed to generate Supabase verification link during signup"
      );
    }

    const session = buildSessionResponse({
      userId: supabaseUserId,
      organizationId,
      access_token: sessionResult.data.session.access_token,
      refresh_token: sessionResult.data.session.refresh_token,
      expires_in: sessionResult.data.session.expires_in,
      token_type: sessionResult.data.session.token_type
    });

    reply.status(201);
    return AuthFlowResponseSchema.parse({
      status: "session",
      session
    });
  }
  );

  fastify.post(
    "/auth/password/reset",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      const { email } = PasswordResetRequestSchema.parse(request.body ?? {});

    const redirectTo = `${env.APP_BASE_URL}/auth/reset-password/confirm`;

    const resetResult = await supabaseServiceClient.auth.resetPasswordForEmail(email, {
      redirectTo
    });

      if (resetResult.error) {
        logger.warn({ error: resetResult.error }, "Supabase password reset request failed");
      }

      const recoveryLink = await supabaseServiceClient.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo
        }
      });

      if (recoveryLink.error) {
        logger.warn(
          { error: recoveryLink.error },
          "Failed to generate Supabase recovery link for password reset"
        );
      }

      const includeLink = env.NODE_ENV !== "production";
      const response = PasswordResetResponseSchema.parse({
        status: "email_sent" as const,
        message: "If an account exists for that email, a password reset link is on its way.",
        ...(includeLink && recoveryLink.data?.properties?.action_link
          ? { verificationLink: recoveryLink.data.properties.action_link }
          : {})
      });

      reply.status(202);
      return response;
    }
  );

  fastify.get("/auth/invitations/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const invitation = await findInvitationByToken(token);

    if (!invitation || invitation.status !== "PENDING") {
      reply.status(404);
      return { error: "Invitation not found" };
    }

    if (isAfter(new Date(), invitation.expiresAt)) {
      reply.status(410);
      return { error: "Invitation has expired" };
    }

    const organization = await withAuthorizationTransaction(
      buildServiceRoleClaims(invitation.organizationId),
      (tx) =>
        tx.organization.findUnique({
          where: { id: invitation.organizationId }
        })
    );

    if (!organization) {
      reply.status(404);
      return { error: "Organization not found" };
    }

    const response = InvitationDetailsResponseSchema.parse({
      id: invitation.id,
      organizationId: invitation.organizationId,
      organizationName: organization.name,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString()
    });

    return response;
  });

  fastify.post(
    "/auth/invitations/:token/accept",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
    if (!env.E2E_BYPASS_RATE_LIMIT) {
      const clientIp = resolveClientIp(request);
      if (!registerAuthAttempt(clientIp, "invitation")) {
        reply.status(429);
        return { error: "Too many invitation accept attempts from this IP. Try again later." };
      }
    }

    const { token } = request.params as { token: string };
    const body = AcceptInvitationRequestSchema.parse(request.body ?? {});

    const invitation = await findInvitationByToken(token);
    if (!invitation || invitation.status !== "PENDING") {
      reply.status(404);
      return { error: "Invitation not found" };
    }

    if (isAfter(new Date(), invitation.expiresAt)) {
      await markInvitationStatus(invitation.id, "EXPIRED");
      reply.status(410);
      return { error: "Invitation has expired" };
    }

    const existingUser = await findAuthUserByEmail(invitation.email);
    if (existingUser) {
      reply.status(409);
      return {
        error: "An account with this email already exists. Contact an administrator to be added manually."
      };
    }

    const createdUser = await supabaseServiceClient.auth.admin.createUser({
      email: invitation.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.fullName,
        organization_id: invitation.organizationId,
        email_verified: false
      },
      app_metadata: {
        organization_id: invitation.organizationId
      }
    });

    if (createdUser.error || !createdUser.data.user) {
      logger.error({ error: createdUser.error }, "Failed to create Supabase user from invitation");
      reply.status(500);
      return { error: "Failed to create account" };
    }

    const supabaseUserId = createdUser.data.user.id;
    let membershipCreated = false;

    try {
      await addUserToOrganization(
        invitation.organizationId,
        supabaseUserId,
        invitation.email,
        invitation.role,
        body.fullName
      );
      membershipCreated = true;
    } catch (error) {
      await supabaseServiceClient.auth.admin.deleteUser(supabaseUserId).catch((cleanupError) => {
        logger.warn({ cleanupError, supabaseUserId }, "Failed to delete Supabase user after invitation membership error");
      });

      logger.error({ error }, "Failed to add user to organization during invitation acceptance");
      reply.status(500);
      return { error: "Unable to add user to organization" };
    }

    const sessionResult = await supabaseServiceClient.auth.signInWithPassword({
      email: invitation.email,
      password: body.password
    });

    if (sessionResult.error || !sessionResult.data.session) {
      if (membershipCreated) {
        await removeUserFromOrganizationRecords(
          invitation.organizationId,
          supabaseUserId,
          { deleteProfile: true }
        ).catch(
          (cleanupError) => {
            logger.warn(
              { cleanupError, organizationId: invitation.organizationId, supabaseUserId },
              "Failed to roll back organization membership after invitation session failure"
            );
          }
        );
      }

      await supabaseServiceClient.auth.admin.deleteUser(supabaseUserId).catch((cleanupError) => {
        logger.warn({ cleanupError, supabaseUserId }, "Failed to delete Supabase user after invitation session failure");
      });

      reply.status(500);
      return { error: "Account created but failed to start session" };
    }

    const verification = await supabaseServiceClient.auth.admin.generateLink({
      type: "magiclink",
      email: invitation.email,
      options: {
        data: {
          full_name: body.fullName,
          organization_id: invitation.organizationId,
          email_verified: false
        },
        redirectTo: buildVerificationRedirect("/dashboard")
      }
    });

    if (verification.error) {
      logger.warn(
        { error: verification.error },
        "Failed to generate Supabase verification link during invitation acceptance"
      );
    }

    const session = buildSessionResponse({
      userId: supabaseUserId,
      organizationId: invitation.organizationId,
      access_token: sessionResult.data.session.access_token,
      refresh_token: sessionResult.data.session.refresh_token,
      expires_in: sessionResult.data.session.expires_in,
      token_type: sessionResult.data.session.token_type
    });

    await markInvitationStatus(invitation.id, "ACCEPTED", {
      acceptedAt: new Date(),
      acceptedIp: request.ip
    });

    reply.status(201);
    return AuthFlowResponseSchema.parse({
      status: "session",
      session
    });
  }
  );
};

export default authRoutes;
