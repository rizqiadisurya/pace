import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { HttpError } from "./errors";

/** Bungkus handler: error → JSON dengan status yang tepat. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown> | unknown) {
  return async (...args: A) => {
    try {
      const out = await fn(...args);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError)
        return NextResponse.json({ error: "Input tidak valid", issues: e.issues }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "Terjadi kesalahan di server." }, { status: 500 });
    }
  };
}

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  const json = await req.json().catch(() => ({}));
  return schema.parse(json);
}
