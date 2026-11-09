"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Splash } from "@/components/Guard";
import { usePace } from "@/lib/usePace";

export default function Home() {
  const s = usePace();
  const router = useRouter();
  useEffect(() => {
    if (s) router.replace(s.profile ? "/today" : "/onboarding");
  }, [s, router]);
  return <Splash />;
}
