import { WhoAmIResponseSchema } from "@ma/contracts";
import { getMembershipForClaims, getUserProfileForClaims } from "@ma/db";
import type { FastifyPluginAsync } from "fastify";

const whoAmIRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/whoami", async (request) => {
    const claims = request.supabaseClaims;
    const profile = await getUserProfileForClaims(claims);
    const membership = await getMembershipForClaims(claims);

    return WhoAmIResponseSchema.parse({
      userId: claims?.sub ?? null,
      organizationId: (claims?.organization_id as string | undefined) ?? null,
      email: profile?.email ?? claims?.email ?? null,
      fullName: profile?.fullName ?? null,
      role: membership?.role ?? null
    });
  });
};

export default whoAmIRoutes;
