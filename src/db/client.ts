import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

/**
 * - DATABASE_URL di-set (Vercel + Neon, Supabase, RDS, …) → Postgres sungguhan via postgres.js.
 *   Migrasi dijalankan saat build (scripts/migrate.mjs).
 * - Tidak di-set (laptop, test) → PGlite: Postgres di dalam Node, data di ./data/pglite.
 *   Migrasi dijalankan otomatis saat koneksi pertama.
 */
async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    // prepare:false agar kompatibel dengan connection pooler (Neon pooled / PgBouncer)
    const client = postgres(url, { prepare: false, max: 5 });
    return drizzle(client, { schema });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzleLite } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.PGLITE_DIR ?? "./data/pglite";
  const target = dir.startsWith("memory://") ? dir : path.resolve(dir);
  if (!dir.startsWith("memory://")) fs.mkdirSync(target, { recursive: true });
  const db = drizzleLite(new PGlite(target), { schema });
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  // API query builder identik; cast agar seluruh app memakai satu tipe.
  return db as unknown as DB;
}

const g = globalThis as unknown as { __paceDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  g.__paceDb ??= create();
  return g.__paceDb;
}
