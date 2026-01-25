import type { KyselyConfig, LogEvent } from "kysely";
import type { DB } from "./tables";
import { logger } from "@anglish/core";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { postgresConfig } from "./config";
import "colors";

const PG_COUNT_OID = 20;

pg.types.setTypeParser(PG_COUNT_OID, str => BigInt(str));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, str => Number.parseFloat(str));
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, str => str);

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

    this.kysely = new Kysely<DB>(kyselyConfig);
  }

  public async close() {
    await this.kysely.destroy();
  }
}

export const db = new DatabaseClient(postgresConfig);
