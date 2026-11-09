"use client";
import Link from "next/link";
import { Button } from "@/components/ui";
import { useAction } from "@/components/useAction";

export function ConfirmSkip({ id }: { id: string }) {
  const { call, pending, error, router } = useAction();
  return (
    <div className="flex flex-col gap-2 px-5 pb-9">
      {error && <p className="text-[13px] text-accent-ink">{error}</p>}
      <Button
        disabled={pending}
        onClick={async () => {
          if (await call(`/api/workouts/${id}/skip`, { method: "POST" })) router.push("/today");
        }}
      >
        Terapkan perubahan
      </Button>
      <Link href="/today" className="inline-flex h-12 items-center justify-center rounded-[14px] text-[15px] font-medium hover:bg-chip">
        Batal, aku tetap lari
      </Link>
    </div>
  );
}
