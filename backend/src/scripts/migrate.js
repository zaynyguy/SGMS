const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const db = require("../db");

const SCHEMA_FILE = path.join(__dirname, "schema.sql");
const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const MIGRATIONS_TABLE = "Migrations";

function listSqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function fileChecksum(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function ensureMigrationsTable(client) {
  await client.query(
    `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      checksum TEXT,
      appliedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  );
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query(
    `SELECT filename FROM "${MIGRATIONS_TABLE}" ORDER BY id`,
  );
  return new Set(rows.map((row) => row.filename));
}

async function insertMigrationRecord(client, filename, checksum = null) {
  await client.query(
    `INSERT INTO "${MIGRATIONS_TABLE}" (filename, checksum) VALUES ($1, $2) ON CONFLICT (filename) DO NOTHING`,
    [filename, checksum],
  );
}

async function countUserTables(client) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND table_name <> $1`,
    [MIGRATIONS_TABLE],
  );
  return rows[0]?.count || 0;
}

async function runSqlFile(client, filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  await client.query(sql);
}

async function run() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  const client = await db.connect();
  try {
    await ensureMigrationsTable(client);

    const applied = await getAppliedMigrations(client);
    const tableCount = await countUserTables(client);

    if (tableCount === 0 && !applied.has("init_schema")) {
      console.log("Empty database detected, applying initial schema...");
      await client.query("BEGIN");
      try {
        await runSqlFile(client, SCHEMA_FILE);
        const checksum = fileChecksum(fs.readFileSync(SCHEMA_FILE, "utf8"));
        await insertMigrationRecord(client, "init_schema", checksum);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
      applied.add("init_schema");
    } else if (tableCount > 0 && applied.size === 0) {
      console.log(
        "Existing database detected without migration history; recording baseline.",
      );
      await client.query("BEGIN");
      try {
        await insertMigrationRecord(client, "baseline", null);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
      applied.add("baseline");
    }

    const migrationFiles = listSqlFiles(MIGRATIONS_DIR);
    for (const fileName of migrationFiles) {
      if (applied.has(fileName)) {
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, fileName);
      const content = fs.readFileSync(filePath, "utf8");
      const checksum = fileChecksum(content);

      console.log(`Applying migration: ${fileName}`);
      await client.query("BEGIN");
      try {
        await client.query(content);
        await insertMigrationRecord(client, fileName, checksum);
        await client.query("COMMIT");
        console.log(`Migration applied: ${fileName}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log("Migrations completed successfully.");
  } finally {
    client.release();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
