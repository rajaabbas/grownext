import type { SupabaseJwtClaims } from "@ma/core";
import type { AuthorizationCodeStore } from "../lib/authorization-code-store";
import type { TokenService } from "../lib/token-service";

declare module "fastify" {
  interface FastifyInstance {
    tokenService: TokenService;
    authorizationCodes: AuthorizationCodeStore;
  }

  interface FastifyRequest {
    supabaseClaims: SupabaseJwtClaims | null;
  }
}
