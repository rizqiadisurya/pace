import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/session";
import { exchangeCode, syncActivities } from "@/lib/strava";

export const GET = handle(async (req: Request) => {
  const u = await requireUser();
  const url = new URL(req.url);
  const jar = await cookies();
  if (!url.searchParams.get("state") || url.searchParams.get("state") !== jar.get("strava_state")?.value)
    throw new HttpError(400, "State OAuth tidak cocok.");
  jar.delete("strava_state");
  const code = url.searchParams.get("code");
  if (!code) throw new HttpError(400, url.searchParams.get("error") ?? "Kode otorisasi tidak ada.");
  await exchangeCode(u, code);
  const fresh = await requireUser();
  await syncActivities(fresh).catch((e) => console.error("Strava sync gagal:", e));
  return NextResponse.redirect(new URL("/today?strava=connected", process.env.APP_URL ?? url.origin));
});
