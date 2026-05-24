"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/leads", label: "Leads" },
  { href: "/inbox", label: "Inbox" },
  { href: "/settings", label: "Settings" },
];

export default function SidebarNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex flex-col gap-1 text-sm flex-1">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className="px-2 py-1.5 rounded transition-colors"
          style={{
            color: isActive(href) ? "oklch(0.78 0.18 65)" : "oklch(0.60 0 0)",
            background: isActive(href) ? "oklch(0.18 0.04 65 / 40%)" : "transparent",
            fontFamily: "'DM Mono', monospace",
            fontSize: "0.8125rem",
          }}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
