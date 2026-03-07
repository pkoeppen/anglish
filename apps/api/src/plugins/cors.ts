import type { FastifyCorsOptions } from "@fastify/cors";
import cors from "@fastify/cors";
import fp from "fastify-plugin";

export default fp<FastifyCorsOptions>(async (fastify) => {
  fastify.register(cors, { origin: true });
});
