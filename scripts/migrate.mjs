// Migrasi Postgres produksi. Dijalankan otomatis oleh `npm run build` bila DATABASE_URL ada.
// Lokal (tanpa DATABASE_URL) tidak perlu: PGlite bermigrasi sendiri saat app start.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL tidak di-set, lewati (mode PGlite lokal).");
  process.exit(0);
}
const client = postgres(url, { max: 1, prepare: false });
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
await client.end();
console.log("[migrate] Migrasi selesai.");
