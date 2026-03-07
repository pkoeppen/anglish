import type { FastifyPluginAsync, FastifyServerOptions } from "fastify";

import corsPlugin from "./plugins/cors";
import sensiblePlugin from "./plugins/sensible";
import searchRoutes from "./routes/search";

const app: FastifyPluginAsync<FastifyServerOptions> = async (
  fastify,
  _opts,
): Promise<void> => {
  await fastify.register(corsPlugin);
  await fastify.register(sensiblePlugin);
  await fastify.register(searchRoutes);
};

export default app;
