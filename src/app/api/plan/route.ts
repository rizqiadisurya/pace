import { handle } from "@/lib/api";
import { getPlan } from "@/lib/coach";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const GET = handle(async () => ({ workouts: await getPlan((await requireUser()).id) }));
