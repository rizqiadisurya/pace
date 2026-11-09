import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { authorizeUrl } from "@/lib/strava";

export const GET = handle(async () => {
  await requireUser();
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("strava_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return NextResponse.redirect(authorizeUrl(state));
});
