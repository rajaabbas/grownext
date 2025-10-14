import type { FastifyPluginAsync } from "fastify";
import authorizeRoute from "./authorize";
import tokenRoute from "./token";
import userinfoRoute from "./userinfo";

const oidcRoutes: FastifyPluginAsync = async (fastify, opts) => {
  await fastify.register(authorizeRoute);
  await fastify.register(tokenRoute);
  await fastify.register(userinfoRoute);
};

export default oidcRoutes;
