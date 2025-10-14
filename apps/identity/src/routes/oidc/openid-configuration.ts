import type { FastifyPluginAsync } from "fastify";
import { env } from "@ma/core";

const openIdConfigurationRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/openid-configuration", async () => {
    const issuer = env.IDENTITY_ISSUER;
    return {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      userinfo_endpoint: `${issuer}/oauth/userinfo`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["client_secret_post"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["openid", "profile", "email"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["HS256"]
    };
  });
};

export default openIdConfigurationRoute;
