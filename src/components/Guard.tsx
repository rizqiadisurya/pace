"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePace } from "@/lib/usePace";
import type { Profile, State } from "@/lib/store";

export function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="font-display text-2xl font-semibold tracking-tight text-muted">Pace</span>
    </div>
  );
}

/** Render children hanya jika profil ada; kalau belum, arahkan ke onboarding. */
export function WithProfile({ children }: { children: (s: State & { profile: Profile }) => React.ReactNode }) {
  const s = usePace();
  const router = useRouter();
  const missing = s !== null && !s.profile;
  useEffect(() => {
    if (missing) router.replace("/onboarding");
  }, [missing, router]);
  if (!s || !s.profile) return <Splash />;
  return <>{children(s as State & { profile: Profile })}</>;
}
