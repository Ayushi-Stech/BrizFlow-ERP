import { readFileSync } from "node:fs";
import { join } from "node:path";

import { pool } from "../db";

async function main() {
  const sql = readFileSync(join(__dirname, "../../db/schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Schema applied successfully.");
  await pool.end();
}

main().catch((err) => {
  console.error("Failed to apply schema:", err);
  process.exit(1);
});
