import { handle } from "@/lib/api";
import { getBrief } from "@/lib/coach";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const GET = handle(async () => getBrief(await requireUser()));
