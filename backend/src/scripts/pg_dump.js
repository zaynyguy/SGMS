const { spawn } = require("child_process");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

// ===== CONFIG =====
const connectionString = process.env.DATABASE_URL;
const outputFile = path.resolve("./full_dump.dump");

// Optional custom pg_dump path (Windows)
const pgDumpPath =
  process.env.PG_DUMP_PATH ||
  (process.platform === "win32"
    ? "pg_dump.exe"
    : "pg_dump");

// ==================

if (!connectionString) {
  console.error("❌ DATABASE_URL is missing in .env");
  process.exit(1);
}

console.log("📦 Starting safe PostgreSQL export (custom format)...");

const args = [
  connectionString,
  "-F", "c",                 // custom (binary) format
  "--no-owner",
  "--no-privileges",
  "-f", outputFile            // pg_dump writes directly
];

const dump = spawn(pgDumpPath, args, { stdio: "inherit" });

dump.on("close", (code) => {
  if (code === 0) {
    console.log("\n✅ Export complete!");
    console.log(`📁 File: ${outputFile}\n`);
    console.log("Restore with:");
    console.log(
      `pg_restore -d "postgres://USER:PASSWORD@HOST:PORT/DBNAME" \\\n` +
      `  --no-owner --no-privileges ${outputFile}\n`
    );
  } else {
    console.error(`\n❌ pg_dump failed with exit code ${code}`);
    process.exit(code);
  }
});
