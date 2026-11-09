import { handle, parseBody } from "@/lib/api";
import { createPlan, createUser } from "@/lib/coach";
import { todayInTz } from "@/lib/engine";
import { setSession, HttpError } from "@/lib/session";
import { onboardingSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  const b = await parseBody(req, onboardingSchema);
  const timezone = b.timezone ?? "Asia/Jakarta";
  const today = todayInTz(timezone);
  if (b.goalType !== "RETURN" && !b.raceDate) throw new HttpError(400, "Tanggal race wajib untuk target race.");
  if (b.raceDate && b.raceDate <= today) throw new HttpError(400, "Tanggal race harus di masa depan.");
  if (!b.availableDays.includes(b.longRunDay)) throw new HttpError(400, "Hari long run harus termasuk hari tersedia.");

  const user = await createUser({
      name: b.name,
      goalType: b.goalType,
      raceDate: b.goalType === "RETURN" ? null : b.raceDate,
      targetPaceSec: b.targetPace ?? null,
      easyPaceSec: b.easyPace,
      baseWeeklyKm: b.baseWeeklyKm,
      weeksOff: b.weeksOff,
      availableDays: [...new Set(b.availableDays)].sort().join(","),
      longRunDay: b.longRunDay,
      autonomy: b.autonomy,
      timezone,
      ...(b.latitude != null && b.longitude != null ? { latitude: b.latitude, longitude: b.longitude } : {}),
  });
  const sessions = await createPlan(user, today);
  await setSession(user.id);
  return { userId: user.id, sessions };
});
