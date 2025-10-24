import Fastify, { type FastifyBaseLogger } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import { env, logger } from "@ma/core";
import healthRoutes from "./routes/health";
import versionRoutes from "./routes/version";
import oidcRoutes from "./routes/oidc";
import adminRoutes from "./routes/admin";
import superAdminRoutes from "./routes/super-admin";
import { jwksRoute, wellKnownJwksRoute } from "./routes/oidc/jwks";
import openIdConfigurationRoute from "./routes/oidc/openid-configuration";
import { supabaseAuthPlugin } from "./plugins/supabase-auth";
import { AuthorizationCodeStore } from "./lib/authorization-code-store";
import { TokenService } from "./lib/token-service";
import { createIdentityQueues } from "./lib/queues";
import portalRoutes from "./routes/portal";
import internalTasksRoutes from "./routes/internal/tasks";
import internalBillingRoutes from "./routes/internal/billing";
import samlRoutes from "./routes/saml";
import { SamlService } from "./lib/saml/service";
import { createPaymentProvider } from "./lib/billing/payment-provider";
import webhookRoutes from "./routes/webhooks";

export const buildServer = () => {
  const server = Fastify({
    logger: (logger as unknown as FastifyBaseLogger),
    trustProxy: env.TRUST_PROXY
  });

  const allowedOrigins = new Set<string>([env.APP_BASE_URL]);
  const additionalOrigins = env.API_CORS_ORIGINS
    ? env.API_CORS_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    : [];

  for (const origin of additionalOrigins) {
    allowedOrigins.add(origin);
  }

  const shouldBypassRateLimit = env.E2E_BYPASS_RATE_LIMIT;
  const rateLimitAllowList = env.IDENTITY_RATE_LIMIT_ALLOW_LIST
    ? env.IDENTITY_RATE_LIMIT_ALLOW_LIST.split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];

  if (!shouldBypassRateLimit) {
    server.register(rateLimit, {
      max: env.IDENTITY_RATE_LIMIT_MAX,
      timeWindow: env.IDENTITY_RATE_LIMIT_TIME_WINDOW,
      allowList: rateLimitAllowList.length > 0 ? rateLimitAllowList : undefined,
      keyGenerator: (request) => {
        const override =
          env.NODE_ENV !== "production" ? request.headers["x-testsuite-ip"] : undefined;
        if (override) {
          return Array.isArray(override) ? override[0] ?? request.ip : override;
        }

        return request.ip;
      },
      errorResponseBuilder: (_request, context) => ({
        error: "rate_limit_exceeded",
        statusCode: context.statusCode,
        max: context.max,
        ttl: context.ttl
      })
    });
  }

  server.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true
  });

  server.register(cookie, {
    hook: "onRequest"
  });
  server.register(formbody);

  const tokenService = new TokenService();
  const authorizationCodes = new AuthorizationCodeStore();
  const queues = createIdentityQueues();
  const samlService = env.IDENTITY_SAML_ENABLED ? new SamlService() : null;
  const paymentProvider = createPaymentProvider();

  server.decorate("tokenService", tokenService);
  server.decorate("authorizationCodes", authorizationCodes);
  server.decorate("queues", queues);
  server.decorate("samlService", samlService);
  server.decorate("paymentProvider", paymentProvider);

  server.register(supabaseAuthPlugin);

  server.register(healthRoutes);
  server.register(versionRoutes);
  server.register(oidcRoutes, { prefix: "/oauth" });
  server.register(jwksRoute, { prefix: "/oauth" });
  server.register(wellKnownJwksRoute, { prefix: "/.well-known" });
  server.register(openIdConfigurationRoute, { prefix: "/.well-known" });
  server.register(adminRoutes, { prefix: "/admin" });
  server.register(superAdminRoutes, { prefix: "/super-admin" });
  server.register(portalRoutes, { prefix: "/portal" });
  server.register(internalTasksRoutes, { prefix: "/internal/tasks" });
  server.register(internalBillingRoutes, { prefix: "/internal/billing" });
  server.register(webhookRoutes, { prefix: "/webhooks" });
  server.register(samlRoutes, { prefix: "/saml" });

  server.addHook("onClose", async () => {
    await queues.close();
  });

  return server;
};
