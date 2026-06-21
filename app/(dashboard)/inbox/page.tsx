"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Avatar,
  Badge,
  Button,
  DirectionTag,
  Icon,
  Kbd,
  Segmented,
  Toast,
} from "@/components/ui";
import { RichTextEditor } from "@/components/rich-text-editor";
import { RichTextViewer } from "@/components/rich-text-viewer";
import { plainToHtml } from "@/lib/html/plain";

type Message = {
  id: string;
  direction: "outbound" | "inbound" | "system";
  subject: string | null;
  body: string | null;
  bodyHtml?: string | null;
  sentAt: string;
};

type InboxLead = {
  id: string;
  companyName: string;
  email: string | null;
  state: string;
  lastTouchedAt: string | null;
  campaign: { name: string };
  messages: Message[];
};

const HOT_STATES = new Set(["converted", "meeting_booked"]);

function classifyLead(lead: InboxLead): "hot" | "warm" {
  return HOT_STATES.has(lead.state) ? "hot" : "warm";
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function timeBucket(iso: string): "Today" | "Yesterday" | "This Week" | "Older" {
  const diff = Date.now() - new Date(iso).getTime();
  const h = diff / 3_600_000;
  if (h < 24) return "Today";
  if (h < 48) return "Yesterday";
  if (h < 24 * 7) return "This Week";
  return "Older";
}

function snippet(lead: InboxLead): string {
  const last = [...lead.messages].reverse().find((m) => m.direction === "inbound");
  return last?.body?.slice(0, 90).replace(/\n/g, " ") ?? "";
}

type Filter = "all" | "hot" | "warm";

export default function InboxPage() {
  const [leads, setLeads] = useState<InboxLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InboxLead | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftHtml, setDraftHtml] = useState("");
  const [aiDraftOriginal, setAiDraftOriginal] = useState("");
  const [sending, setSending] = useState(false);
  const [sentToast, setSentToast] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [suppressed, setSuppressed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");

  const fetchLeads = useCallback(() => {
    setLoading(true);
    fetch("/api/inbox")
      .then((r) => r.json())
      .then((data: InboxLead[]) => {
        setLeads(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const selectLead = useCallback((lead: InboxLead) => {
    setSelected(lead);
    setSendError(null);
    const draft = lead.messages.find((m) => m.direction === "system");
    const text = draft?.body ?? "";
    setDraftText(text);
    setDraftHtml(plainToHtml(text));
    setAiDraftOriginal(text);
  }, []);

  async function handleSendReply() {
    if (!selected || !draftText.trim()) return;
    setSending(true);
    setSendError(null);
    const res = await fetch("/api/inbox/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: selected.id, body: draftText, bodyHtml: draftHtml }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json();
      setSendError(data.error ?? "Failed to send");
      return;
    }
    const newMsg: Message = {
      id: crypto.randomUUID(),
      direction: "outbound",
      subject: null,
      body: draftText,
      bodyHtml: draftHtml || null,
      sentAt: new Date().toISOString(),
    };
    const updated: InboxLead = {
      ...selected,
      state: "converted",
      messages: [...selected.messages.filter((m) => m.direction !== "system"), newMsg],
    };
    setLeads((prev) => prev.map((l) => (l.id === selected.id ? updated : l)));
    setSelected(updated);
    setDraftText("");
    setDraftHtml("");
    setAiDraftOriginal("");
    setSentToast(true);
    setTimeout(() => setSentToast(false), 2800);
  }

  async function handleAiWrite() {
    if (!selected) return;
    setGeneratingDraft(true);
    setSendError(null);
    try {
      const res = await fetch("/api/inbox/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "Failed to generate draft");
        return;
      }
      setDraftText(data.draft ?? "");
      setDraftHtml(plainToHtml(data.draft ?? ""));
      setAiDraftOriginal(data.draft ?? "");
    } catch {
      setSendError("Failed to generate draft");
    } finally {
      setGeneratingDraft(false);
    }
  }

  const handleNotInterested = useCallback((leadId: string) => {
    setSuppressed((prev) => new Set(prev).add(leadId));
    setSelected((cur) => (cur?.id === leadId ? null : cur));
  }, []);

  const visible = useMemo(() => leads.filter((l) => !suppressed.has(l.id)), [leads, suppressed]);
  const hotCount = visible.filter((l) => classifyLead(l) === "hot").length;
  const warmCount = visible.length - hotCount;

  const filteredThreads = useMemo(
    () => visible.filter((l) => filter === "all" || classifyLead(l) === filter),
    [visible, filter]
  );

  const grouped = useMemo(() => {
    const buckets: Record<string, InboxLead[]> = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Older: [],
    };
    [...filteredThreads]
      .sort((a, b) => {
        const aTs = new Date(a.lastTouchedAt ?? a.messages.at(-1)?.sentAt ?? 0).getTime();
        const bTs = new Date(b.lastTouchedAt ?? b.messages.at(-1)?.sentAt ?? 0).getTime();
        // hot first within sort
        const aHot = classifyLead(a) === "hot" ? 1 : 0;
        const bHot = classifyLead(b) === "hot" ? 1 : 0;
        if (aHot !== bHot) return bHot - aHot;
        return bTs - aTs;
      })
      .forEach((l) => {
        const ts = l.lastTouchedAt ?? l.messages.at(-1)?.sentAt;
        const bucket = ts ? timeBucket(ts) : "Older";
        buckets[bucket].push(l);
      });
    return Object.entries(buckets).filter(([, v]) => v.length > 0);
  }, [filteredThreads]);

  const isAiDraft = !!aiDraftOriginal && draftText === aiDraftOriginal;

  // Keep a stable ref so the keydown handler always sees the current list/selection
  const filteredRef = useRef(filteredThreads);
  filteredRef.current = filteredThreads;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const threads = filteredRef.current;
      const cur = selectedRef.current;
      const idx = cur ? threads.findIndex((l) => l.id === cur.id) : -1;

      if (e.key === "j") {
        e.preventDefault();
        const next = threads[idx + 1];
        if (next) selectLead(next);
      } else if (e.key === "k") {
        e.preventDefault();
        const prev = threads[idx - 1];
        if (prev) selectLead(prev);
      } else if (e.key === "r") {
        e.preventDefault();
        document.getElementById("inbox-draft")?.focus();
      } else if (e.key === "e") {
        e.preventDefault();
        if (cur) handleNotInterested(cur.id);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectLead, handleNotInterested]);

  return (
    <div className="flex h-[calc(100vh-48px)] -m-6 overflow-hidden">
      {/* ── LIST PANEL ── */}
      <div className="w-80 shrink-0 flex flex-col border-r border-border bg-sidebar">
        {/* List header */}
        <div className="px-[18px] pt-3.5 pb-3 border-b border-border bg-[oklch(0.105_0_0)] flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="ds-h1 m-0 text-[20px]">Inbox</h1>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-4">
              {loading ? "…" : `${filteredThreads.length} threads`}
            </span>
          </div>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All · ${visible.length}` },
              { value: "hot", label: `Hot · ${hotCount}` },
              { value: "warm", label: `Warm · ${warmCount}` },
            ]}
          />
        </div>

        {/* List body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading &&
            [...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-16 ds-pulse border-b border-border-soft"
                style={{ background: "oklch(0.12 0 0)", animationDelay: `${i * 70}ms` }}
              />
            ))}

          {!loading && filteredThreads.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <p className="font-mono text-[12px] text-fg-5 m-0">
                {visible.length === 0
                  ? "No warm or hot leads yet."
                  : "No threads in this filter."}
              </p>
              {visible.length === 0 && (
                <p className="font-mono text-[11px] text-fg-5 m-0">
                  Replies processed by the inbox agent will appear here.
                </p>
              )}
            </div>
          )}

          {!loading &&
            grouped.map(([group, threads]) => (
              <div key={group}>
                <div className="px-[18px] pt-3 pb-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-fg-5 sticky top-0 z-0 bg-gradient-to-b from-sidebar from-60% to-transparent">
                  {group}
                </div>
                {threads.map((lead) => (
                  <ThreadRow
                    key={lead.id}
                    lead={lead}
                    active={selected?.id === lead.id}
                    onClick={() => selectLead(lead)}
                  />
                ))}
              </div>
            ))}
        </div>

        {/* Keyboard hint footer */}
        <div className="shrink-0 border-t border-border px-4.5 py-2 flex items-center gap-3 flex-wrap">
          {([ ["J", "next"], ["K", "prev"], ["R", "reply"], ["E", "archive"] ] as const).map(([key, hint]) => (
            <span key={key} className="flex items-center gap-1 font-mono text-[10px] text-fg-5">
              <Kbd>{key}</Kbd>
              <span>{hint}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── DETAIL PANEL ── */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center bg-canvas">
          <p className="font-mono text-[12px] text-fg-5">
            Select a thread to read and reply
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden bg-canvas min-w-0">
          {/* Detail header */}
          <div className="px-6 py-3.5 border-b border-border bg-[oklch(0.105_0_0)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={selected.companyName} size={32} />
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-sans font-semibold text-[15px] text-fg-1 tracking-[-0.01em] truncate">
                    {selected.companyName}
                  </span>
                  <Badge variant={classifyLead(selected) === "hot" ? "hot" : "warm"} size="sm">
                    {classifyLead(selected)}
                  </Badge>
                </div>
                <span className="font-mono text-[11px] text-fg-4 truncate">
                  {selected.email} · {selected.campaign.name}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                iconStart="archive"
                onClick={() => handleNotInterested(selected.id)}
              >
                Not interested
              </Button>
            </div>
          </div>

          {/* Thread body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
            {selected.messages
              .filter((m) => m.direction !== "system")
              .filter((m) => (m.body ?? "").trim().length > 0)
              .map((msg) => (
                <ThreadMessage key={msg.id} msg={msg} />
              ))}
          </div>

          {/* Composer */}
          <div className="border-t border-border bg-[oklch(0.105_0_0)] px-6 py-3.5 flex flex-col gap-2.5 shrink-0">
            {isAiDraft && (
              <div className="flex items-center gap-2">
                <span className="w-1 h-3.5 bg-amber rounded-sm" />
                <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-amber font-semibold">
                  AI DRAFT
                </span>
                <span className="font-mono text-[10px] text-fg-4">· edit before sending</span>
              </div>
            )}
            <div
              className="relative rounded-md bg-[oklch(0.115_0_0)]"
              style={{
                border: isAiDraft ? "1px solid var(--amber-border)" : "1px solid oklch(0.20 0 0)",
                borderLeft: isAiDraft ? "2px solid var(--amber)" : "1px solid oklch(0.20 0 0)",
              }}
            >
              <RichTextEditor
                value={draftHtml}
                onChange={(html, text) => {
                  setDraftHtml(html);
                  setDraftText(text);
                }}
                placeholder="Write your reply…"
                editorClassName="min-h-[110px] text-fg-1"
                className="[&_.rte-content]:bg-transparent"
              />
              <div className="px-3.5 py-2 border-t border-border-soft flex items-center gap-2.5">
                <span className="ml-auto font-mono text-[10px] text-fg-5">
                  {draftText.length} chars
                </span>
              </div>
            </div>

            {sendError && (
              <Toast kind="hot" pill="ERROR">
                {sendError}
              </Toast>
            )}

            <div className="flex items-center justify-between">
              {sentToast ? (
                <Toast kind="success" pill="SENT">
                  Reply sent to {selected.companyName}
                </Toast>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  variant="info"
                  iconStart="sparkle"
                  onClick={handleAiWrite}
                  disabled={generatingDraft || sending}
                >
                  {generatingDraft ? "AI Writing…" : "AI Write"}
                </Button>
                <Button
                  variant="success"
                  iconEnd="arrow"
                  onClick={handleSendReply}
                  disabled={sending || !draftText.trim()}
                >
                  {sending ? "Sending…" : "Send Reply"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ThreadRow({
  lead,
  active,
  onClick,
}: {
  lead: InboxLead;
  active: boolean;
  onClick: () => void;
}) {
  const kind = classifyLead(lead);
  const ts = lead.lastTouchedAt ?? lead.messages.at(-1)?.sentAt;
  const preview = snippet(lead);
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left px-[18px] py-3 border-0 cursor-pointer flex flex-col gap-1.5 transition-colors duration-150 relative",
        active
          ? "bg-[oklch(0.14_0_0)]"
          : "bg-transparent hover:bg-[oklch(0.115_0_0)]",
      ].join(" ")}
      style={{ borderLeft: active ? "2px solid var(--amber)" : "2px solid transparent" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={lead.companyName} size={20} />
          <span
            className={[
              "font-sans text-[13px] font-medium tracking-[-0.01em] truncate",
              active ? "text-fg-1" : "text-fg-2",
            ].join(" ")}
            title={lead.companyName}
          >
            {lead.companyName}
          </span>
        </div>
        {ts && (
          <span className="font-mono text-[10px] text-fg-5 shrink-0">{timeSince(ts)}</span>
        )}
      </div>
      <p className="font-mono text-[11.5px] text-fg-4 m-0 truncate leading-tight" title={preview}>
        {preview || <span className="text-fg-5">—</span>}
      </p>
      <div className="flex items-center gap-2">
        <Badge variant={kind === "hot" ? "hot" : "warm"} size="sm">
          {kind}
        </Badge>
        <span className="font-mono text-[10px] text-fg-5 truncate">{lead.campaign.name}</span>
      </div>
    </button>
  );
}

function ThreadMessage({ msg }: { msg: Message }) {
  const inbound = msg.direction === "inbound";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <DirectionTag dir={msg.direction} />
        {msg.subject && (
          <span className="font-mono text-[11px] text-fg-4 truncate">{msg.subject}</span>
        )}
        <span className="ml-auto font-mono text-[10px] text-fg-5 shrink-0">
          {timeSince(msg.sentAt)}
        </span>
      </div>
      <div
        className="px-3.5 py-3 rounded-lg text-fg-2 font-mono text-[12.5px] leading-[1.65]"
        style={{
          background: inbound
            ? "color-mix(in oklch, var(--success) 8%, var(--surface))"
            : "var(--surface)",
          borderLeft: inbound ? "2px solid var(--success)" : "2px solid var(--fg-5)",
        }}
      >
        <RichTextViewer html={msg.bodyHtml || msg.body?.replace(/\n/g, "<br>")} />
      </div>
    </div>
  );
}
