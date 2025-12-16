import pg from "pg";
import { logger } from "@anglish/core";
import { db } from "../src/client";
import { postgresConfig } from "../src/config";
import { loadSchema, resetDatabase } from "./schema";
import { sortedSqlFiles } from "./schema-order";

async function schemaExists(config: pg.ClientConfig) {
  const pool = new pg.Pool(config);
  try {
    const res = await pool.query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
         LIMIT 1
       ) AS exists;`,
    );
    return Boolean(res.rows[0]?.exists);
  } finally {
    await pool.end();
  }
}

export async function bootstrapDatabase() {
  logger.info("Bootstrapping database...");

  await resetDatabase(postgresConfig);
  await loadSchema(db, sortedSqlFiles);

  logger.info("Database bootstrapped successfully.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const exists = await schemaExists(postgresConfig);
  if (!exists) {
    await bootstrapDatabase();
  }
  await db.close();
}
