"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Icon, Kbd, type IconName } from "@/components/ui";
import { cn } from "@/lib/utils";

type LeadResult = {
  id: string;
  companyName: string;
  email: string | null;
  state: string;
};

const RECENTS_KEY = "lw:cmd-recents";
const RECENTS_MAX = 5;

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(id: string): void {
  try {
    const prev = loadRecents().filter((r) => r !== id);
    localStorage.setItem(RECENTS_KEY, JSON.stringify([id, ...prev].slice(0, RECENTS_MAX)));
  } catch {}
}

// Subsequence scorer: returns 0 if query chars don't all appear in order, otherwise
// returns a positive score (higher = better). Consecutive matches score higher.
function scoreMatch(target: string, query: string): number {
  const t = target.toLowerCase();
  const q = query.toLowerCase();
  let ti = 0;
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  while (ti < t.length && qi < q.length) {
    if (t[ti] === q[qi]) {
      consecutive++;
      score += consecutive; // reward runs
      qi++;
    } else {
      consecutive = 0;
    }
    ti++;
  }
  return qi === q.length ? score : 0; // 0 = no match
}

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
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [leadResults, setLeadResults] = useState<LeadResult[]>([]);
  const [leadSearching, setLeadSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIdx(0);
  }, []);

  const openPalette = useCallback(() => {
    setRecentIds(loadRecents());
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
        id: "nav-email-accounts",
        label: "Go to Email Accounts",
        hint: "Sender inboxes & warmup",
        icon: "mail",
        kbd: "G E",
        group: "Navigate",
        run: () => router.push("/email-accounts"),
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
    const q = query.trim();
    if (!q) return actions;
    return actions
      .map((a) => {
        const hay = `${a.label} ${a.hint ?? ""} ${a.group}`;
        return { action: a, score: scoreMatch(hay, q) };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ action }) => action);
  }, [actions, query]);

  // Group filtered actions in display order; prepend Recent group when no query
  const grouped = useMemo(() => {
    const q = query.trim();
    if (!q && recentIds.length > 0) {
      const recentActions = recentIds
        .map((id) => actions.find((a) => a.id === id))
        .filter((a): a is Action => !!a);
      const map = new Map<string, Action[]>();
      map.set("Recent", recentActions);
      for (const a of actions) {
        const arr = map.get(a.group) ?? [];
        arr.push(a);
        map.set(a.group, arr);
      }
      return Array.from(map.entries());
    }
    const map = new Map<string, Action[]>();
    for (const a of filtered) {
      const arr = map.get(a.group) ?? [];
      arr.push(a);
      map.set(a.group, arr);
    }
    return Array.from(map.entries());
  }, [filtered, actions, query, recentIds]);

  // Debounced lead search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setLeadResults([]);
      setLeadSearching(false);
      return;
    }
    setLeadSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setLeadResults(data.leads ?? []);
      } catch {
        setLeadResults([]);
      } finally {
        setLeadSearching(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

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
    saveRecent(a.id);
    close();
    // Defer so dialog can unmount cleanly before nav
    setTimeout(() => a.run(), 0);
  }

  // Flat list: lead results first (when query active), then command actions
  const flatItems = useMemo<Array<{ type: "lead"; lead: LeadResult } | { type: "action"; action: Action }>>(() => {
    const q = query.trim();
    const leads = q.length >= 2 ? leadResults.map((l) => ({ type: "lead" as const, lead: l })) : [];
    const cmds = filtered.map((a) => ({ type: "action" as const, action: a }));
    return [...leads, ...cmds];
  }, [leadResults, filtered, query]);

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key.toLowerCase() === "j")) {
      e.preventDefault();
      setActiveIdx((i) => Math.min(flatItems.length - 1, i + 1));
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[activeIdx];
      if (!item) return;
      if (item.type === "lead") {
        close();
        setTimeout(() => router.push(`/leads?highlight=${item.lead.id}`), 0);
      } else {
        runAction(item.action);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  if (!open) return null;

  const q = query.trim();
  // Flat index counter for grouped rendering — must stay in sync with flatItems order
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
          <Icon
            name={leadSearching ? "refresh" : "search"}
            size={14}
            className={cn("shrink-0", leadSearching ? "text-amber animate-spin" : "text-fg-4")}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Type a command or search leads…"
            className="flex-1 bg-transparent border-0 outline-none font-mono text-[13px] text-fg-1 placeholder:text-fg-5"
          />
          <Kbd>esc</Kbd>
        </div>

        {/* List */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-1">
          {flatItems.length === 0 && !leadSearching && (
            <div className="px-4 py-10 text-center font-mono text-[12px] text-fg-5">
              {q ? `No results for "${q}"` : "No commands"}
            </div>
          )}

          {/* Lead results group */}
          {q.length >= 2 && leadResults.length > 0 && (
            <div>
              <div className="px-4 pt-2.5 pb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-fg-5">
                Leads
              </div>
              {leadResults.map((lead) => {
                flatIdx++;
                const idx = flatIdx;
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={lead.id}
                    type="button"
                    data-cmd-idx={idx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => {
                      close();
                      setTimeout(() => router.push(`/leads?highlight=${lead.id}`), 0);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2 cursor-pointer text-left border-0 transition-colors duration-100",
                      isActive ? "bg-[oklch(0.14_0_0)]" : "bg-transparent"
                    )}
                    style={{
                      borderLeft: isActive ? "2px solid var(--amber)" : "2px solid transparent",
                    }}
                  >
                    <span className={cn("shrink-0 flex", isActive ? "text-amber" : "text-fg-4")}>
                      <Icon name="users" size={14} />
                    </span>
                    <span className="flex-1 min-w-0 flex items-baseline gap-2">
                      <span className={cn("font-mono text-[12.5px] truncate", isActive ? "text-fg-1" : "text-fg-2")}>
                        {lead.companyName}
                      </span>
                      <span className="font-mono text-[10.5px] text-fg-5 truncate">
                        {lead.companyName}{lead.email ? ` · ${lead.email}` : ""}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-fg-5 shrink-0">
                      {lead.state.replace(/_/g, " ")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Command groups */}
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

