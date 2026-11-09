import { redirect } from "next/navigation";
import { getWeekOf, todayOf } from "@/lib/coach";
import { getCurrentUser } from "@/lib/session";
import { TabBar } from "@/components/TabBar";
import { CheckInForm } from "./CheckInForm";

export const dynamic = "force-dynamic";

export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ workout?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/onboarding");
  const { workout } = await searchParams;
  const today = todayOf(user);
  const w = (await getWeekOf(user.id, today)).find((x) => (workout ? x.id === workout : x.date === today));
  return (
    <div className="flex min-h-dvh flex-col">
      <CheckInForm workoutId={w && w.type !== "REST" ? w.id : null} plannedKm={w?.distanceKm ?? null} />
      <TabBar />
    </div>
  );
}
