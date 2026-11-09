import { handle, parseBody } from "@/lib/api";
import { applySwap, listSwapOptions } from "@/lib/coach";
import { requireUser } from "@/lib/session";
import { swapSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const u = await requireUser();
  return { options: (await listSwapOptions(u, (await ctx.params).id)).map(({ key, label, detail }) => ({ key, label, detail })) };
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const u = await requireUser();
  const { key } = await parseBody(req, swapSchema);
  const { adjustmentId } = await applySwap(u, (await ctx.params).id, key);
  return { adjustmentId };
});
