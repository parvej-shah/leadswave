"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/utils";
import { NAV } from "./nav-items";

export function MobileTabBar({ inboxHotCount }: { inboxHotCount: number }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-sidebar border-t border-border grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
      {NAV.map((item) => {
        const active = item.match(pathname);
        const hasSignal = item.href === "/inbox" && inboxHotCount > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 min-h-[56px] font-mono text-[10px] transition-colors duration-150",
              active ? "text-amber" : "text-fg-4 hover:text-fg-2"
            )}
          >
            <span className="relative">
              <Icon name={item.icon} size={18} />
              {hasSignal && (
                <span className="absolute -top-1 -right-1.5 w-[5px] h-[5px] rounded-full bg-amber ds-pulse" />
              )}
            </span>
            <span className="tracking-[0.02em]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
