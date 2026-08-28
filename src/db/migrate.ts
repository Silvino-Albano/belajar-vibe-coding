import { migrate } from "drizzle-orm/mysql2/migrator";
import { db, pool } from "./index.ts";

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");
await pool.end();
