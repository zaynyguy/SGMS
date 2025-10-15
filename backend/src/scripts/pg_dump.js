const { exec } =  require("child_process");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });


// ===== CONFIGURE THIS =====
const connectionString = process.env.DATABASE_URL;
const outputFile = path.resolve("./full_dump.sql"); // output file path
// ===========================

console.log("Starting full database export from Neon...");

const dumpCommand = `/usr/lib/postgresql/17/bin/pg_dump "${connectionString}" -F p --no-owner --no-privileges`;

const child = exec(dumpCommand, { maxBuffer: 1024 * 1024 * 200 }); // 200MB buffer

const writeStream = fs.createWriteStream(outputFile);
child.stdout.pipe(writeStream);
child.stderr.on("data", (data) => console.error("pg_dump:", data.toString()));

child.on("exit", (code) => {
  if (code === 0) {
    console.log(`✅ Export complete! File saved at: ${outputFile}`);
    console.log("You can later run:");
    console.log(`  psql "postgresql://USER:PASSWORD@NEW_HOST:PORT/NEW_DB?sslmode=require" -f full_dump.sql`);
  } else {
    console.error(`❌ pg_dump exited with code ${code}`);
  }
});
