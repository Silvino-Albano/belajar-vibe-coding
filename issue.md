# Planning: Fitur Login User (POST /api/users/login)

> Dokumen ini adalah panduan implementasi. Ditujukan untuk junior programmer atau AI model yang lebih murah.
> Ikuti tahapan secara berurutan. Jangan menambah fitur di luar yang ditulis di sini.

## 1. Konteks

Project sudah ada: REST API berbasis **Bun + ElysiaJS + Drizzle ORM + MySQL** (TypeScript).
Fitur registrasi user **sudah selesai** (issue sebelumnya). Yang sudah tersedia:

```
src/
  index.ts                     # entry point Elysia + error handler global
  env.ts
  db/
    index.ts                   # koneksi Drizzle + pool mysql2
    schema.ts                  # ada tabel: notes, users
    migrate.ts
  routes/
    health.ts
    notes.ts
    users.routes.ts            # sudah ada: POST /api/users (registrasi)
  services/
    users-services.ts          # sudah ada: registerUser(), EmailAlreadyExistsError
drizzle/                       # migrasi 0000 (notes), 0001 (users)
```

Tabel `users` yang sudah ada:

| Kolom        | Tipe          | Keterangan                        |
| ------------ | ------------- | -------------------------------- |
| `id`         | INTEGER       | PK, auto increment              |
| `name`       | VARCHAR(255)  | NOT NULL                        |
| `email`      | VARCHAR(255)  | NOT NULL, UNIQUE                |
| `password`   | VARCHAR(255)  | NOT NULL, hash bcrypt           |
| `created_at` | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP       |

Tugas issue ini: menambah **tabel token login** dan **endpoint login** yang mengembalikan token.

## 2. Catatan Penamaan Tabel (penting)

Deskripsi asli menulis "buat table users", tetapi tabel `users` sudah ada dan kolom yang diminta
(`token`, `user_id` FK) adalah tabel penyimpanan token sesi login. Karena itu tabel baru ini
diberi nama **`user_tokens`** (bukan `users`). Kalau reviewer minta nama lain, ganti hanya nama tabelnya.

## 3. Hasil Akhir yang Diharapkan

### 3.1 Tabel `user_tokens`

| Kolom        | Tipe          | Keterangan                                                    |
| ------------ | ------------- | ------------------------------------------------------------ |
| `id`         | INTEGER       | primary key, auto increment                                 |
| `token`      | VARCHAR(255)  | NOT NULL, berisi UUID untuk token user yang login (UNIQUE)  |
| `user_id`    | INTEGER       | NOT NULL, foreign key ke `users.id`                         |
| `created_at` | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP                                    |

Catatan:
- `token` dibuat **UNIQUE** supaya pencarian token cepat dan tidak mungkin bentrok.
- `user_id` dibuat **NOT NULL** karena token tanpa pemilik tidak berguna.

### 3.2 Endpoint

`POST /api/users/login`

**Request body:**

```json
{
  "name": "Hamal",
  "email": "hamal@localhost",
  "password": "rahasia"
}
```

- `email` dan `password` wajib.
- `name` boleh dikirim tetapi **diabaikan** oleh server (buat opsional di validasi).

**Response sukses (HTTP 200):**

```json
{
  "data": "b3f1c2a4-5d6e-7f80-91a2-b3c4d5e6f708"
}
```

`data` berisi nilai token UUID yang baru dibuat (bukan literal string `"token"`).

**Response error — email tidak terdaftar ATAU password salah (HTTP 401):**

```json
{
  "error": "Email atau password salah"
}
```

Gunakan **pesan yang sama** untuk kedua kasus (email tidak ada / password salah).
Jangan bocorkan mana yang salah.

**Response error — body tidak valid (HTTP 422):**

```json
{
  "error": "Data tidak valid"
}
```

## 4. Struktur Folder & Penamaan File (WAJIB diikuti)

Di dalam `src/`:

- `src/routes/` → routing ElysiaJS. File: **`users.routes.ts`** (sudah ada, tinggal ditambah route `/login`).
- `src/services/` → logika bisnis. File: **`users-services.ts`** (sudah ada, tinggal ditambah fungsi `loginUser`).

Pembagian tanggung jawab:

- **Route**: definisi path + method, validasi bentuk request, panggil service, bentuk response HTTP.
- **Service**: logika bisnis (cari user, verifikasi password, buat token, simpan token). Tidak tahu soal HTTP.

## 5. Tahapan Implementasi

### Tahap 1 — Tambah tabel `user_tokens` di `src/db/schema.ts`

Tambahkan di bawah definisi tabel `users` (jangan ubah tabel `notes` / `users`):

```ts
export const userTokens = mysqlTable("user_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  userId: int("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserToken = typeof userTokens.$inferSelect;
export type NewUserToken = typeof userTokens.$inferInsert;
```

### Tahap 2 — Generate & jalankan migrasi

```bash
bun run db:generate   # buat file migrasi baru (mis. drizzle/0002_xxx.sql)
bun run db:migrate    # terapkan ke MySQL
```

Verifikasi:

```sql
DESCRIBE user_tokens;
SHOW CREATE TABLE user_tokens;   -- pastikan ada FOREIGN KEY ke users(id) dan UNIQUE(token)
```

### Tahap 3 — Tambah `loginUser` di `src/services/users-services.ts`

Tambahkan (jangan hapus `registerUser` / `EmailAlreadyExistsError` yang sudah ada):

- Class error baru: `InvalidCredentialsError` dengan pesan default `"Email atau password salah"`.
- Fungsi `loginUser(input: { email: string; password: string }): Promise<string>`.

Langkah di dalam `loginUser`:

1. Cari 1 user di tabel `users` berdasarkan `email`.
2. Jika user tidak ada → `throw new InvalidCredentialsError()`.
3. Verifikasi password: `await Bun.password.verify(input.password, user.password)`.
4. Jika hasil `false` → `throw new InvalidCredentialsError()`.
5. Buat token: `const token = crypto.randomUUID();` (tersedia global di Bun).
6. `insert` ke `user_tokens` dengan `{ token, userId: user.id }`.
7. `return token;`

Kerangka:

```ts
import { userTokens } from "../db/schema.ts";

export class InvalidCredentialsError extends Error {
  constructor(message = "Email atau password salah") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
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
```

### Tahap 4 — Tambah route `POST /login` di `src/routes/users.routes.ts`

Instance `userRoutes` sudah punya `prefix: "/api/users"`, jadi cukup rangkai `.post("/login", ...)`
setelah route `POST "/"` yang sudah ada (path final otomatis jadi `POST /api/users/login`).

- Validasi body:
  - `name`: `t.Optional(t.String())` — diabaikan.
  - `email`: string wajib, tidak kosong. **Jangan pakai `format: "email"` yang ketat** supaya email seperti `hamal@localhost` tetap diproses (hasilnya 401 kalau tidak terdaftar, bukan 422).
  - `password`: string wajib, `minLength: 1`.
- Panggil `loginUser({ email, password })`.
- Sukses → `return { data: token }`.
- `InvalidCredentialsError` → set status `401`, `return { error: "Email atau password salah" }`.
- Error lain → `throw` biar ditangani `onError` global.

Kerangka (tambahan pada chain yang sudah ada):

```ts
import { loginUser, InvalidCredentialsError } from "../services/users-services.ts";

// ...userRoutes yang sudah ada...
  .post(
    "/login",
    async ({ body, set }) => {
      try {
        const token = await loginUser(body);
        return { data: token };
      } catch (error) {
        if (error instanceof InvalidCredentialsError) {
          set.status = 401;
          return { error: error.message };
        }
        throw error;
      }
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        email: t.String({ minLength: 1, maxLength: 255 }),
        password: t.String({ minLength: 1, maxLength: 255 }),
      }),
    },
  );
```

### Tahap 5 — Wiring

Tidak perlu mengubah `src/index.ts` — `userRoutes` sudah di-`use` di sana, dan route `/login`
otomatis ikut karena masih di instance yang sama.

### Tahap 6 — Uji manual

Jalankan server: `bun run dev`

```bash
# Persiapan: buat user dulu lewat endpoint registrasi
curl -s -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Hamal","email":"hamal@localhost","password":"rahasia"}'

# 1. Login benar -> HTTP 200, {"data":"<uuid>"}
curl -i -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"name":"Hamal","email":"hamal@localhost","password":"rahasia"}'

# 2. Password salah -> HTTP 401, {"error":"Email atau password salah"}
curl -i -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hamal@localhost","password":"salah"}'

# 3. Email tidak terdaftar -> HTTP 401, {"error":"Email atau password salah"}
curl -i -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tidakada@localhost","password":"rahasia"}'

# 4. Body tidak lengkap -> HTTP 422
curl -i -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hamal@localhost"}'
```

Cek di database: setiap login sukses menambah 1 baris di `user_tokens` dengan `token` UUID dan `user_id` yang benar.

```sql
SELECT id, token, user_id, created_at FROM user_tokens;
```

## 6. Definition of Done (checklist)

- [ ] `src/db/schema.ts` punya tabel `user_tokens` (token UNIQUE NOT NULL, user_id FK NOT NULL ke `users.id`, created_at default now).
- [ ] Migrasi ter-generate di `drizzle/` dan sudah dijalankan; `SHOW CREATE TABLE user_tokens` menunjukkan FK + UNIQUE.
- [ ] `src/services/users-services.ts` punya `loginUser()` + `InvalidCredentialsError`; password diverifikasi dengan `Bun.password.verify`; token dibuat dengan `crypto.randomUUID()`.
- [ ] `src/routes/users.routes.ts` punya route `POST /login` (path final `POST /api/users/login`) dengan validasi body; `name` opsional & diabaikan; `email` tidak divalidasi ketat sebagai format email.
- [ ] Uji manual (4 skenario Tahap 6) menghasilkan response persis seperti spesifikasi.
- [ ] Login sukses menyimpan baris baru di `user_tokens`.
- [ ] `bun run dev` jalan tanpa error, `tsc --noEmit` lolos.

## 7. Batasan / Catatan

- Jangan buat middleware auth, proteksi endpoint lain, logout, atau refresh token di issue ini.
- Jangan kembalikan data user atau password di response — hanya `{ "data": "<token>" }`.
- Pesan error untuk email-tidak-ada dan password-salah harus **sama persis**: `"Email atau password salah"`.
- Ikuti penamaan file persis: `users.routes.ts` dan `users-services.ts` (keduanya sudah ada, tinggal ditambah).
