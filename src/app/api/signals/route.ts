import { handle, parseBody } from "@/lib/api";
import { recomputeDaily, todayOf, upsertSignal } from "@/lib/coach";
import { requireUser } from "@/lib/session";
import { signalSchema } from "@/lib/validation";

/** Input cepat pagi hari: jam tidur, HRV, perasaan. Memicu hitung ulang keputusan hari ini. */
export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const b = await parseBody(req, signalSchema);
  const date = todayOf(u);
  await upsertSignal(u.id, date, b);
  const { decision, adjustment } = await recomputeDaily(u, date);
  return { kind: decision.kind, reason: decision.reason, adjustmentStatus: adjustment?.status ?? null };
});
