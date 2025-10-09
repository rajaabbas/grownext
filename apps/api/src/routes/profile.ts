import {
  UpdateUserProfileRequestSchema,
  UpdatePasswordRequestSchema,
  UpdatePasswordResponseSchema,
  UserProfileSchema
} from "@ma/contracts";
import { logger } from "@ma/core";
import {
  supabaseServiceClient,
  upsertUserProfileForClaims,
  getUserProfileForClaims,
  findAuthUserByEmail
} from "@ma/db";
import { type FastifyPluginAsync } from "fastify";

const profileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/profile", async (request, reply) => {
    const profile = await getUserProfileForClaims(request.supabaseClaims);

    if (!profile) {
      reply.status(404);
      return { error: "Profile not found" };
    }

    return UserProfileSchema.parse(profile);
  });

  fastify.put("/profile", async (request, reply) => {
    const { fullName, email } = UpdateUserProfileRequestSchema.parse(request.body ?? {});
    const claims = request.supabaseClaims;

    if (!claims?.sub) {
      reply.status(401);
      return { error: "Unauthorized" };
    }

    const existingProfile = await getUserProfileForClaims(claims);
    const currentEmail = existingProfile?.email ?? (claims.email as string | undefined) ?? null;

    if (!currentEmail) {
      reply.status(400);
      return { error: "Unable to resolve user email" };
    }

    if (email !== currentEmail) {
      const existingAuthUser = await findAuthUserByEmail(email);

      if (existingAuthUser && existingAuthUser.id !== claims.sub) {
        reply.status(409);
        return { error: "Another account already uses this email" };
      }
    }

    const profile = await upsertUserProfileForClaims(claims, fullName, email);

    const organizationId = (claims.organization_id as string | undefined) ?? null;

    const existingMetadata = (claims.user_metadata as Record<string, unknown> | undefined) ?? {};

    try {
      await supabaseServiceClient.auth.admin.updateUserById(claims.sub, {
        ...(email !== currentEmail ? { email } : {}),
        user_metadata: {
          ...existingMetadata,
          full_name: fullName,
          ...(organizationId ? { organization_id: organizationId } : {})
        }
      });
    } catch (error) {
      logger.error({ error, userId: claims.sub }, "Failed to update Supabase user metadata");
    }

    return UserProfileSchema.parse(profile);
  });

  fastify.post("/profile/password", async (request, reply) => {
    const claims = request.supabaseClaims;
    if (!claims?.sub) {
      reply.status(401);
      return { error: "Unauthorized" };
    }

    const { currentPassword, newPassword, mfaCode } = UpdatePasswordRequestSchema.parse(
      request.body ?? {}
    );

    const existingProfile = await getUserProfileForClaims(claims);
    const email =
      existingProfile?.email ??
      (typeof claims.email === "string" ? claims.email : undefined);

    if (!email) {
      reply.status(400);
      return { error: "Unable to resolve your email address." };
    }

    const reauth = await supabaseServiceClient.auth.signInWithPassword({
      email,
      password: currentPassword
    });

    const requiresMfaChallenge =
      reauth.error?.status === 400 &&
      typeof reauth.error.message === "string" &&
      /mfa/i.test(reauth.error.message);

    if (reauth.error && !requiresMfaChallenge) {
      reply.status(401);
      return { error: "Current password is incorrect." };
    }

    if (requiresMfaChallenge) {
      if (!mfaCode) {
        reply.status(401);
        return {
          error: "Multi-factor authentication code required.",
          errorCode: "mfa_required"
        };
      }

      const factors = reauth.data?.mfa?.factors ?? [];
      const totpFactor = factors.find((factor) => factor.factor_type === "totp");

      if (!totpFactor) {
        logger.error({ userId: claims.sub }, "Missing TOTP factor for MFA-enabled user");
        reply.status(400);
        return { error: "Multi-factor authentication is misconfigured for this account." };
      }

      const challenge = await supabaseServiceClient.auth.mfa.challenge({
        factorId: totpFactor.id
      });

      if (challenge.error || !challenge.data?.id) {
        logger.error(
          { userId: claims.sub, error: challenge.error },
          "Failed to create MFA challenge during password update"
        );
        reply.status(500);
        return { error: "Unable to verify multi-factor authentication challenge." };
      }

      const verification = await supabaseServiceClient.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.data.id,
        code: mfaCode
      });

      if (verification.error) {
        reply.status(401);
        return { error: "Invalid multi-factor authentication code.", errorCode: "mfa_required" };
      }
    }

    const updateResult = await supabaseServiceClient.auth.admin.updateUserById(claims.sub, {
      password: newPassword
    });

    if (updateResult.error) {
      logger.error(
        { error: updateResult.error, userId: claims.sub },
        "Failed to update password via Supabase admin API"
      );
      reply.status(500);
      return { error: "Unable to update password right now." };
    }

    return UpdatePasswordResponseSchema.parse({
      status: "success",
      message: "Password updated. Use the new password next time you sign in."
    });
  });
};

export default profileRoutes;
