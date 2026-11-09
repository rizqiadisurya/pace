"use client";
import { WithProfile } from "@/components/Guard";
import { TabBar } from "@/components/TabBar";
import { ProfileView } from "./ProfileView";

export default function ProfilePage() {
  return (
    <WithProfile>
      {(s) => (
        <div className="flex min-h-dvh flex-col">
          <ProfileView profile={s.profile} runs={s.activities.length} />
          <TabBar />
        </div>
      )}
    </WithProfile>
  );
}
