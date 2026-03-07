import process from "node:process";
import Fastify from "fastify";
import app from "./app";

const PORT = 3000;

const fastify = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
});

fastify.register(app);

fastify.listen({ port: PORT }, (err: unknown) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
