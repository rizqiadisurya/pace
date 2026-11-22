"use client";
import { WithProfile } from "@/components/Guard";
import { TabBar } from "@/components/TabBar";
import { dashboardFrom } from "@/lib/store";
import { ProgressView } from "./ProgressView";

export default function ProgressPage() {
  return (
    <WithProfile>
      {(s) => (
        <div className="flex min-h-dvh flex-col">
          <ProgressView d={dashboardFrom(s)} />
          <TabBar />
        </div>
      )}
    </WithProfile>
  );
}
