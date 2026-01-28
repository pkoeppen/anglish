import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { logger } from "@anglish/core";
import { sql } from "kysely";
import { db } from "../src/client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schema = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE migrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created TIMESTAMP DEFAULT NOW(),
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    ctime TIMESTAMP NOT NULL,
    mtime TIMESTAMP NOT NULL,
    sha256 TEXT NOT NULL
);
`;

interface FileMigration {
  name: string;
  path: string;
  size: number;
  ctime: Date;
  mtime: Date;
  sha256: string;
}

interface DbMigration {
  name: string;
  size: number;
  ctime: Date;
  mtime: Date;
  sha256: string;
}

async function getFileMigrations(): Promise<Map<string, FileMigration>> {
  const migrationsDir = path.join(__dirname, "..", "migrations");
  const files = await fs.readdir(migrationsDir);
  const migrations = new Map<string, FileMigration>();

  for (const name of files.sort()) {
    if (!name[0]?.match(/\d/)) {
      continue;
    }

    if (!name.endsWith(".sql") && !name.endsWith(".ts")) {
      continue;
    }

    const filePath = path.join(migrationsDir, name);
    const stats = await fs.stat(filePath);
    const content = await fs.readFile(filePath, "utf-8");
    const sha256 = createHash("sha256").update(content, "utf-8").digest("hex");

    migrations.set(name, {
      name,
      path: filePath,
      size: stats.size,
      ctime: stats.birthtime,
      mtime: stats.mtime,
      sha256,
    });
  }

  return migrations;
}

async function getDbMigrations(): Promise<Map<string, DbMigration>> {
  try {
    const result = await db.pool.query<DbMigration>("SELECT * FROM migrations");
    const migrations = new Map<string, DbMigration>();

    for (const row of result.rows) {
      migrations.set(row.name, {
        name: row.name,
        size: row.size,
        ctime: new Date(row.ctime),
        mtime: new Date(row.mtime),
        sha256: row.sha256,
      });
    }

    return migrations;
  }
  catch (error: any) {
    if (error.code === "42P01") {
      // Table doesn't exist
      logger.info("Creating migration table");
      await db.pool.query(schema);
      return new Map();
    }
    throw error;
  }
}

async function main() {
  const fileMigrations = await getFileMigrations();
  const dbMigrations = await getDbMigrations();

  // Check and remove any already applied migrations
  for (const [name, dbMigration] of dbMigrations.entries()) {
    const fileMigration = fileMigrations.get(name);
    if (!fileMigration) {
      throw new Error(`Deleted migration? ${JSON.stringify(dbMigration)}`);
    }

    if (dbMigration.sha256 !== fileMigration.sha256) {
      throw new Error(
        `Checksum mismatch for ${name}. DB: ${dbMigration.sha256}, File: ${fileMigration.sha256}`,
      );
    }

    fileMigrations.delete(name);
  }

  if (fileMigrations.size === 0) {
    logger.info("No migrations to apply.");
    await db.close();
    return;
  }

  // Apply any leftover migrations
  await db.kysely.transaction().execute(async (tx) => {
    for (const migration of fileMigrations.values()) {
      if (migration.name.endsWith(".sql")) {
        logger.info(`Applying ${migration.name}`);
        const content = await fs.readFile(migration.path, "utf-8");
        await sql.raw(content).execute(tx);
      }
      else if (migration.name.endsWith(".ts")) {
        logger.info(`Applying ${migration.name}`);
        // Dynamic import of the migration module
        const modulePath = `file://${migration.path}`;
        const migrationModule = await import(modulePath);
        if (typeof migrationModule.migrate !== "function") {
          throw new TypeError(`Migration ${migration.name} does not export a migrate function`);
        }
        await migrationModule.migrate(tx);
      }

      await sql`
        INSERT INTO migrations (name, size, ctime, mtime, sha256)
        VALUES (${migration.name}, ${migration.size}, ${migration.ctime}, ${migration.mtime}, ${migration.sha256})
      `.execute(tx);
    }
  });

  logger.info("Migrations applied successfully.");
  await db.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error("Migration failed:", error);
    process.exit(1);
  }).then(() => {
    process.exit(0);
  });
}
