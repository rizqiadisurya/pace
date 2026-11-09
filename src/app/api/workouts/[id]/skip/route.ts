import { handle } from "@/lib/api";
import { applySkip, previewSkip } from "@/lib/coach";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** Pratinjau minggu setelah skip (belum disimpan). */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const u = await requireUser();
  const { week, notes, before } = await previewSkip(u, (await ctx.params).id);
  return { before, week, notes };
});

/** Terapkan skip. */
export const POST = handle(async (_req: Request, ctx: Ctx) => {
  const u = await requireUser();
  const { week, notes, adjustmentId } = await applySkip(u, (await ctx.params).id);
  return { week, notes, adjustmentId };
});
