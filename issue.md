# Planning: Fitur Registrasi User Baru

> Dokumen ini adalah panduan implementasi. Ditujukan untuk junior programmer atau AI model yang lebih murah.
> Ikuti tahapan secara berurutan. Jangan menambah fitur di luar yang ditulis di sini.

## 1. Konteks

Project sudah ada: REST API berbasis **Bun + ElysiaJS + Drizzle ORM + MySQL** (TypeScript).
Struktur saat ini:

```
src/
  index.ts          # entry point Elysia
  env.ts            # baca & validasi environment
  db/
    index.ts        # koneksi Drizzle + pool mysql2
    schema.ts       # definisi tabel
    migrate.ts      # runner migrasi
  routes/
    health.ts
    notes.ts
drizzle/            # file migrasi hasil generate
```

Tugas: menambah **tabel `users`** dan **API registrasi user baru**.

## 2. Hasil Akhir yang Diharapkan

### 2.1 Tabel `users`

| Kolom        | Tipe          | Keterangan                                    |
| ------------ | ------------- | --------------------------------------------- |
| `id`         | INTEGER       | primary key, auto increment                   |
| `name`       | VARCHAR(255)  | NOT NULL                                      |
| `email`      | VARCHAR(255)  | NOT NULL (disarankan UNIQUE, lihat tahap 4)   |
| `password`   | VARCHAR(255)  | NOT NULL, berisi hash bcrypt (bukan plaintext)|
| `created_at` | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP                      |

### 2.2 Endpoint

`POST /api/users`

**Request body:**

```json
{
  "name": "Hamal",
  "email": "itsilvinoalbano@gmail.com",
  "password": "rahasia"
}
```

**Response sukses (HTTP 200):**

```json
{
  "data": "OK"
}
```

**Response error — email sudah terdaftar (HTTP 409):**

```json
{
  "error": "Email sudah terdaftar"
}
```

**Response error — validasi gagal (HTTP 422):**

```json
{
  "error": "Data tidak valid"
}
```

## 3. Struktur Folder & Penamaan File (WAJIB diikuti)

Di dalam `src/`:

- `src/routes/` → berisi routing ElysiaJS. Format nama file: `users.routes.ts`
- `src/services/` → berisi logika bisnis aplikasi. Format nama file: `users-services.ts`

Aturan pembagian tanggung jawab:

- **Route** hanya: mendefinisikan path + method, memvalidasi bentuk request, memanggil service, membentuk response HTTP.
- **Service** hanya: logika bisnis (cek email duplikat, hash password, simpan ke database). Tidak tahu soal HTTP.

## 4. Tahapan Implementasi

### Tahap 1 — Siapkan dependency hashing password

Gunakan API bawaan Bun untuk bcrypt (tidak perlu install library):

```ts
// hash
const hash = await Bun.password.hash(plain, { algorithm: "bcrypt", cost: 10 });
// verifikasi (dipakai nanti saat login, tidak wajib di fitur ini)
const ok = await Bun.password.verify(plain, hash);
```

Jika diminta memakai library eksternal, gunakan `bcryptjs` dan sesuaikan pemanggilannya. Default: pakai `Bun.password`.

### Tahap 2 — Tambah definisi tabel `users` di Drizzle

Edit `src/db/schema.ts`, tambahkan tabel baru (jangan hapus tabel `notes` yang sudah ada):

```ts
import { mysqlTable, int, varchar, timestamp } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(), // unique: mencegah email ganda
  password: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

Catatan: `.unique()` ditambahkan supaya database ikut menjaga keunikan email. Logika aplikasi tetap melakukan pengecekan manual (tahap 5) agar pesan error rapi.

### Tahap 3 — Generate & jalankan migrasi

```bash
bun run db:generate   # membuat file SQL migrasi baru di folder drizzle/
bun run db:migrate    # menerapkan migrasi ke database MySQL
```

Verifikasi tabel terbentuk:

```bash
# lewat mysql client
SHOW TABLES;
DESCRIBE users;
```

### Tahap 4 — Buat service `src/services/users-services.ts`

Isi minimal:

- Fungsi `registerUser(input: { name: string; email: string; password: string })`.
- Langkah di dalamnya:
  1. Cari user berdasarkan `email` di tabel `users`.
  2. Jika sudah ada → lempar error khusus (mis. `throw new EmailAlreadyExistsError()` atau `throw new Error("EMAIL_TAKEN")`).
  3. Hash `password` dengan bcrypt (lihat Tahap 1).
  4. `insert` row baru ke tabel `users` dengan password hasil hash.
  5. Return `void` atau data seadanya (route hanya butuh tahu berhasil/tidak).

Kerangka:

```ts
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { users } from "../db/schema.ts";

export class EmailAlreadyExistsError extends Error {}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email));

  if (existing) {
    throw new EmailAlreadyExistsError("Email sudah terdaftar");
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
```

### Tahap 5 — Buat route `src/routes/users.routes.ts`

- Buat instance Elysia dengan prefix `/api/users`.
- Definisikan `POST /` (sehingga path final = `POST /api/users`).
- Validasi body pakai `t.Object` milik Elysia:
  - `name`: string, minLength 1, maxLength 255
  - `email`: string, format email, maxLength 255
  - `password`: string, minLength 6, maxLength 255
- Panggil `registerUser(body)`.
- Jika sukses → `return { data: "OK" }` (status default 200).
- Jika `EmailAlreadyExistsError` → set status 409, `return { error: "Email sudah terdaftar" }`.

Kerangka:

```ts
import { Elysia, t } from "elysia";
import { registerUser, EmailAlreadyExistsError } from "../services/users-services.ts";

export const userRoutes = new Elysia({ prefix: "/api/users" }).post(
  "/",
  async ({ body, set }) => {
    try {
      await registerUser(body);
      return { data: "OK" };
    } catch (err) {
      if (err instanceof EmailAlreadyExistsError) {
        set.status = 409;
        return { error: "Email sudah terdaftar" };
      }
      throw err; // biar ditangani error handler global di index.ts
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
```

### Tahap 6 — Daftarkan route di `src/index.ts`

- Import `userRoutes` dari `./routes/users.routes.ts`.
- Tambahkan `.use(userRoutes)` pada rangkaian `new Elysia()...` (sejajar dengan `.use(health)` dan `.use(noteRoutes)`).
- Pastikan error handler global (`onError`) sudah mengembalikan bentuk `{ error: ... }` untuk kasus `VALIDATION` (status 422). Jika belum sesuai, samakan pesannya menjadi `"Data tidak valid"`.

### Tahap 7 — Uji manual

Jalankan server: `bun run dev`

```bash
# 1. Registrasi sukses -> {"data":"OK"}
curl -i -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Hamal","email":"itsilvinoalbano@gmail.com","password":"rahasia"}'

# 2. Email sama diulang -> HTTP 409 {"error":"Email sudah terdaftar"}
curl -i -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Hamal","email":"itsilvinoalbano@gmail.com","password":"rahasia"}'

# 3. Body tidak lengkap -> HTTP 422
curl -i -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com"}'
```

Cek di database bahwa kolom `password` berisi hash (diawali `$2b$` atau `$2a$`), bukan `rahasia`.

## 5. Definition of Done (checklist)

- [ ] `src/db/schema.ts` punya tabel `users` sesuai spesifikasi.
- [ ] Migrasi ter-generate di `drizzle/` dan sudah dijalankan; `DESCRIBE users` sesuai.
- [ ] File `src/services/users-services.ts` berisi fungsi `registerUser` + pengecekan email duplikat + hashing bcrypt.
- [ ] File `src/routes/users.routes.ts` mendefinisikan `POST /api/users` dengan validasi body.
- [ ] Route sudah di-`use` di `src/index.ts`.
- [ ] Uji manual (3 skenario di Tahap 7) menghasilkan response persis seperti spesifikasi.
- [ ] Password tersimpan sebagai hash bcrypt, tidak pernah dikembalikan di response.
- [ ] `bun run dev` jalan tanpa error, `tsc --noEmit` lolos.

## 6. Batasan / Catatan

- Jangan buat endpoint login, update, atau delete user di issue ini.
- Jangan kembalikan data user (apalagi password) di response sukses — cukup `{ "data": "OK" }`.
- Jangan menyimpan password dalam bentuk plaintext dalam kondisi apa pun.
- Ikuti penamaan file persis: `users.routes.ts` dan `users-services.ts`.
