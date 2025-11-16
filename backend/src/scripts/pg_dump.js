const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

// ===== CONFIGURE THIS =====
const connectionString = process.env.DATABASE_URL;
const outputFile = path.resolve("./full_dump.sql"); // output file path
// Optional: custom pg_dump path in .env
// PG_DUMP_PATH="C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe"
// ===========================

// Validate connection string
if (!connectionString) {
  console.error("❌ DATABASE_URL is missing in .env file");
  process.exit(1);
}

console.log("Starting full database export from Neon/PostgreSQL...");

// Detect pg_dump binary
const pgDumpPath = process.env.PG_DUMP_PATH
  ? process.env.PG_DUMP_PATH
  : process.platform === "win32"
  ? "pg_dump.exe"  // Windows
  : "pg_dump";     // macOS/Linux

// Final dump command
const dumpCommand = `${pgDumpPath} "${connectionString}" -F p --no-owner --no-privileges`;

const child = exec(dumpCommand, { maxBuffer: 1024 * 1024 * 200 }); // 200MB buffer

const writeStream = fs.createWriteStream(outputFile);
child.stdout.pipe(writeStream);

child.stderr.on("data", (data) =>
  console.error("pg_dump:", data.toString())
);

child.on("exit", (code) => {
  if (code === 0) {
    console.log(`\n✅ Export complete! File saved at: ${outputFile}\n`);
    console.log("To restore later, run:");
    console.log(
      `  psql "postgresql://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require" -f full_dump.sql\n`
    );
  } else {
    console.error(`\n❌ pg_dump exited with code ${code}`);
  }
});
