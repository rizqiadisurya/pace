"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCalendar, IconPlus, IconSun, IconUser } from "./icons";

const tabs = [
  { href: "/today", label: "Hari ini", Icon: IconSun },
  { href: "/plan", label: "Rencana", Icon: IconCalendar },
  { href: "/checkin", label: "Catat lari", Icon: IconPlus },
  { href: "/profile", label: "Profil", Icon: IconUser },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav
      aria-label="Navigasi utama"
      className="sticky bottom-0 grid grid-cols-4 border-t border-line bg-surface pb-[max(env(safe-area-inset-bottom),12px)] pt-2"
    >
      {tabs.map(({ href, label, Icon }) => {
        const on = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-11 flex-col items-center justify-center gap-1 text-[11px] ${on ? "font-semibold text-ink" : "font-medium text-[#6b6f76]"}`}
          >
            <Icon size={22} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
