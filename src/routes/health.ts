import { Elysia } from "elysia";
import { sql } from "drizzle-orm";
import { db } from "../db/index.ts";

export const health = new Elysia().get("/health", async ({ set }) => {
  try {
    await db.execute(sql`SELECT 1`);
    return { status: "ok", database: "connected" };
  } catch (error) {
    set.status = 503;
    return {
      status: "degraded",
      database: "disconnected",
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
});
