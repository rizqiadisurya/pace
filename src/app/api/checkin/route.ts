import { handle, parseBody } from "@/lib/api";
import { checkIn } from "@/lib/coach";
import { requireUser } from "@/lib/session";
import { checkInSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const b = await parseBody(req, checkInSchema);
  const { activity, feedback } = await checkIn(u, b);
  return { activityId: activity.id, feedback };
});
