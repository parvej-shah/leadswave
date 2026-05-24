"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Filter, X } from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sendError, setSendError] = useState<{ id: string; msg: string } | null>(null);

  // Edit lead state
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState<{
    companyName: string;
    email: string;
    website: string;
    state: string;
  }>({ companyName: "", email: "", website: "", state: "discovered" });
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Delete lead state
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);

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

  const SENT_STATES = new Set(["contacted", "replied", "converted", "meeting_booked", "unsubscribed", "bounced"]);

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
      const data = await res.json().catch(() => ({}));
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
    setDeletingLead(null);
  }

  async function handleUpdateLead(e: React.FormEvent) {
    e.preventDefault();
    if (!editingLead) return;

    setUpdating(true);
    setUpdateError(null);

    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingLead.id,
          companyName: editForm.companyName,
          email: editForm.email,
          website: editForm.website,
          state: editForm.state,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to update lead");
      }

      const updatedLead = await res.json();
      
      setLeads((prev) =>
        prev.map((l) => (l.id === editingLead.id ? updatedLead : l))
      );

      setEditingLead(null);
    } catch (err: any) {
      setUpdateError(err.message ?? "An error occurred");
    } finally {
      setUpdating(false);
    }
  }

  const filtered = leads.filter((l) => {
    if (campaignFilter !== "all" && l.campaign.name !== campaignFilter) return false;
    if (stateFilter !== "all" && l.state !== stateFilter) return false;
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCompany = l.companyName?.toLowerCase().includes(q);
      const matchEmail = l.email?.toLowerCase().includes(q);
      const matchWebsite = l.website?.toLowerCase().includes(q);
      if (!matchCompany && !matchEmail && !matchWebsite) return false;
    }
    
    return true;
  });

  const selectCls = [
    "bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5",
    "focus:outline-none focus:border-[oklch(0.78_0.18_65)]",
  ].join(" ");

  const gridStyle = { gridTemplateColumns: "2fr 2fr 2fr 110px 52px 170px" };

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
      </div>

      {/* Search & Filters Controls */}
      {!loading && leads.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 p-4 rounded-lg border border-zinc-800/80 bg-zinc-950/40 backdrop-blur-sm animate-fade-in">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search by company, email, website..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-800 text-zinc-100 text-sm rounded-lg pl-9 pr-8 py-2 focus:outline-none focus:border-[oklch(0.78_0.18_65)] transition-colors placeholder-zinc-500"
              style={{ fontFamily: "'DM Mono', monospace" }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-2.5 flex items-center text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter selects */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500" style={{ fontFamily: "'DM Mono', monospace" }}>
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>
            
            <select
              className={`${selectCls} min-w-[140px] py-2 rounded-lg bg-zinc-900/60`}
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
            >
              <option value="all">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              className={`${selectCls} min-w-[120px] py-2 rounded-lg bg-zinc-900/60`}
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
            >
              <option value="all">All States</option>
              {Object.keys(STATE_STYLES).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="flex flex-col gap-px">
          <div className="grid gap-0" style={gridStyle}>
            {["Company", "Email", "Website", "State", "Msgs", ""].map((h) => (
              <div
                key={h}
                className="px-3 py-2.5 text-xs text-zinc-550 uppercase tracking-wider border-b border-zinc-800"
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
        <div className="border border-dashed border-zinc-800 rounded p-12 text-center animate-fade-in">
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
        <div className="rounded border border-zinc-800 overflow-hidden animate-fade-in">
          {/* Header row */}
          <div
            className="grid border-b border-zinc-800"
            style={gridStyle}
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
            <div className="px-4 py-8 text-center text-sm text-zinc-650" style={{ fontFamily: "'DM Mono', monospace" }}>
              No leads match the current search query or filters.
            </div>
          ) : (
            filtered.map((lead, idx) => (
              <div
                key={lead.id}
                className="grid border-b border-zinc-900 hover:bg-zinc-900/60 transition-colors group"
                style={{
                  ...gridStyle,
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
                <div className="px-2 py-2 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleSend(lead.id)}
                      disabled={sending === lead.id || SENT_STATES.has(lead.state) || !lead.email}
                      title={!lead.email ? "No email address" : SENT_STATES.has(lead.state) ? `Already ${lead.state}` : "Send personalized email"}
                      className="px-2 py-1 rounded text-[10px] font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
                      onClick={() => {
                        setEditingLead(lead);
                        setEditForm({
                          companyName: lead.companyName,
                          email: lead.email || "",
                          website: lead.website || "",
                          state: lead.state,
                        });
                        setUpdateError(null);
                      }}
                      title="Edit lead details"
                      className="px-2 py-1 rounded text-[10px] font-medium transition-all hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 cursor-pointer"
                      style={{
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => setDeletingLead(lead)}
                      disabled={removing === lead.id}
                      title="Remove lead"
                      className="px-2 py-1 rounded text-[10px] transition-opacity hover:opacity-100 opacity-0 group-hover:opacity-70 cursor-pointer"
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
                    <p className="text-[9px] mt-1 text-red-400 leading-none" style={{ fontFamily: "'DM Mono', monospace" }}>
                      {sendError.msg}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Edit Lead Modal */}
      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div 
            className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl relative animate-scale-up"
            style={{ background: "oklch(0.10 0 0)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-5">
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2" style={{ fontFamily: "'DM Mono', monospace" }}>
                <span className="w-2 h-2 rounded-full bg-[oklch(0.78_0.18_65)] animate-pulse" />
                Edit Lead Details
              </h2>
              <button 
                onClick={() => setEditingLead(null)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error banner */}
            {updateError && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-900/50 text-red-400 text-[10px]" style={{ fontFamily: "'DM Mono', monospace" }}>
                {updateError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleUpdateLead} className="space-y-4">
              {/* Company Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-450 uppercase tracking-wider block" style={{ fontFamily: "'DM Mono', monospace" }}>
                  Company Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.companyName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, companyName: e.target.value }))}
                  className="w-full bg-zinc-900/65 border border-zinc-800 text-zinc-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[oklch(0.78_0.18_65)] transition-colors placeholder-zinc-600"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-450 uppercase tracking-wider block" style={{ fontFamily: "'DM Mono', monospace" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  placeholder="contact@company.com"
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-zinc-900/65 border border-zinc-800 text-zinc-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[oklch(0.78_0.18_65)] transition-colors placeholder-zinc-600"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                />
              </div>

              {/* Website */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-450 uppercase tracking-wider block" style={{ fontFamily: "'DM Mono', monospace" }}>
                  Website URL
                </label>
                <input
                  type="text"
                  value={editForm.website}
                  placeholder="https://company.com"
                  onChange={(e) => setEditForm(prev => ({ ...prev, website: e.target.value }))}
                  className="w-full bg-zinc-900/65 border border-zinc-800 text-zinc-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[oklch(0.78_0.18_65)] transition-colors placeholder-zinc-600"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                />
              </div>

              {/* State */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-450 uppercase tracking-wider block" style={{ fontFamily: "'DM Mono', monospace" }}>
                  Lead State
                </label>
                <select
                  value={editForm.state}
                  onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded px-3 py-2 focus:outline-none focus:border-[oklch(0.78_0.18_65)]"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  {Object.keys(STATE_STYLES).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-zinc-900 pt-5 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="px-3 py-1.5 rounded text-xs text-zinc-450 hover:text-zinc-200 hover:bg-zinc-900 transition-colors border border-transparent cursor-pointer"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-3 py-1.5 rounded text-xs font-semibold transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  style={{
                    background: "oklch(0.20 0.04 65)",
                    color: "oklch(0.78 0.18 65)",
                    border: "1px solid oklch(0.28 0.06 65)",
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {updating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Lead Confirmation Modal */}
      {deletingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div 
            className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl relative animate-scale-up"
            style={{ background: "oklch(0.10 0 0)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
              <h2 className="text-xs font-semibold text-zinc-100 flex items-center gap-2" style={{ fontFamily: "'DM Mono', monospace" }}>
                <span className="w-2 h-2 rounded-full bg-[oklch(0.60_0.18_25)] animate-pulse" />
                Confirm Deletion
              </h2>
              <button 
                onClick={() => setDeletingLead(null)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning Message */}
            <div className="space-y-3 mb-6">
              <p className="text-xs text-zinc-350 leading-relaxed" style={{ fontFamily: "'DM Mono', monospace" }}>
                Are you sure you want to delete the lead <strong className="text-zinc-100 font-semibold">{deletingLead.companyName}</strong>?
              </p>
              <p className="text-[10px] text-zinc-500 leading-relaxed bg-zinc-900/40 p-2.5 rounded border border-zinc-900" style={{ fontFamily: "'DM Mono', monospace" }}>
                This action will hide the lead from your active lists. Any scheduled campaign follow-ups for this lead will be halted.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-zinc-900 pt-4">
              <button
                type="button"
                onClick={() => setDeletingLead(null)}
                className="px-3 py-1.5 rounded text-xs text-zinc-450 hover:text-zinc-200 hover:bg-zinc-900 transition-colors border border-transparent cursor-pointer"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRemove(deletingLead.id)}
                disabled={removing === deletingLead.id}
                className="px-3 py-1.5 rounded text-xs font-semibold transition-opacity disabled:opacity-50 cursor-pointer"
                style={{
                  background: "oklch(0.18 0.03 25)",
                  color: "oklch(0.60 0.12 25)",
                  border: "1px solid oklch(0.26 0.05 25)",
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {removing === deletingLead.id ? "Deleting..." : "Delete Lead"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
