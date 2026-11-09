"use client";
import { useEffect } from "react";
import { TabBar } from "@/components/TabBar";
import { WithProfile } from "@/components/Guard";
import { briefFrom, runDailyAgent, todayOf } from "@/lib/store";
import { TodayView } from "./TodayView";

function greetingFor(tz: string) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }).format(new Date()));
  return hour < 11 ? "Pagi" : hour < 15 ? "Siang" : hour < 19 ? "Sore" : "Malam";
}

function AgentRunner({ date }: { date: string }) {
  // Siklus agent harian dijalankan setelah render (bukan saat render).
  useEffect(() => {
    try {
      runDailyAgent();
    } catch {
      /* profil belum ada */
    }
  }, [date]);
  return null;
}

export default function TodayPage() {
  return (
    <WithProfile>
      {(s) => (
        <div className="flex min-h-dvh flex-col">
          <AgentRunner date={todayOf(s.profile)} />
          <TodayView brief={briefFrom(s)} greeting={greetingFor(s.profile.timezone)} />
          <TabBar />
        </div>
      )}
    </WithProfile>
  );
}
