import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { users, userTokens } from "../db/schema.ts";

export class EmailAlreadyExistsError extends Error {
  constructor(message = "Email sudah terdaftar") {
    super(message);
    this.name = "EmailAlreadyExistsError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor(message = "Email atau password salah") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
}

export async function registerUser(input: RegisterUserInput): Promise<void> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email));

  if (existing) {
    throw new EmailAlreadyExistsError();
  }

  const passwordHash = await Bun.password.hash(input.password, {
    algorithm: "bcrypt",
    cost: 10,
  });

  await db.insert(users).values({
    name: input.name,
    email: input.email,
    password: passwordHash,
  });
}

export interface LoginUserInput {
  email: string;
  password: string;
}

export async function loginUser(input: LoginUserInput): Promise<string> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email));

  if (!user) {
    throw new InvalidCredentialsError();
  }

  const passwordOk = await Bun.password.verify(input.password, user.password);
  if (!passwordOk) {
    throw new InvalidCredentialsError();
  }

  const token = crypto.randomUUID();
  await db.insert(userTokens).values({ token, userId: user.id });

  return token;
}
