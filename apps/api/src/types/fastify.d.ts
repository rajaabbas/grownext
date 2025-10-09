import type { SupabaseJwtClaims } from "@ma/core";

declare module "fastify" {
  interface FastifyRequest {
    supabaseClaims: SupabaseJwtClaims | null;
  }
}
