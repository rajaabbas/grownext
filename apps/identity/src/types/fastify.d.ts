import type { SupabaseJwtClaims } from "@ma/core";
import type { AuthorizationCodeStore } from "../lib/authorization-code-store";
import type { TokenService } from "../lib/token-service";
import type { IdentityQueues } from "../lib/queues";
import type { SamlService } from "../lib/saml/service";

declare module "fastify" {
  interface FastifyInstance {
    tokenService: TokenService;
    authorizationCodes: AuthorizationCodeStore;
    queues: IdentityQueues;
    samlService: SamlService | null;
  }

  interface FastifyRequest {
    supabaseClaims: SupabaseJwtClaims | null;
  }
}
