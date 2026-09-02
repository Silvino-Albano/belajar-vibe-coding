import { Elysia, t } from "elysia";
import {
  registerUser,
  EmailAlreadyExistsError,
} from "../services/users-services.ts";

export const userRoutes = new Elysia({ prefix: "/api/users" }).post(
  "/",
  async ({ body, set }) => {
    try {
      await registerUser(body);
      return { data: "OK" };
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        set.status = 409;
        return { error: error.message };
      }
      throw error;
    }
  },
  {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 255 }),
      email: t.String({ format: "email", maxLength: 255 }),
      password: t.String({ minLength: 6, maxLength: 255 }),
    }),
  },
);
