import { logger } from "@anglish/core";
import { db } from "../src/client";
import { postgresConfig } from "../src/config";
import { loadSchema, resetDatabase } from "./schema";
import { sortedSqlFiles } from "./schema-order";

async function main() {
  try {
    logger.info("Resetting database...");

    await resetDatabase(postgresConfig);
    await loadSchema(db, sortedSqlFiles);

    logger.info("Database reset complete.");
  } catch (err) {
    logger.error("Database reset failed.");
    throw err;
  } finally {
    await db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
