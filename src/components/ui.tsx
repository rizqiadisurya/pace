import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "onDark" | "ghost";
const styles: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover disabled:opacity-50",
  outline: "bg-surface text-ink border border-line hover:bg-chip",
  onDark: "bg-transparent text-white border border-dark-line hover:bg-dark-2",
  ghost: "bg-transparent text-ink hover:bg-chip",
};

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...p}
      className={`inline-flex h-12 items-center justify-center rounded-[14px] px-5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    />
  );
}

export function Chip({ children, tone = "warn" }: { children: React.ReactNode; tone?: "warn" | "ok" | "neutral" }) {
  const t = tone === "warn" ? "bg-accent-soft text-accent-ink" : tone === "ok" ? "bg-ok-soft text-ok-ink" : "bg-chip text-muted";
  return <span className={`inline-flex rounded-lg px-2 py-1 text-xs font-medium ${t}`}>{children}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[20px] border border-line-soft bg-surface p-4 ${className}`}>{children}</div>;
}
