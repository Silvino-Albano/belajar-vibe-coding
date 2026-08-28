import { Elysia } from "elysia";
import { env } from "./env.ts";
import { health } from "./routes/health.ts";
import { noteRoutes } from "./routes/notes.ts";

const app = new Elysia()
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 422;
      return { error: "Validation failed", detail: error.message };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Route not found" };
    }
    set.status = 500;
    return {
      error: "Internal server error",
      detail: error instanceof Error ? error.message : "unknown error",
    };
  })
  .get("/", () => ({ name: "belajar-vibe-coding", status: "running" }))
  .use(health)
  .use(noteRoutes)
  .listen(env.port);

console.log(`Server running at http://localhost:${env.port}`);

export type App = typeof app;
