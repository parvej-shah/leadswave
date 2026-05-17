"use client";

import { useEffect, useState, useCallback } from "react";

type Lead = {
  id: string;
  companyName: string;
  email: string | null;
  website: string | null;
  state: string;
  createdAt: string;
  campaign: { name: string };
  _count: { messages: number };
};

const STATE_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  discovered:  { label: "discovered",  color: "oklch(0.60 0 0)",        bg: "oklch(0.15 0 0)",      border: "oklch(0.25 0 0)"      },
  contacted:   { label: "contacted",   color: "oklch(0.78 0.18 65)",    bg: "oklch(0.18 0.04 65)",  border: "oklch(0.30 0.08 65)"  },
  replied:     { label: "replied",     color: "oklch(0.72 0.18 145)",   bg: "oklch(0.16 0.04 145)", border: "oklch(0.28 0.08 145)" },
  converted:   { label: "converted",  color: "oklch(0.72 0.18 145)",   bg: "oklch(0.16 0.04 145)", border: "oklch(0.28 0.08 145)" },
  unsubscribed:{ label: "unsub",       color: "oklch(0.55 0.12 25)",    bg: "oklch(0.16 0.03 25)",  border: "oklch(0.28 0.06 25)"  },
  bounced:     { label: "bounced",     color: "oklch(0.60 0.18 25)",    bg: "oklch(0.16 0.04 25)",  border: "oklch(0.28 0.08 25)"  },
};

function StateBadge({ state }: { state: string }) {
  const s = STATE_STYLES[state] ?? STATE_STYLES["discovered"];
  return (
    <span
      style={{
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
        fontFamily: "'DM Mono', monospace",
        fontSize: "0.6875rem",
        letterSpacing: "0.06em",
        padding: "2px 7px",
        borderRadius: "4px",
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

function TruncatedUrl({ href }: { href: string }) {
  let display = href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  if (display.length > 28) display = display.slice(0, 26) + "…";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "oklch(0.55 0 0)", fontSize: "0.75rem", fontFamily: "'DM Mono', monospace" }}
      className="hover:underline"
    >
      {display}
    </a>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [removing, setRemoving] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sendError, setSendError] = useState<{ id: string; msg: string } | null>(null);

  const campaigns = Array.from(
    new Map(leads.map((l) => [l.campaign.name, l.campaign.name])).entries()
  ).map(([k]) => k);

  const fetchLeads = useCallback(() => {
    setLoading(true);
    fetch("/api/leads")
      .then((r) => r.json())
      .then((data) => {
        setLeads(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function handleSend(id: string) {
    setSending(id);
    setSendError(null);
    const res = await fetch("/api/agents/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: id }),
    });
    setSending(null);
    if (!res.ok) {
      const data = await res.json();
      setSendError({ id, msg: data.error ?? "Send failed" });
    } else {
      setLeads((prev) =>
        prev.map((l) => l.id === id ? { ...l, state: "contacted", _count: { messages: l._count.messages + 1 } } : l)
      );
    }
  }

  async function handleRemove(id: string) {
    setRemoving(id);
    await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setRemoving(null);
  }

  const filtered = leads.filter((l) => {
    if (campaignFilter !== "all" && l.campaign.name !== campaignFilter) return false;
    if (stateFilter !== "all" && l.state !== stateFilter) return false;
    return true;
  });

  const selectCls = [
    "bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5",
    "focus:outline-none focus:border-[oklch(0.78_0.18_65)]",
  ].join(" ");

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            className="text-xl font-semibold text-zinc-100 mb-1"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            Leads
          </h1>
          <p className="text-sm text-zinc-500">
            {loading ? "Loading…" : `${filtered.length} lead${filtered.length !== 1 ? "s" : ""}`}
            {!loading && leads.length !== filtered.length ? ` of ${leads.length}` : ""}
          </p>
        </div>

        {/* Filters */}
        {!loading && leads.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              className={selectCls}
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
            >
              <option value="all">All campaigns</option>
              {campaigns.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              className={selectCls}
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
            >
              <option value="all">All states</option>
              {Object.keys(STATE_STYLES).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="flex flex-col gap-px">
          <div className="grid gap-0" style={{ gridTemplateColumns: "2fr 2fr 2fr 1fr 1fr 120px" }}>
            {["Company", "Email", "Website", "State", "Msgs", ""].map((h) => (
              <div
                key={h}
                className="px-3 py-2 text-xs text-zinc-600 uppercase tracking-wider border-b border-zinc-800"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                {h}
              </div>
            ))}
          </div>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-11 animate-pulse border-b border-zinc-900"
              style={{ background: "oklch(0.12 0 0)", animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && leads.length === 0 && (
        <div className="border border-dashed border-zinc-800 rounded p-12 text-center">
          <p className="text-sm text-zinc-500 mb-3">No leads yet.</p>
          <a
            href="/campaigns/new"
            className="text-sm underline underline-offset-4"
            style={{ color: "oklch(0.78 0.18 65)" }}
          >
            Launch a campaign to find leads →
          </a>
        </div>
      )}

      {/* Table */}
      {!loading && leads.length > 0 && (
        <div className="rounded border border-zinc-800 overflow-hidden">
          {/* Header row */}
          <div
            className="grid border-b border-zinc-800"
            style={{ gridTemplateColumns: "2fr 2fr 2fr 110px 52px 120px" }}
          >
            {["Company", "Email", "Website", "State", "Msgs", ""].map((h) => (
              <div
                key={h}
                className="px-3 py-2.5 text-xs text-zinc-500 uppercase tracking-wider"
                style={{ fontFamily: "'DM Mono', monospace", background: "oklch(0.11 0 0)" }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-600">
              No leads match the current filters.
            </div>
          ) : (
            filtered.map((lead, idx) => (
              <div
                key={lead.id}
                className="grid border-b border-zinc-900 hover:bg-zinc-900/60 transition-colors group"
                style={{
                  gridTemplateColumns: "2fr 2fr 2fr 110px 52px 120px",
                  background: idx % 2 === 0 ? "oklch(0.115 0 0)" : "oklch(0.105 0 0)",
                }}
              >
                {/* Company */}
                <div className="px-3 py-2.5 flex items-center min-w-0">
                  <span
                    className="text-sm text-zinc-100 truncate"
                    style={{ fontFamily: "'DM Mono', monospace" }}
                    title={lead.companyName}
                  >
                    {lead.companyName}
                  </span>
                </div>

                {/* Email */}
                <div className="px-3 py-2.5 flex items-center min-w-0">
                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="text-xs truncate hover:underline"
                      style={{ color: "oklch(0.65 0 0)", fontFamily: "'DM Mono', monospace" }}
                      title={lead.email}
                    >
                      {lead.email}
                    </a>
                  ) : (
                    <span className="text-xs text-zinc-700" style={{ fontFamily: "'DM Mono', monospace" }}>—</span>
                  )}
                </div>

                {/* Website */}
                <div className="px-3 py-2.5 flex items-center min-w-0">
                  {lead.website ? (
                    <TruncatedUrl href={lead.website} />
                  ) : (
                    <span className="text-xs text-zinc-700" style={{ fontFamily: "'DM Mono', monospace" }}>—</span>
                  )}
                </div>

                {/* State */}
                <div className="px-3 py-2.5 flex items-center">
                  <StateBadge state={lead.state} />
                </div>

                {/* Messages count */}
                <div className="px-3 py-2.5 flex items-center">
                  <span
                    className="text-xs"
                    style={{
                      color: lead._count.messages > 0 ? "oklch(0.78 0.18 65)" : "oklch(0.35 0 0)",
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {lead._count.messages}
                  </span>
                </div>

                {/* Actions */}
                <div className="px-2 py-2 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleSend(lead.id)}
                    disabled={sending === lead.id || lead.state === "contacted" || !lead.email}
                    title={!lead.email ? "No email address" : lead.state === "contacted" ? "Already contacted" : "Send personalized email"}
                    className="px-2 py-1 rounded text-xs font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: "oklch(0.20 0.04 65)",
                      color: "oklch(0.78 0.18 65)",
                      border: "1px solid oklch(0.28 0.06 65)",
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {sending === lead.id ? "…" : "Send"}
                  </button>

                  <button
                    onClick={() => handleRemove(lead.id)}
                    disabled={removing === lead.id}
                    title="Remove lead"
                    className="px-2 py-1 rounded text-xs transition-opacity hover:opacity-100 opacity-0 group-hover:opacity-70"
                    style={{
                      background: "oklch(0.18 0.03 25)",
                      color: "oklch(0.60 0.12 25)",
                      border: "1px solid oklch(0.26 0.05 25)",
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {removing === lead.id ? "…" : "✕"}
                  </button>
                  </div>
                  {sendError?.id === lead.id && (
                    <p className="text-xs" style={{ color: "oklch(0.60 0.18 25)", fontFamily: "'DM Mono', monospace" }}>
                      {sendError.msg}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
