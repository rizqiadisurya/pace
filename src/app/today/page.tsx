import { redirect } from "next/navigation";
import { getBrief } from "@/lib/coach";
import { getCurrentUser } from "@/lib/session";
import { TabBar } from "@/components/TabBar";
import { TodayView } from "./TodayView";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/onboarding");
  const brief = await getBrief(user);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: user.timezone }).format(new Date()));
  const greeting = hour < 11 ? "Pagi" : hour < 15 ? "Siang" : hour < 19 ? "Sore" : "Malam";
  return (
    <div className="flex min-h-dvh flex-col">
      <TodayView brief={brief} greeting={greeting} />
      <TabBar />
    </div>
  );
}
