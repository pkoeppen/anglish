import type { FastifyPluginAsync, FastifyServerOptions } from "fastify";

import corsPlugin from "./plugins/cors";
import sensiblePlugin from "./plugins/sensible";
import lemmaRoutes from "./routes/lemmas";
import senseRoutes from "./routes/senses";
import searchRoutes from "./routes/search";
import translateRoutes from "./routes/translate";

const app: FastifyPluginAsync<FastifyServerOptions> = async (
  fastify,
  _opts,
): Promise<void> => {
  await fastify.register(corsPlugin);
  await fastify.register(sensiblePlugin);
  await fastify.register(searchRoutes);
  await fastify.register(translateRoutes);
  await fastify.register(lemmaRoutes);
  await fastify.register(senseRoutes);
};

export default app;
