import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, users, type User } from "@/db";
import { HttpError } from "./errors";

export { HttpError };

/**
 * Identitas sederhana untuk MVP/riset: satu cookie httpOnly berisi user id (satu profil per perangkat).
 * Untuk produksi, ganti dengan auth sungguhan (mis. Auth.js / Clerk) dan tautkan ke users.id.
 */
export const SESSION_COOKIE = "pace_uid";

export async function getCurrentUser(): Promise<User | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw new HttpError(401, "Belum ada profil. Selesaikan onboarding dulu.");
  return u;
}

export async function setSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
