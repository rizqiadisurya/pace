import { handle, parseBody } from "@/lib/api";
import { resolveAdjustment } from "@/lib/coach";
import { requireUser } from "@/lib/session";
import { adjustmentActionSchema } from "@/lib/validation";

/** accept / dismiss usulan agent, atau undo perubahan yang sudah diterapkan. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  const { id } = await ctx.params;
  const { action } = await parseBody(req, adjustmentActionSchema);
  await resolveAdjustment(u, id, action);
  return { ok: true };
});
