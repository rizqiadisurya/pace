import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { stravaConfigured } from "@/lib/strava";
import { TabBar } from "@/components/TabBar";
import { ProfileView } from "./ProfileView";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ strava?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/onboarding");
  const sp = await searchParams;
  return (
    <div className="flex min-h-dvh flex-col">
      <ProfileView
        name={user.name}
        autonomy={user.autonomy}
        stravaConnected={!!user.stravaAthleteId}
        stravaAvailable={stravaConfigured()}
        justConnected={sp.strava === "connected"}
        location={{ lat: user.latitude, lon: user.longitude }}
      />
      <TabBar />
    </div>
  );
}
