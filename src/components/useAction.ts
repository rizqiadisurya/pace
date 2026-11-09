"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Panggil API lalu refresh server component. */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  async function call<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T | null> {
    setError(null);
    const res = await fetch(url, {
      method: init?.method ?? (init?.json !== undefined ? "POST" : "GET"),
      headers: init?.json !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Gagal, coba lagi.");
      return null;
    }
    startTransition(() => router.refresh());
    return data as T;
  }
  return { call, pending, error, router };
}
