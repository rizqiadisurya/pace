import { handle, parseBody } from "@/lib/api";
import { deleteUser, updateUser } from "@/lib/coach";
import { clearSession, requireUser } from "@/lib/session";
import { meSchema } from "@/lib/validation";

export const PATCH = handle(async (req: Request) => {
  const u = await requireUser();
  await updateUser(u.id, await parseBody(req, meSchema));
  return { ok: true };
});

/** Hapus profil & seluruh data (sesuai PRD bagian privasi). */
export const DELETE = handle(async () => {
  const u = await requireUser();
  await deleteUser(u.id);
  await clearSession();
  return { ok: true };
});
