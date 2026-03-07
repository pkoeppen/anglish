import type { KyselyConfig, LogEvent } from "kysely";
import type { DB } from "./tables";
import process from "node:process";
import { assertEnv, logger } from "@anglish/core/server";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { initParsers } from "./parsers";
import "colors";

assertEnv([
  "POSTGRES_URL",
]);

export class DatabaseClient {
  public readonly kysely: Kysely<DB>;
  public readonly config: pg.ClientConfig;
  public readonly pool: pg.Pool;

  constructor(config: pg.ClientConfig) {
    this.config = config;
    this.pool = new pg.Pool(config);

    const dialect = new PostgresDialect({ pool: this.pool });
    const kyselyConfig: KyselyConfig = { dialect };

    initParsers();

    this.kysely = new Kysely<DB>(kyselyConfig);
  }

  public async close() {
    await this.kysely.destroy();
  }
}

export const db = new DatabaseClient({
  connectionString: process.env.POSTGRES_URL,
});
