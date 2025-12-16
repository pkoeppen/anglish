import fs from "fs";
import { sql } from "kysely";
import path from "path";
import pg from "pg";
import { logger } from "@anglish/core";
import type { DatabaseClient } from "../src/client";
import type { DB } from "../src/tables";

export async function resetDatabase(config: pg.ClientConfig) {
  const currentDatabase = config.database;
  if (!currentDatabase) throw new Error("No database specified in connection config");

  const pool = new pg.Pool({ ...config, database: "postgres" });
  const quoteIdent = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

  try {
    logger.info(`Resetting database "${currentDatabase}"...`);

    await pool.query(
      `
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1
        AND pid <> pg_backend_pid();
      `,
      [currentDatabase],
    );

    await pool.query(`DROP DATABASE IF EXISTS ${quoteIdent(currentDatabase)};`);
    await pool.query(`CREATE DATABASE ${quoteIdent(currentDatabase)};`);
  } finally {
    await pool.end();
  }
}

export async function loadSchema(db: DatabaseClient, files: readonly string[]) {
  logger.info(`Loading database schema...`);

  await db.kysely.transaction().execute(async (tx) => {
    for (const filename of files) {
      const filePath = path.join(process.cwd(), "sql", filename);
      const content = await fs.promises.readFile(filePath, "utf-8");
      await sql.raw(content).execute(tx);
      logger.info(`Loaded sql/${filename}`);
    }
  });
}

export async function dropTables(db: DatabaseClient, tableNames: (keyof DB)[]) {
  await db.kysely.transaction().execute(async (tx) => {
    for (const tableName of tableNames) {
      await sql`DROP TABLE IF EXISTS ${sql.id(tableName as string)} CASCADE;`.execute(tx);
    }
  });
}

export async function resetTables(db: DatabaseClient, tableNames: (keyof DB)[]) {
  await dropTables(db, tableNames);
  await loadSchema(
    db,
    tableNames.map((name) => `${name.toString().replace(/_/g, "-")}.sql`),
  );
}
