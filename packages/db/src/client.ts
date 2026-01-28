import type { KyselyConfig, LogEvent } from "kysely";
import type { DB } from "./tables";
import process from "node:process";
import { assertEnv, logger } from "@anglish/core";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { initParsers } from "./parsers";
import "colors";

assertEnv([
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DB",
]);

export class DatabaseClient {
  public readonly kysely: Kysely<DB>;
  public readonly config: pg.ClientConfig;
  public readonly pool: pg.Pool;

  constructor(config: pg.ClientConfig) {
    this.config = config;
    this.pool = new pg.Pool(config);

    const dialect = new PostgresDialect({ pool: this.pool });
    const kyselyConfig: KyselyConfig = {
      dialect,
      log: (event: LogEvent) => {
        if (event.level !== "query")
          return;
        const sqlText = event.query.sql.replace(/\s+/g, " ");
        logger.debug(
          `${sqlText}`.gray
          + (event.query.parameters?.length
            ? ` <- `.black + `${JSON.stringify(event.query.parameters)}`.blue
            : ""),
        );
      },
    };

    initParsers();

    this.kysely = new Kysely<DB>(kyselyConfig);
  }

  public async close() {
    await this.kysely.destroy();
  }
}

export const db = new DatabaseClient({
  host: process.env.POSTGRES_HOST,
  port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432"),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});
