import { env } from "../../lib/http.js";
import { exchangeCode } from "../../lib/strava.js";

/**
 * Tukar kode OAuth → token, lalu kembali ke Pace dengan refresh token di fragmen URL (#),
 * yang tidak pernah dikirim ke server mana pun. Pace menyimpannya di perangkat.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const appUrl = env("APP_URL") || "https://rizqiadisurya.github.io/pace/profile/";
  const back = (frag: Record<string, string>) =>
    new Response(null, { status: 302, headers: { Location: `${appUrl}#${new URLSearchParams(frag)}`, "Set-Cookie": "strava_state=; Path=/api/strava; Max-Age=0" } });

  const cookie = req.headers.get("cookie") ?? "";
  const expected = /(?:^|;\s*)strava_state=([^;]+)/.exec(cookie)?.[1];
  if (!expected || url.searchParams.get("state") !== expected) return back({ strava_error: "state" });
  const code = url.searchParams.get("code");
  if (!code) return back({ strava_error: url.searchParams.get("error") ?? "no_code" });
  if (!(url.searchParams.get("scope") ?? "").includes("activity:read")) return back({ strava_error: "scope" });
  try {
    const t = await exchangeCode(code);
    return back({ strava_refresh: t.refresh_token, strava_athlete: t.athlete?.firstname ?? "" });
  } catch {
    return back({ strava_error: "exchange" });
  }
}
