import type { IconName } from "@/components/ui";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  kbd: string;
  match: (pathname: string) => boolean;
};

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "home", kbd: "G D", match: (p) => p === "/" },
  { href: "/campaigns", label: "Campaigns", icon: "target", kbd: "G C", match: (p) => p.startsWith("/campaigns") },
  { href: "/leads", label: "Leads", icon: "users", kbd: "G L", match: (p) => p.startsWith("/leads") },
  { href: "/inbox", label: "Inbox", icon: "inbox", kbd: "G I", match: (p) => p.startsWith("/inbox") },
  { href: "/settings", label: "Settings", icon: "settings", kbd: "G S", match: (p) => p.startsWith("/settings") },
];
