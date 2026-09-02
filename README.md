# belajar-vibe-coding

REST API dengan **Bun + ElysiaJS + Drizzle ORM + MySQL**.

## Prasyarat

- [Bun](https://bun.sh) v1.4+
- MySQL / MariaDB yang berjalan (mis. XAMPP)

## Setup

```bash
# 1. Salin env dan sesuaikan kredensial database
cp .env.example .env

# 2. Install dependency
bun install

# 3. Buat database (sekali saja)
#    mis. via mysql client:  CREATE DATABASE belajar_vibe_coding;

# 4. Jalankan migrasi
bun run db:generate   # buat file migrasi dari schema (bila schema berubah)
bun run db:migrate    # terapkan migrasi ke database
```

## Menjalankan

```bash
bun run dev     # mode watch (development)
bun run start   # mode biasa
```

Server jalan di `http://localhost:3000` (port dari `.env`).

## Konfigurasi (`.env`)

| Variabel      | Keterangan              | Default               |
| ------------- | ----------------------- | --------------------- |
| `PORT`        | Port HTTP server        | `3000`                |
| `DB_HOST`     | Host MySQL              | `127.0.0.1`           |
| `DB_PORT`     | Port MySQL              | `3306`                |
| `DB_USER`     | User MySQL              | `root`                |
| `DB_PASSWORD` | Password MySQL          | _(kosong)_            |
| `DB_NAME`     | Nama database           | `belajar_vibe_coding` |

## Endpoint

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/` | Info service |
| GET | `/health` | Status server + konektivitas DB |
| GET | `/notes` | List semua note |
| GET | `/notes/:id` | Detail note |
| POST | `/notes` | Buat note — body `{ title, content }` |
| PUT | `/notes/:id` | Update note — body `{ title, content }` |
| DELETE | `/notes/:id` | Hapus note |
| POST | `/api/users` | Registrasi user baru — body `{ name, email, password }` |

### Registrasi user

`POST /api/users`

```json
{ "name": "Hamal", "email": "hamal@example.com", "password": "rahasia" }
```

- Sukses → `200` `{ "data": "OK" }`
- Email sudah dipakai → `409` `{ "error": "Email sudah terdaftar" }`
- Body tidak valid → `422` `{ "error": "Data tidak valid" }`

Password disimpan sebagai hash bcrypt, tidak pernah dikembalikan di response.

Contoh:

```bash
curl -X POST http://localhost:3000/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Catatan","content":"Isi catatan"}'
```

## Script

| Script             | Fungsi                                    |
| ------------------ | ----------------------------------------- |
| `bun run dev`      | Jalankan server mode watch                |
| `bun run start`    | Jalankan server                           |
| `bun run db:generate` | Generate file migrasi dari schema      |
| `bun run db:migrate`  | Terapkan migrasi ke database           |
| `bun run db:push`     | Sinkronkan schema langsung ke DB (dev) |
| `bun run db:studio`   | Buka Drizzle Studio                    |

## Struktur

```
src/
  index.ts          # entry point Elysia + error handler
  env.ts            # baca & validasi environment
  db/
    index.ts        # koneksi Drizzle + pool MySQL
    schema.ts       # definisi tabel
    migrate.ts      # runner migrasi
  routes/
    health.ts       # GET /health
    notes.ts        # CRUD /notes
    users.routes.ts # POST /api/users (registrasi)
  services/
    users-services.ts # logika bisnis registrasi user
drizzle/            # file migrasi hasil generate
```
