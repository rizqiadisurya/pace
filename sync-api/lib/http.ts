/** Utilitas HTTP bersama: CORS, otentikasi kata sandi, respons JSON. */

export function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function corsHeaders(req: Request): Record<string, string> {
  const allowed = env("APP_ORIGIN") || "https://rizqiadisurya.github.io";
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": origin === allowed ? origin : allowed,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Pace-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(req) },
  });
}

export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/** Perbandingan waktu-konstan agar kata sandi tidak bisa ditebak lewat timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** null bila lolos; Response 401/500 bila tidak. */
export function requireKey(req: Request): Response | null {
  const expected = env("SYNC_PASSPHRASE");
  if (expected.length < 12) return json(req, { error: "SYNC_PASSPHRASE belum di-set di server (minimal 12 karakter)." }, 500);
  const got = req.headers.get("x-pace-key") ?? "";
  if (!safeEqual(got, expected)) return json(req, { error: "Kata sandi sinkron salah." }, 401);
  return null;
}

export async function readJson<T>(req: Request): Promise<Partial<T>> {
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return {};
  }
}

export const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function addDaysIso(d: string, n: number): string {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
