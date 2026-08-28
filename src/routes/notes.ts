import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { notes } from "../db/schema.ts";

const noteBody = t.Object({
  title: t.String({ minLength: 1, maxLength: 255 }),
  content: t.String({ minLength: 1 }),
});

const idParams = t.Object({ id: t.Numeric() });

export const noteRoutes = new Elysia({ prefix: "/notes" })
  .get("/", () => db.select().from(notes))

  .get(
    "/:id",
    async ({ params, set }) => {
      const [note] = await db.select().from(notes).where(eq(notes.id, params.id));
      if (!note) {
        set.status = 404;
        return { message: "Note not found" };
      }
      return note;
    },
    { params: idParams },
  )

  .post(
    "/",
    async ({ body, set }) => {
      const [result] = await db.insert(notes).values(body);
      const [note] = await db
        .select()
        .from(notes)
        .where(eq(notes.id, result.insertId));
      set.status = 201;
      return note;
    },
    { body: noteBody },
  )

  .put(
    "/:id",
    async ({ params, body, set }) => {
      const [existing] = await db
        .select()
        .from(notes)
        .where(eq(notes.id, params.id));
      if (!existing) {
        set.status = 404;
        return { message: "Note not found" };
      }
      await db.update(notes).set(body).where(eq(notes.id, params.id));
      const [note] = await db.select().from(notes).where(eq(notes.id, params.id));
      return note;
    },
    { params: idParams, body: noteBody },
  )

  .delete(
    "/:id",
    async ({ params, set }) => {
      const [existing] = await db
        .select()
        .from(notes)
        .where(eq(notes.id, params.id));
      if (!existing) {
        set.status = 404;
        return { message: "Note not found" };
      }
      await db.delete(notes).where(eq(notes.id, params.id));
      return { message: "Note deleted" };
    },
    { params: idParams },
  );
