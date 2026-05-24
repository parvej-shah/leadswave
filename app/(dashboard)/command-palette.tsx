"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Icon, Kbd, type IconName } from "@/components/ui";
import { cn } from "@/lib/utils";

type Action = {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  kbd?: string;
  group: "Navigate" | "Campaigns" | "Actions" | "Account";
  run: () => void;
};

type Campaign = { id: string; name: string };

type CommandPaletteProps = {
  campaigns: Campaign[];
};

export function CommandPalette({ campaigns }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIdx(0);
  }, []);

  const openPalette = useCallback(() => {
    setOpen(true);
  }, []);

  const actions = useMemo<Action[]>(() => {
    const nav: Action[] = [
      {
        id: "nav-dashboard",
        label: "Go to Dashboard",
        hint: "Overview & KPIs",
        icon: "home",
        kbd: "G D",
        group: "Navigate",
        run: () => router.push("/"),
      },
      {
        id: "nav-campaigns",
        label: "Go to Campaigns",
        hint: "All campaigns & status",
        icon: "target",
        kbd: "G C",
        group: "Navigate",
        run: () => router.push("/campaigns"),
      },
      {
        id: "nav-leads",
        label: "Go to Leads",
        hint: "All leads table",
        icon: "users",
        kbd: "G L",
        group: "Navigate",
        run: () => router.push("/leads"),
      },
      {
        id: "nav-inbox",
        label: "Go to Inbox",
        hint: "Replies & threads",
        icon: "inbox",
        kbd: "G I",
        group: "Navigate",
        run: () => router.push("/inbox"),
      },
      {
        id: "nav-settings",
        label: "Go to Settings",
        hint: "Pipeline & credentials",
        icon: "settings",
        kbd: "G S",
        group: "Navigate",
        run: () => router.push("/settings"),
      },
    ];
    const campaignActions: Action[] = campaigns.map((c) => ({
      id: `campaign-${c.id}`,
      label: c.name,
      hint: "Open campaign",
      icon: "target",
      group: "Campaigns",
      run: () => router.push(`/campaigns/${c.id}`),
    }));
    const ops: Action[] = [
      {
        id: "new-campaign",
        label: "New Campaign",
        hint: "Scout leads with a search query",
        icon: "plus",
        group: "Actions",
        run: () => router.push("/campaigns/new"),
      },
    ];
    const account: Action[] = [
      {
        id: "sign-out",
        label: "Sign out",
        icon: "x",
        group: "Account",
        run: () => signOut({ callbackUrl: "/login" }),
      },
    ];
    return [...nav, ...campaignActions, ...ops, ...account];
  }, [router, campaigns]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => {
      const hay = `${a.label} ${a.hint ?? ""} ${a.group}`.toLowerCase();
      return hay.includes(q);
    });
  }, [actions, query]);

  // Group filtered actions in display order
  const grouped = useMemo(() => {
    const map = new Map<Action["group"], Action[]>();
    for (const a of filtered) {
      const arr = map.get(a.group) ?? [];
      arr.push(a);
      map.set(a.group, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Reset active index when query/list changes
  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Listen for sidebar/search-trigger custom event
  useEffect(() => {
    function onOpen() {
      openPalette();
    }
    window.addEventListener("lw:open-command", onOpen);
    return () => window.removeEventListener("lw:open-command", onOpen);
  }, [openPalette]);

  // Focus input + scroll active into view
  useEffect(() => {
    if (open) {
      // Defer to next tick so the input is mounted
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-cmd-idx="${activeIdx}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  function runAction(a: Action) {
    close();
    // Defer so dialog can unmount cleanly before nav
    setTimeout(() => a.run(), 0);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key.toLowerCase() === "j")) {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const a = filtered[activeIdx];
      if (a) runAction(a);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  if (!open) return null;

  // Build flat-index map for grouped rendering
  let flatIdx = -1;

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4 ds-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] bg-sidebar border border-border rounded-xl ds-scale-up shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
          <Icon name="search" size={14} className="text-fg-4 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent border-0 outline-none font-mono text-[13px] text-fg-1 placeholder:text-fg-5"
          />
          <Kbd>esc</Kbd>
        </div>

        {/* List */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center font-mono text-[12px] text-fg-5">
              No commands match "{query}"
            </div>
          )}
          {grouped.map(([group, items]) => (
            <div key={group}>
              <div className="px-4 pt-2.5 pb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-fg-5">
                {group}
              </div>
              {items.map((a) => {
                flatIdx++;
                const idx = flatIdx;
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={a.id}
                    type="button"
                    data-cmd-idx={idx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => runAction(a)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2 cursor-pointer text-left border-0 transition-colors duration-100",
                      isActive ? "bg-[oklch(0.14_0_0)]" : "bg-transparent"
                    )}
                    style={{
                      borderLeft: isActive
                        ? "2px solid var(--amber)"
                        : "2px solid transparent",
                    }}
                  >
                    <span
                      className={cn(
                        "shrink-0 flex",
                        isActive ? "text-amber" : "text-fg-4"
                      )}
                    >
                      <Icon name={a.icon} size={14} />
                    </span>
                    <span className="flex-1 min-w-0 flex items-baseline gap-2">
                      <span
                        className={cn(
                          "font-mono text-[12.5px] truncate",
                          isActive ? "text-fg-1" : "text-fg-2"
                        )}
                      >
                        {a.label}
                      </span>
                      {a.hint && (
                        <span className="font-mono text-[10.5px] text-fg-5 truncate">
                          {a.hint}
                        </span>
                      )}
                    </span>
                    {a.kbd && (
                      <span className="font-mono text-[10px] text-fg-5 shrink-0">
                        {a.kbd}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-border bg-[oklch(0.105_0_0)] font-mono text-[10px] text-fg-5">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>↵</Kbd>
            select
          </span>
          <span className="inline-flex items-center gap-1 ml-auto">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
            toggle
          </span>
        </div>
      </div>
    </div>
  );
}

