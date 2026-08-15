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
  { href: "/email-accounts", label: "Email Accounts", icon: "mail", kbd: "G E", match: (p) => p.startsWith("/email-accounts") },
  { href: "/business-types", label: "Business Types", icon: "layers", kbd: "G T", match: (p) => p.startsWith("/business-types") },
  { href: "/leads", label: "Leads", icon: "users", kbd: "G L", match: (p) => p.startsWith("/leads") },
  { href: "/map", label: "Coverage Map", icon: "map", kbd: "G M", match: (p) => p.startsWith("/map") },
  { href: "/inbox", label: "Inbox", icon: "inbox", kbd: "G I", match: (p) => p.startsWith("/inbox") },
  { href: "/settings", label: "Settings", icon: "settings", kbd: "G S", match: (p) => p.startsWith("/settings") },
];
