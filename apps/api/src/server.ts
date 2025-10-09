import Fastify, { type FastifyBaseLogger } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env, logger } from "@ma/core";
import healthRoutes from "./routes/health";
import versionRoutes from "./routes/version";
import whoAmIRoutes from "./routes/whoami";
import debugRoutes from "./routes/debug";
import authRoutes from "./routes/auth";
import organizationRoutes from "./routes/organization";
import profileRoutes from "./routes/profile";
import { supabaseAuthPlugin } from "./plugins/supabase-auth";

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

  if (!shouldBypassRateLimit) {
    server.register(rateLimit, {
      max: 200,
      timeWindow: "1 minute",
      keyGenerator: (request) => {
        const override =
          env.NODE_ENV !== "production" ? request.headers["x-testsuite-ip"] : undefined;
        if (override) {
          return Array.isArray(override) ? override[0] ?? request.ip : override;
        }

        return request.ip;
      }
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

  server.register(supabaseAuthPlugin);

  server.register(healthRoutes);
  server.register(versionRoutes);
  server.register(whoAmIRoutes);
  server.register(authRoutes);
  server.register(profileRoutes);
  server.register(organizationRoutes);
  server.register(debugRoutes);

  return server;
};
