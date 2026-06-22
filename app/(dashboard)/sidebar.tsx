"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Avatar, Button, Dialog, Icon, Kbd } from "@/components/ui";
import { cn } from "@/lib/utils";
import { NAV, type NavItem } from "./nav-items";

const STORAGE_KEY = "lw:sidebar-collapsed";

export type SidebarCampaign = {
  id: string;
  name: string;
  status: string;
  hot: number;
};

export type SidebarProps = {
  userEmail: string;
  userName: string;
  campaigns: SidebarCampaign[];
  inboxHotCount: number;
};

// Map of second-key → route for G→x two-key navigation
const G_KEYS: Record<string, string> = { d: "/", c: "/campaigns", l: "/leads", i: "/inbox", s: "/settings" };

export function Sidebar({ userEmail, userName, campaigns, inboxHotCount }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const gPending = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {}
  }, []);

  // Two-key G→D/C/L/I/S global navigation (skip when focus is inside an input/textarea)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (gPending.current) {
        const dest = G_KEYS[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
        gPending.current = false;
        if (gTimer.current) clearTimeout(gTimer.current);
        return;
      }

      if (e.key === "g") {
        e.preventDefault();
        gPending.current = true;
        gTimer.current = setTimeout(() => { gPending.current = false; }, 800);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (gTimer.current) clearTimeout(gTimer.current);
    };
  }, [router]);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut({ callbackUrl: "/login" });
    } finally {
      setSigningOut(false);
    }
  }

  // Avoid hydration mismatch: server renders expanded, client may collapse on mount.
  const c = mounted ? collapsed : false;

  return (
    <aside
      className={cn(
        "shrink-0 bg-sidebar border-r border-border hidden lg:flex flex-col gap-2.5 h-screen sticky top-0 transition-[width] duration-200 ease-out",
        c ? "w-14 px-2 py-3" : "w-56 p-3"
      )}
    >
      <WorkspaceHeader collapsed={c} />

      <SearchTrigger collapsed={c} />

      <nav className="flex flex-col gap-0.5 flex-1 mt-1 min-h-0 overflow-y-auto">
        {!c && <SectionLabel>Workspace</SectionLabel>}
        {NAV.map((item) => {
          const active = item.match(pathname);
          const showSignal = item.href === "/inbox" && inboxHotCount > 0;
          return (
            <NavLink
              key={item.href}
              item={item}
              active={active}
              collapsed={c}
              signalCount={showSignal ? inboxHotCount : 0}
            />
          );
        })}

        {!c && campaigns.length > 0 && (
          <>
            <SectionLabel className="mt-4">Campaigns</SectionLabel>
            {campaigns.map((cmp) => (
              <CampaignRail key={cmp.id} campaign={cmp} />
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-border pt-2.5 relative">
        {!c ? (
          <button
            type="button"
            onClick={() => setSignOutDialogOpen(true)}
            className="w-full flex items-center gap-2 px-1 py-1.5 rounded cursor-pointer hover:bg-[oklch(0.13_0_0)] transition-colors duration-150 group"
            title="Sign out"
          >
            <Avatar name={userName || userEmail} size={22} />
            <div className="flex-1 min-w-0 text-left">
              <p className="font-mono text-[11px] text-fg-2 m-0 leading-tight truncate">
                {userName || userEmail.split("@")[0]}
              </p>
              <p className="font-mono text-[10px] text-fg-5 m-0 leading-tight truncate">
                {userEmail}
              </p>
            </div>
            <Icon name="chevronDown" size={10} className="text-fg-5 group-hover:text-fg-3" />
          </button>
        ) : (
          <div className="flex justify-center py-1">
            <Avatar name={userName || userEmail} size={22} />
          </div>
        )}
        <button
          type="button"
          onClick={toggleCollapse}
          title={c ? "Expand" : "Collapse"}
          className={cn(
            "mt-2 px-2 py-1.5 bg-transparent border-0 text-fg-5 hover:text-fg-3 cursor-pointer font-mono text-[10px] rounded flex items-center gap-1.5 transition-colors duration-150",
            c ? "w-10 mx-auto justify-center" : "w-full justify-start"
          )}
        >
          <Icon name={c ? "arrow" : "x"} size={10} />
          {!c && <span className="tracking-[0.04em]">Collapse</span>}
        </button>
      </div>

      <Dialog
        open={signOutDialogOpen}
        onClose={() => !signingOut && setSignOutDialogOpen(false)}
        title="Sign out"
        dotColor="var(--amber)"
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSignOutDialogOpen(false)} disabled={signingOut}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? "Signing out..." : "Sign out"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[12px] text-fg-2 leading-relaxed m-0">
            You are about to end this session.
          </p>
          <p className="font-mono text-[11px] text-fg-4 leading-relaxed bg-[oklch(0.13_0_0)] p-2.5 rounded border border-border-soft m-0">
            You can sign back in anytime with your account.
          </p>
        </div>
      </Dialog>
    </aside>
  );
}

function WorkspaceHeader({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="flex justify-center pt-1 pb-2 border-b border-border mb-1 overflow-hidden">
        <img
          src="/logo.png"
          alt="LeadsWave"
          width={2508}
          height={627}
          className="h-auto w-[26px] rounded-md"
        />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-md">
      <div className="flex-1 min-w-0 overflow-hidden">
        <img
          src="/logo.png"
          alt="LeadsWave"
          width={2508}
          height={627}
          className="h-auto w-full max-w-[168px]"
        />
      </div>
    </div>
  );
}

function SearchTrigger({ collapsed }: { collapsed: boolean }) {
  function open() {
    window.dispatchEvent(new CustomEvent("lw:open-command"));
  }
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={open}
        title="Search ⌘K"
        className="w-10 h-8 flex items-center justify-center bg-[oklch(0.12_0_0)] border border-border hover:border-[oklch(0.20_0_0)] text-fg-4 hover:text-fg-3 rounded-md transition-colors duration-150 cursor-pointer"
      >
        <Icon name="search" size={13} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[oklch(0.12_0_0)] border border-border hover:border-[oklch(0.20_0_0)] text-fg-4 hover:text-fg-3 cursor-pointer font-mono text-[12px] text-left transition-colors duration-150"
    >
      <Icon name="search" size={12} />
      <span>Search…</span>
      <span className="ml-auto inline-flex gap-0.5">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "font-mono text-[9px] uppercase tracking-[0.12em] text-fg-5 m-0 px-2.5 pt-1 pb-1",
        className
      )}
    >
      {children}
    </p>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  signalCount,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  signalCount: number;
}) {
  const hasSignal = signalCount > 0;
  return (
    <Link
      href={item.href}
      title={collapsed ? `${item.label} (${item.kbd})` : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-[5px] font-mono text-[12.5px] cursor-pointer relative transition-colors duration-150",
        collapsed ? "p-2 justify-center" : "px-2.5 py-1.5",
        active
          ? "bg-amber-tinted-surface text-amber"
          : "text-fg-3 hover:text-fg-2 hover:bg-[oklch(0.13_0_0)]"
      )}
    >
      <Icon name={item.icon} size={13} />
      {!collapsed && <span className="flex-1">{item.label}</span>}
      {!collapsed && hasSignal && (
        <span className="font-mono text-[9px] px-[5px] py-px rounded-[3px] bg-amber-bg text-amber border border-amber-border">
          {signalCount}
        </span>
      )}
      {collapsed && hasSignal && (
        <span className="absolute top-1 right-1 w-[5px] h-[5px] rounded-full bg-amber ds-pulse" />
      )}
    </Link>
  );
}

function CampaignRail({ campaign }: { campaign: SidebarCampaign }) {
  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="flex items-center gap-2 px-2.5 py-[5px] rounded-[5px] hover:bg-[oklch(0.13_0_0)] transition-colors duration-150 w-full"
    >
      <span
        className={cn(
          "w-[5px] h-[5px] rounded-full shrink-0",
          campaign.status === "active" ? "bg-success" : "bg-fg-5"
        )}
        style={
          campaign.status === "active"
            ? { background: "var(--success)" }
            : { background: "var(--fg-5)" }
        }
      />
      <span className="font-mono text-[11.5px] text-fg-4 hover:text-fg-3 flex-1 text-left truncate">
        {campaign.name}
      </span>
      {campaign.hot > 0 && (
        <span className="font-mono text-[9px] text-hot px-1 py-px rounded-[3px] bg-hot-bg border border-hot-border">
          {campaign.hot}
        </span>
      )}
    </Link>
  );
}
