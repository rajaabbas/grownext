import { extractBearerToken, buildServiceRoleClaims, type SupabaseJwtClaims } from "@ma/core";
import { supabaseServiceClient, withAuthorizationTransaction } from "@ma/db";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const authCookiePattern = /sb[-_].*[-_]auth[-_]token/;

// Define plugin and wrap with fastify-plugin to expose hook/decorators to sibling plugins
const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request) => {
    const resolveCookieToken = (): string | null => {
      const cookieHeader = request.headers["cookie"];
      if (typeof cookieHeader !== "string" || cookieHeader.length === 0) {
        return null;
      }

      try {
        const pairs = cookieHeader.split(/;\s*/);
        const map: Record<string, string> = {};

        for (const pair of pairs) {
          const idx = pair.indexOf("=");
          if (idx === -1) continue;
          const key = pair.slice(0, idx).trim();
          const value = pair.slice(idx + 1).trim();
          map[key] = value;
        }

        const tokenKey = Object.keys(map).find((key) => authCookiePattern.test(key));
        if (!tokenKey) {
          return null;
        }

        const raw = decodeURIComponent(map[tokenKey]);
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && typeof arr[0] === "string") {
            return arr[0] as string;
          }
        } catch {
          if (typeof raw === "string" && raw.length > 0) {
            return raw;
          }
        }
      } catch {
        return null;
      }
      return null;
    };

    const bearerToken = extractBearerToken(request.headers.authorization);
    const cookieToken = bearerToken ? null : resolveCookieToken();
    const token = bearerToken ?? cookieToken;

    if (!token) {
      request.supabaseClaims = null;
      return;
    }

    try {
      const { data, error } = await supabaseServiceClient.auth.getUser(token);

      if (error || !data.user) {
        request.supabaseClaims = null;
        return;
      }

      const user = data.user;
      let organizationId =
        (user.app_metadata?.organization_id as string | undefined) ??
        (user.user_metadata?.organization_id as string | undefined);

      if (!organizationId) {
        try {
          const membership = await withAuthorizationTransaction(
            buildServiceRoleClaims(undefined),
            (tx) =>
              tx.organizationMember.findFirst({
                where: { userId: user.id },
                orderBy: { createdAt: "asc" }
              })
          );
          organizationId = membership?.organizationId ?? undefined;
        } catch (membershipError) {
          fastify.log.error(
            { error: membershipError, userId: user.id },
            "Failed to resolve organization membership for user"
          );
        }
      }

      const claims: SupabaseJwtClaims = {
        sub: user.id,
        email: user.email ?? undefined,
        role: "authenticated",
        ...(organizationId ? { organization_id: organizationId } : {}),
        app_metadata: user.app_metadata ?? {},
        user_metadata: user.user_metadata ?? {}
      };

      request.supabaseClaims = claims;
    } catch (error) {
      fastify.log.error({ error }, "Failed to verify Supabase access token");
      request.supabaseClaims = null;
    }
  });
};

export const supabaseAuthPlugin = fp(plugin);
