"use client";

import { useEffect, useState, useCallback } from "react";

type Message = {
  id: string;
  direction: "outbound" | "inbound" | "system";
  subject: string | null;
  body: string | null;
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

const HOT_STATES = new Set(["converted"]);
const WARM_STATES = new Set(["replied"]);

function classifyLead(lead: InboxLead): "hot" | "warm" {
  // If they've been marked converted they replied positively
  if (HOT_STATES.has(lead.state)) return "hot";
  if (WARM_STATES.has(lead.state)) return "warm";
  return "warm";
}

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function snippet(lead: InboxLead) {
  const last = [...lead.messages]
    .reverse()
    .find((m) => m.direction === "inbound");
  return last?.body?.slice(0, 90).replace(/\n/g, " ") ?? "";
}

function BadgeHot() {
  return (
    <span
      style={{
        background: "oklch(0.18 0.04 25)",
        color: "oklch(0.72 0.22 25)",
        border: "1px solid oklch(0.30 0.10 25)",
        fontFamily: "'DM Mono', monospace",
        fontSize: "0.6rem",
        letterSpacing: "0.08em",
        padding: "2px 6px",
        borderRadius: "4px",
      }}
    >
      HOT
    </span>
  );
}

function BadgeWarm() {
  return (
    <span
      style={{
        background: "oklch(0.18 0.04 65)",
        color: "oklch(0.78 0.18 65)",
        border: "1px solid oklch(0.30 0.08 65)",
        fontFamily: "'DM Mono', monospace",
        fontSize: "0.6rem",
        letterSpacing: "0.08em",
        padding: "2px 6px",
        borderRadius: "4px",
      }}
    >
      WARM
    </span>
  );
}

function DirectionTag({ dir }: { dir: string }) {
  if (dir === "outbound")
    return (
      <span
        style={{
          color: "oklch(0.45 0 0)",
          fontFamily: "'DM Mono', monospace",
          fontSize: "0.65rem",
          letterSpacing: "0.06em",
        }}
      >
        YOU →
      </span>
    );
  if (dir === "inbound")
    return (
      <span
        style={{
          color: "oklch(0.72 0.18 145)",
          fontFamily: "'DM Mono', monospace",
          fontSize: "0.65rem",
          letterSpacing: "0.06em",
        }}
      >
        ← THEM
      </span>
    );
  return (
    <span
      style={{
        color: "oklch(0.55 0.12 260)",
        fontFamily: "'DM Mono', monospace",
        fontSize: "0.65rem",
        letterSpacing: "0.06em",
      }}
    >
      AI DRAFT
    </span>
  );
}

export default function InboxPage() {
  const [leads, setLeads] = useState<InboxLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InboxLead | null>(null);
  const [draftText, setDraftText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [suppressed, setSuppressed] = useState<Set<string>>(new Set());

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

  // When selecting a lead, pre-fill draft from system message if present
  function selectLead(lead: InboxLead) {
    setSelected(lead);
    setSendError(null);
    const draft = lead.messages.find((m) => m.direction === "system");
    setDraftText(draft?.body ?? "");
  }

  async function handleSendReply() {
    if (!selected || !draftText.trim()) return;
    setSending(true);
    setSendError(null);
    const res = await fetch("/api/inbox/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: selected.id, body: draftText }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json();
      setSendError(data.error ?? "Failed to send");
      return;
    }
    // Optimistically update lead state and add the sent message
    const newMsg: Message = {
      id: crypto.randomUUID(),
      direction: "outbound",
      subject: null,
      body: draftText,
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
  }

  function handleNotInterested(leadId: string) {
    setSuppressed((prev) => new Set(prev).add(leadId));
    if (selected?.id === leadId) setSelected(null);
  }

  const visible = leads.filter(
    (l) => !suppressed.has(l.id) && (l.state === "replied" || l.state === "converted")
  );
  const hot = visible.filter((l) => classifyLead(l) === "hot");
  const warm = visible.filter((l) => classifyLead(l) === "warm");
  const ordered = [...hot, ...warm];

  const mono = { fontFamily: "'DM Mono', monospace" } as const;

  return (
    <div className="flex h-[calc(100vh-48px)] gap-0 -m-6 overflow-hidden">
      {/* ── LIST PANEL ── */}
      <div
        className="w-80 shrink-0 flex flex-col border-r overflow-y-auto"
        style={{ borderColor: "oklch(0.20 0 0)", background: "oklch(0.10 0 0)" }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: "oklch(0.18 0 0)", background: "oklch(0.11 0 0)" }}
        >
          <h1 className="text-sm font-semibold text-zinc-100" style={mono}>
            Inbox
          </h1>
          <span className="text-xs text-zinc-500" style={mono}>
            {loading ? "…" : `${ordered.length} thread${ordered.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Skeleton */}
        {loading &&
          [...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse border-b"
              style={{
                borderColor: "oklch(0.16 0 0)",
                background: "oklch(0.12 0 0)",
                animationDelay: `${i * 70}ms`,
              }}
            />
          ))}

        {/* Empty */}
        {!loading && ordered.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 px-6 text-center">
            <p className="text-xs text-zinc-600" style={mono}>
              No warm or hot leads yet.
            </p>
            <p className="text-xs text-zinc-700" style={mono}>
              Replies processed by the inbox agent will appear here.
            </p>
          </div>
        )}

        {/* Lead rows */}
        {!loading &&
          ordered.map((lead) => {
            const kind = classifyLead(lead);
            const ts = lead.lastTouchedAt ?? lead.messages.at(-1)?.sentAt;
            const isActive = selected?.id === lead.id;
            return (
              <button
                key={lead.id}
                onClick={() => selectLead(lead)}
                className="w-full text-left px-3 py-3 border-b flex flex-col gap-1 transition-colors"
                style={{
                  borderColor: "oklch(0.16 0 0)",
                  background: isActive ? "oklch(0.145 0 0)" : "transparent",
                  borderLeft: isActive
                    ? "2px solid oklch(0.78 0.18 65)"
                    : "2px solid transparent",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-sm text-zinc-100 truncate font-medium"
                    style={mono}
                    title={lead.companyName}
                  >
                    {lead.companyName}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {kind === "hot" ? <BadgeHot /> : <BadgeWarm />}
                  </div>
                </div>
                <p
                  className="text-xs truncate"
                  style={{ color: "oklch(0.45 0 0)", ...mono }}
                  title={snippet(lead)}
                >
                  {snippet(lead) || <span className="text-zinc-700">—</span>}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "oklch(0.38 0 0)", ...mono }}>
                    {lead.campaign.name}
                  </span>
                  {ts && (
                    <span className="text-xs" style={{ color: "oklch(0.35 0 0)", ...mono }}>
                      · {timeSince(ts)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
      </div>

      {/* ── DETAIL PANEL ── */}
      {!selected ? (
        <div
          className="flex-1 flex items-center justify-center"
          style={{ background: "oklch(0.09 0 0)" }}
        >
          <p className="text-sm text-zinc-700" style={mono}>
            Select a thread to read and reply
          </p>
        </div>
      ) : (
        <div
          className="flex-1 flex flex-col overflow-hidden"
          style={{ background: "oklch(0.09 0 0)" }}
        >
          {/* Detail header */}
          <div
            className="px-5 py-3 border-b flex items-center justify-between shrink-0"
            style={{ borderColor: "oklch(0.18 0 0)", background: "oklch(0.10 0 0)" }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-zinc-100" style={mono}>
                {selected.companyName}
              </span>
              <span className="text-xs" style={{ color: "oklch(0.45 0 0)", ...mono }}>
                {selected.email}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {classifyLead(selected) === "hot" ? <BadgeHot /> : <BadgeWarm />}
              <button
                onClick={() => handleNotInterested(selected.id)}
                className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-100 opacity-60"
                style={{
                  background: "oklch(0.16 0.02 25)",
                  color: "oklch(0.55 0.10 25)",
                  border: "1px solid oklch(0.24 0.04 25)",
                  ...mono,
                }}
              >
                Not Interested
              </button>
            </div>
          </div>

          {/* Thread messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            {selected.messages
              .filter((m) => m.direction !== "system")
              .map((msg) => (
                <div key={msg.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <DirectionTag dir={msg.direction} />
                    {msg.subject && (
                      <span
                        className="text-xs truncate"
                        style={{ color: "oklch(0.40 0 0)", ...mono }}
                      >
                        {msg.subject}
                      </span>
                    )}
                    <span
                      className="text-xs ml-auto shrink-0"
                      style={{ color: "oklch(0.33 0 0)", ...mono }}
                    >
                      {timeSince(msg.sentAt)}
                    </span>
                  </div>
                  <div
                    className="rounded px-3 py-2.5 text-xs whitespace-pre-wrap"
                    style={{
                      background:
                        msg.direction === "inbound"
                          ? "oklch(0.13 0.02 145)"
                          : "oklch(0.13 0 0)",
                      border:
                        msg.direction === "inbound"
                          ? "1px solid oklch(0.22 0.04 145)"
                          : "1px solid oklch(0.20 0 0)",
                      color: "oklch(0.75 0 0)",
                      ...mono,
                      lineHeight: 1.6,
                    }}
                  >
                    {msg.body}
                  </div>
                </div>
              ))}
          </div>

          {/* Reply composer — always shown for inbox leads */}
          <div
            className="border-t shrink-0 px-5 py-4 flex flex-col gap-3"
            style={{ borderColor: "oklch(0.18 0 0)", background: "oklch(0.10 0 0)" }}
          >
            {draftText && (
              <p className="text-xs" style={{ color: "oklch(0.55 0.12 260)", ...mono }}>
                AI draft · edit before sending
              </p>
            )}
            <textarea
              className="w-full rounded px-3 py-2 text-xs resize-none focus:outline-none"
              style={{
                background: "oklch(0.13 0 0)",
                border: "1px solid oklch(0.22 0 0)",
                color: "oklch(0.80 0 0)",
                minHeight: "90px",
                ...mono,
                lineHeight: 1.6,
              }}
              placeholder="Write your reply…"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
            />
            {sendError && (
              <p className="text-xs" style={{ color: "oklch(0.62 0.18 25)", ...mono }}>
                {sendError}
              </p>
            )}
            <div className="flex justify-end">
              <button
                onClick={handleSendReply}
                disabled={sending || !draftText.trim()}
                className="px-4 py-1.5 rounded text-xs font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: "oklch(0.22 0.05 145)",
                  color: "oklch(0.78 0.18 145)",
                  border: "1px solid oklch(0.30 0.08 145)",
                  ...mono,
                }}
              >
                {sending ? "Sending…" : "Send Reply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
