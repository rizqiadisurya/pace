import { handle } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { syncActivities } from "@/lib/strava";

export const POST = handle(async () => syncActivities(await requireUser()));
