"use client";
import Link from "next/link";
import type { Insight } from "@/lib/engine";

const TONE: Record<Insight["tone"], { dot: string; label: string }> = {
  warn: { dot: "bg-accent", label: "Perhatian" },
  good: { dot: "bg-ok", label: "Bagus" },
  info: { dot: "bg-[#6b6f76]", label: "Info" },
};

export function Insights({ items, title = "Langkah berikutnya", limit }: { items: Insight[]; title?: string; limit?: number }) {
  const list = (limit ? items.slice(0, limit) : items).filter((i) => !i.id.startsWith("rpe-"));
  if (!list.length) return null;
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h2 className="text-[13px] font-semibold text-muted">{title}</h2>
      <ul className="flex flex-col gap-2">
        {list.map((i) => (
          <li key={i.id} className="flex gap-3 rounded-[16px] border border-line-soft bg-surface p-3.5">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE[i.tone].dot}`} aria-label={TONE[i.tone].label} role="img" />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[14px] font-semibold leading-snug">{i.title}</span>
              <span className="text-[13px] leading-relaxed text-muted">{i.body}</span>
              {i.action && (
                <Link href={i.action.href} className="-my-2 self-start py-2 text-[13px] font-medium text-accent">
                  {i.action.label}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
