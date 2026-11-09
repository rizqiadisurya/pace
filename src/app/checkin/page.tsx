"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Splash, WithProfile } from "@/components/Guard";
import { TabBar } from "@/components/TabBar";
import { todayOf, weekOf, type State } from "@/lib/store";
import { CheckInForm } from "./CheckInForm";

function Content({ s }: { s: State & { profile: NonNullable<State["profile"]> } }) {
  const workout = useSearchParams().get("workout");
  const today = todayOf(s.profile);
  const w = weekOf(s, today).find((x) => (workout ? x.id === workout : x.date === today));
  return <CheckInForm workoutId={w && w.type !== "REST" ? w.id : null} plannedKm={w && w.distanceKm > 0 ? w.distanceKm : null} />;
}

export default function CheckInPage() {
  return (
    <WithProfile>
      {(s) => (
        <div className="flex min-h-dvh flex-col">
          <Suspense fallback={<Splash />}>
            <Content s={s} />
          </Suspense>
          <TabBar />
        </div>
      )}
    </WithProfile>
  );
}
