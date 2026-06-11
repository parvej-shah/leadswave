"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Avatar,
  Badge,
  Button,
  CategoryBadge,
  Dialog,
  EmptyState,
  FilterChip,
  Icon,
  Input,
  Label,
  Segmented,
  Select,
  StateBadge,
  Toast,
  type LeadState,
} from "@/components/ui";
import { WhatsAppButton } from "@/components/whatsapp-button";

type Lead = {
  id: string;
  companyName: string;
  email: string | null;
  emailStatus: string | null;
  website: string | null;
  state: string;
  category: string | null;
  phone: string | null;
  address: string | null;
  hasContactForm: boolean | null;
  facebookUrl: string | null;
  createdAt: string;
  updatedAt?: string;
  campaign: { name: string };
  _count: { messages: number };
};

type CategoryFilter = "all" | "crm" | "website_proposal";

// Alternative outreach channels for leads with no email (Layer 4),
// plus a review queue for medium-confidence catch-all emails.
type ChannelFilter = "all" | "call_queue" | "form" | "facebook" | "catch_all";

const CHANNEL_LABEL: Record<Exclude<ChannelFilter, "all">, string> = {
  call_queue: "Call queue",
  form: "Contact form",
  facebook: "Facebook",
  catch_all: "Catch-all ~",
};

function matchesChannel(l: Lead, c: Exclude<ChannelFilter, "all">): boolean {
  if (c === "catch_all") return !!l.email && l.emailStatus === "catch_all";
  if (l.email) return false; // channels are fallbacks for email-less leads
  if (c === "call_queue") return !!l.phone;
  if (c === "form") return !!l.hasContactForm;
  return !!l.facebookUrl;
}


const CATEGORY_LABEL: Record<"crm" | "website_proposal", string> = {
  crm: "CRM",
  website_proposal: "Website",
};

const STATE_KEYS: LeadState[] = [
  "discovered",
  "contacted",
  "replied",
  "converted",
  "unsubscribed",
  "bounced",
];

const SENT_STATES = new Set([
  "contacted",
  "replied",
  "converted",
  "meeting_booked",
  "unsubscribed",
  "bounced",
]);

type SortKey = "company" | "campaign" | "lastTouched" | "state" | "msgs";
type SortDir = "asc" | "desc";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

function truncateUrl(href: string): string {
  let display = href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  if (display.length > 28) display = display.slice(0, 26) + "…";
  return display;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState<"all" | LeadState>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sendError, setSendError] = useState<{ id: string; msg: string } | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "lastTouched",
    dir: "desc",
  });
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState({
    companyName: "",
    email: "",
    website: "",
    state: "discovered" as string,
  });
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);

  const [scriptLead, setScriptLead] = useState<Lead | null>(null);
  const [script, setScript] = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptError, setScriptError] = useState("");
  const [scriptCopied, setScriptCopied] = useState(false);

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

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const campaigns = useMemo(
    () => Array.from(new Set(leads.map((l) => l.campaign.name))),
    [leads]
  );

  const filtered = useMemo(() => {
    const list = leads.filter((l) => {
      if (campaignFilter !== "all" && l.campaign.name !== campaignFilter) return false;
      if (stateFilter !== "all" && l.state !== stateFilter) return false;
      if (categoryFilter !== "all" && l.category !== categoryFilter) return false;
      if (channelFilter !== "all" && !matchesChannel(l, channelFilter)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCompany = l.companyName?.toLowerCase().includes(q);
        const matchEmail = l.email?.toLowerCase().includes(q);
        const matchWebsite = l.website?.toLowerCase().includes(q);
        if (!matchCompany && !matchEmail && !matchWebsite) return false;
      }
      return true;
    });
    const sorted = [...list].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sort.key) {
        case "company":
          av = a.companyName ?? "";
          bv = b.companyName ?? "";
          break;
        case "campaign":
          av = a.campaign.name;
          bv = b.campaign.name;
          break;
        case "lastTouched":
          av = new Date(a.updatedAt ?? a.createdAt).getTime();
          bv = new Date(b.updatedAt ?? b.createdAt).getTime();
          break;
        case "state":
          av = a.state;
          bv = b.state;
          break;
        case "msgs":
          av = a._count.messages;
          bv = b._count.messages;
          break;
      }
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [leads, campaignFilter, stateFilter, categoryFilter, channelFilter, searchQuery, sort]);

  const stateCount = (s: LeadState) => leads.filter((l) => l.state === s).length;
  const categoryCount = (c: "crm" | "website_proposal") =>
    leads.filter((l) => l.category === c).length;
  const hasCategories = useMemo(() => leads.some((l) => l.category), [leads]);
  const channelCount = (c: Exclude<ChannelFilter, "all">) =>
    leads.filter((l) => matchesChannel(l, c)).length;
  const hasChannelLeads = useMemo(
    () =>
      leads.some(
        (l) =>
          (!l.email && (l.phone || l.hasContactForm || l.facebookUrl)) ||
          (l.email && l.emailStatus === "catch_all")
      ),
    [leads]
  );

  function toggle(id: string) {
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    if (selection.size === filtered.length) setSelection(new Set());
    else setSelection(new Set(filtered.map((l) => l.id)));
  }

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );
  }

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
        prev.map((l) =>
          l.id === id
            ? { ...l, state: "contacted", _count: { messages: l._count.messages + 1 } }
            : l
        )
      );
    }
  }

  async function openScript(lead: Lead) {
    setScriptLead(lead);
    setScript("");
    setScriptError("");
    setScriptCopied(false);
    setScriptLoading(true);
    try {
      const res = await fetch("/api/leads/call-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setScriptError(data.error ?? "Failed to generate call script");
        return;
      }
      setScript(data.script ?? "");
    } catch {
      setScriptError("Failed to generate call script");
    } finally {
      setScriptLoading(false);
    }
  }

  async function copyScript() {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  async function handleRemove(id: string) {
    setRemoving(id);
    await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setSelection((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
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
      setLeads((prev) => prev.map((l) => (l.id === editingLead.id ? updatedLead : l)));
      setEditingLead(null);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setUpdating(false);
    }
  }

  const rowPad = density === "compact" ? "py-[7px]" : "py-[11px]";
  const gridCols = "36px 2fr 1.4fr 1.2fr 1.1fr 110px 120px 56px 110px";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="ds-h1 m-0 mb-1">Leads</h1>
          <p className="font-mono text-[12px] text-fg-4 m-0">
            {loading ? (
              "Loading…"
            ) : (
              <>
                <span className="text-fg-2">{filtered.length}</span> leads
                {filtered.length !== leads.length && <> · filtered from {leads.length}</>}
                {selection.size > 0 && (
                  <>
                    {" · "}
                    <span className="text-amber">{selection.size} selected</span>
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            value={density}
            onChange={setDensity}
            options={[
              { value: "comfortable", label: "Cozy" },
              { value: "compact", label: "Dense" },
            ]}
          />
          <Link href="/campaigns/new">
            <Button iconStart="plus">New Campaign</Button>
          </Link>
        </div>
      </div>

      {/* State filter chips */}
      {!loading && leads.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={stateFilter === "all"}
            onClick={() => setStateFilter("all")}
            count={leads.length}
          >
            All
          </FilterChip>
          {STATE_KEYS.map((s) => (
            <FilterChip
              key={s}
              active={stateFilter === s}
              onClick={() => setStateFilter(s)}
              count={stateCount(s)}
            >
              {s}
            </FilterChip>
          ))}
        </div>
      )}

      {/* Category filter chips */}
      {!loading && hasCategories && (
        <div className="flex flex-wrap gap-1.5 -mt-2">
          <FilterChip
            active={categoryFilter === "all"}
            onClick={() => setCategoryFilter("all")}
            count={leads.length}
          >
            All types
          </FilterChip>
          {(["crm", "website_proposal"] as const).map((c) => (
            <FilterChip
              key={c}
              active={categoryFilter === c}
              onClick={() => setCategoryFilter(c)}
              count={categoryCount(c)}
            >
              {CATEGORY_LABEL[c]}
            </FilterChip>
          ))}
        </div>
      )}

      {/* Channel filter chips — email-less leads reachable by other means,
          plus catch-all emails worth reviewing before bulk sends */}
      {!loading && hasChannelLeads && (
        <div className="flex flex-wrap gap-1.5 -mt-2 items-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-4">
            Channels:
          </span>
          <FilterChip
            active={channelFilter === "all"}
            onClick={() => setChannelFilter("all")}
            count={leads.length}
          >
            All
          </FilterChip>
          {(["call_queue", "form", "facebook", "catch_all"] as const).map((c) => (
            <FilterChip
              key={c}
              active={channelFilter === c}
              onClick={() => setChannelFilter(channelFilter === c ? "all" : c)}
              count={channelCount(c)}
            >
              {CHANNEL_LABEL[c]}
            </FilterChip>
          ))}
        </div>
      )}

      {/* Search + filter row */}
      {!loading && leads.length > 0 && (
        <div className="flex items-center gap-3 px-3.5 py-2.5 bg-surface border border-border rounded-lg">
          <div className="flex-1 max-w-[360px]">
            <Input
              iconStart="search"
              placeholder="Search by company, email, website…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
            />
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <Icon name="filter" size={14} className="text-fg-4" />
            <Select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="min-w-[180px]"
            >
              <option value="all">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {/* Bulk action toolbar */}
      {selection.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-tinted-surface border border-amber-border rounded-lg">
          <span className="font-mono text-[12px] text-amber font-semibold">
            {selection.size} selected
          </span>
          <span className="flex-1" />
          <Button size="sm" variant="secondary" onClick={() => setSelection(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="border border-border rounded-lg overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-11 ds-pulse border-b border-border-soft last:border-b-0"
              style={{ background: "oklch(0.12 0 0)", animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && leads.length === 0 && (
        <EmptyState action={{ label: "Launch a campaign to find leads →", href: "/campaigns/new" }}>
          No leads yet.
        </EmptyState>
      )}

      {/* Table */}
      {!loading && leads.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {/* Header row */}
          <div
            className="grid border-b border-border bg-[oklch(0.115_0_0)] sticky top-0 z-[2]"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="px-3 py-2.5 flex items-center">
              <Checkbox
                checked={selection.size === filtered.length && filtered.length > 0}
                onChange={toggleAll}
              />
            </div>
            <SortHeader label="Company" sortKey="company" sort={sort} onClick={toggleSort} />
            <SortHeader label="Campaign" sortKey="campaign" sort={sort} onClick={toggleSort} />
            <SortHeader label="Website" />
            <SortHeader
              label="Last touched"
              sortKey="lastTouched"
              sort={sort}
              onClick={toggleSort}
            />
            <SortHeader label="State" sortKey="state" sort={sort} onClick={toggleSort} />
            <SortHeader label="Engagement" />
            <SortHeader label="Msgs" sortKey="msgs" sort={sort} onClick={toggleSort} alignRight />
            <SortHeader label="" />
          </div>

          {/* Data rows */}
          {filtered.length === 0 ? (
            <div className="px-5 py-10">
              <EmptyState>No leads match the current search query or filters.</EmptyState>
            </div>
          ) : (
            filtered.map((lead, idx) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                idx={idx}
                density={density}
                rowPad={rowPad}
                gridCols={gridCols}
                selected={selection.has(lead.id)}
                onToggle={() => toggle(lead.id)}
                onEdit={() => {
                  setEditingLead(lead);
                  setEditForm({
                    companyName: lead.companyName,
                    email: lead.email || "",
                    website: lead.website || "",
                    state: lead.state,
                  });
                  setUpdateError(null);
                }}
                onDelete={() => setDeletingLead(lead)}
                onSend={() => handleSend(lead.id)}
                onScript={() => openScript(lead)}
                sending={sending === lead.id}
                removing={removing === lead.id}
                sendError={sendError?.id === lead.id ? sendError.msg : null}
              />
            ))
          )}
        </div>
      )}

      {/* Edit Lead Modal */}
      <Dialog
        open={editingLead !== null}
        onClose={() => setEditingLead(null)}
        title="Edit Lead Details"
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingLead(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-lead-form"
              disabled={updating}
              iconStart={updating ? "refresh" : undefined}
            >
              {updating ? "Saving…" : "Save Changes"}
            </Button>
          </>
        }
      >
        {updateError && (
          <Toast kind="hot" pill="ERROR" className="mb-4">
            {updateError}
          </Toast>
        )}
        <form id="edit-lead-form" onSubmit={handleUpdateLead} className="flex flex-col gap-4">
          <Input
            label="Company Name"
            required
            value={editForm.companyName}
            onChange={(e) => setEditForm((p) => ({ ...p, companyName: e.target.value }))}
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="contact@company.com"
            value={editForm.email}
            onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
          />
          <Input
            label="Website URL"
            placeholder="https://company.com"
            value={editForm.website}
            onChange={(e) => setEditForm((p) => ({ ...p, website: e.target.value }))}
          />
          <div>
            <Label>Lead State</Label>
            <Select
              value={editForm.state}
              onChange={(e) => setEditForm((p) => ({ ...p, state: e.target.value }))}
            >
              {STATE_KEYS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </form>
      </Dialog>

      {/* Delete Lead Modal */}
      <Dialog
        open={deletingLead !== null}
        onClose={() => setDeletingLead(null)}
        title="Confirm Deletion"
        dotColor="var(--hot)"
        width={400}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingLead(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deletingLead ? removing === deletingLead.id : false}
              onClick={() => deletingLead && handleRemove(deletingLead.id)}
            >
              {deletingLead && removing === deletingLead.id ? "Deleting…" : "Delete Lead"}
            </Button>
          </>
        }
      >
        {deletingLead && (
          <div className="flex flex-col gap-3">
            <p className="font-mono text-[12px] text-fg-3 leading-relaxed m-0">
              Are you sure you want to delete{" "}
              <strong className="text-fg-1 font-semibold">{deletingLead.companyName}</strong>?
            </p>
            <p className="font-mono text-[11px] text-fg-4 leading-relaxed bg-[oklch(0.13_0_0)] p-2.5 rounded border border-border-soft m-0">
              This action will hide the lead from your active lists. Any scheduled campaign
              follow-ups will be halted.
            </p>
          </div>
        )}
      </Dialog>

      {/* Call Script Modal (phone-only leads with no email) */}
      <Dialog
        open={scriptLead !== null}
        onClose={() => setScriptLead(null)}
        title="Phone call script"
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setScriptLead(null)}>
              Close
            </Button>
            <Button onClick={copyScript} disabled={!script || scriptLoading}>
              {scriptCopied ? "Copied" : "Copy script"}
            </Button>
          </>
        }
      >
        {scriptLead && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-sans text-[13px] text-fg-1 font-medium">
                {scriptLead.companyName}
              </span>
              {scriptLead.phone && (
                <a
                  href={`tel:${scriptLead.phone}`}
                  className="font-mono text-[12px] text-amber hover:underline"
                >
                  {scriptLead.phone}
                </a>
              )}
            </div>
            {scriptLead.address && (
              <p className="font-mono text-[11px] text-fg-4 m-0">{scriptLead.address}</p>
            )}
            {scriptError ? (
              <Toast kind="hot" pill="ERROR">
                {scriptError}
              </Toast>
            ) : scriptLoading ? (
              <p className="font-mono text-[12px] text-fg-4 m-0">generating script…</p>
            ) : (
              <p className="font-mono text-[12px] text-fg-2 leading-relaxed whitespace-pre-wrap bg-[oklch(0.13_0_0)] p-3 rounded border border-border-soft m-0">
                {script}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={[
        "w-3.5 h-3.5 p-0 rounded-[3px] cursor-pointer flex items-center justify-center border transition-colors duration-150",
        checked
          ? "border-amber bg-amber"
          : "border-[oklch(0.30_0_0)] bg-transparent hover:border-fg-4",
      ].join(" ")}
    >
      {checked && <Icon name="check" size={10} className="text-canvas" />}
    </button>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onClick,
  alignRight,
}: {
  label: string;
  sortKey?: SortKey;
  sort?: { key: SortKey; dir: SortDir };
  onClick?: (key: SortKey) => void;
  alignRight?: boolean;
}) {
  if (!sortKey) {
    return (
      <div
        className={[
          "px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-4 flex items-center",
          alignRight ? "justify-end" : "",
        ].join(" ")}
      >
        {label}
      </div>
    );
  }
  const isActive = sort?.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onClick?.(sortKey)}
      className={[
        "px-3 py-2.5 bg-transparent border-0 cursor-pointer font-mono text-[10px] uppercase tracking-[0.08em] flex items-center gap-1 transition-colors duration-150",
        isActive ? "text-fg-1" : "text-fg-4 hover:text-fg-3",
        alignRight ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className={isActive ? "opacity-100" : "opacity-40"}>
        <Icon name={isActive && sort?.dir === "asc" ? "arrowUp" : "arrowDown"} size={10} />
      </span>
    </button>
  );
}

function LeadRow({
  lead,
  idx,
  density,
  rowPad,
  gridCols,
  selected,
  onToggle,
  onEdit,
  onDelete,
  onSend,
  onScript,
  sending,
  removing,
  sendError,
}: {
  lead: Lead;
  idx: number;
  density: "comfortable" | "compact";
  rowPad: string;
  gridCols: string;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSend: () => void;
  onScript: () => void;
  sending: boolean;
  removing: boolean;
  sendError: string | null;
}) {
  const msgs = lead._count.messages;
  const engagement = Math.min(
    100,
    msgs * 18 + (lead.state === "replied" || lead.state === "converted" ? 30 : 0)
  );
  const engColor =
    lead.state === "replied" || lead.state === "converted"
      ? "var(--success)"
      : engagement > 0
        ? "var(--amber)"
        : "oklch(0.18 0 0)";
  const alreadySent = SENT_STATES.has(lead.state);
  const lastTouched = relativeTime(lead.updatedAt ?? lead.createdAt);
  const phoneOnly = !lead.email && !!lead.phone;
  const verifyMark =
    lead.email && lead.emailStatus === "verified" ? " ✓"
    : lead.email && lead.emailStatus === "catch_all" ? " ~"
    : "";
  const subtitle =
    (lead.email ? lead.email + verifyMark : "") ||
    lead.phone ||
    (lead.website ? truncateUrl(lead.website) : "");

  return (
    <div
      className="grid border-b border-border-soft last:border-b-0 group hover:bg-[oklch(0.12_0_0)] transition-colors duration-100"
      style={{
        gridTemplateColumns: gridCols,
        background: idx % 2 === 0 ? "var(--surface)" : "oklch(0.135 0 0)",
      }}
    >
      <div className={`px-3 ${rowPad} flex items-center`} onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onChange={onToggle} />
      </div>

      {/* Company */}
      <div className={`px-3 ${rowPad} flex items-center gap-2.5 min-w-0`}>
        <Avatar name={lead.companyName} size={22} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p
              className="font-sans text-[13px] text-fg-1 m-0 leading-tight font-medium tracking-[-0.01em] truncate"
              title={lead.companyName}
            >
              {lead.companyName}
            </p>
            <CategoryBadge category={lead.category} size="sm" />
          </div>
          {density !== "compact" && subtitle && (
            <p className="font-mono text-[10.5px] text-fg-4 m-0 mt-px truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Campaign */}
      <div
        className={`px-3 ${rowPad} font-mono text-[11px] text-fg-3 flex items-center min-w-0 truncate`}
      >
        {lead.campaign.name}
      </div>

      {/* Website */}
      <div className={`px-3 ${rowPad} flex items-center min-w-0`}>
        {lead.website ? (
          <a
            href={lead.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[11px] text-info hover:text-fg-1 transition-colors truncate flex items-center gap-1 min-w-0"
            title={lead.website}
          >
            <span className="truncate">{truncateUrl(lead.website)}</span>
            <Icon name="arrow" size={9} className="shrink-0" />
          </a>
        ) : (
          <span className="font-mono text-[11px] text-fg-5">—</span>
        )}
      </div>

      {/* Last touched */}
      <div className={`px-3 ${rowPad} font-mono text-[11px] text-fg-4 flex items-center`}>
        {lastTouched}
      </div>

      {/* State */}
      <div className={`px-3 ${rowPad} flex items-center`}>
        <StateBadge state={lead.state} />
      </div>

      {/* Engagement */}
      <div className={`px-3 ${rowPad} flex items-center gap-1.5`}>
        <div className="flex-1 h-1 bg-[oklch(0.16_0_0)] rounded-sm overflow-hidden">
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${engagement}%`, background: engColor }}
          />
        </div>
      </div>

      {/* Messages */}
      <div
        className={`px-3 ${rowPad} flex items-center justify-end font-mono text-[12px] tabular-nums`}
        style={{ color: msgs > 0 ? "var(--amber)" : "var(--fg-5)" }}
      >
        {msgs}
      </div>

      {/* Actions */}
      <div
        className="px-2 py-1.5 flex flex-col justify-center items-end gap-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
          {lead.email ? (
            <Button
              size="sm"
              variant="tinted"
              onClick={onSend}
              disabled={sending || alreadySent}
              title={alreadySent ? `Already ${lead.state}` : "Send personalized email"}
            >
              {sending ? "…" : "Send"}
            </Button>
          ) : phoneOnly ? (
            <>
              <Button
                size="sm"
                variant="tinted"
                onClick={onScript}
                title="No email — generate a phone call script"
              >
                Script
              </Button>
              <WhatsAppButton
                leadId={lead.id}
                phone={lead.phone!}
                companyName={lead.companyName}
              />
            </>
          ) : lead.hasContactForm && lead.website ? (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              title="No email — reach out via their website contact form"
              className="font-mono text-[11px] text-info hover:underline px-1"
            >
              Form
            </a>
          ) : lead.facebookUrl ? (
            <a
              href={lead.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="No email — message their Facebook page"
              className="font-mono text-[11px] text-info hover:underline px-1"
            >
              FB
            </a>
          ) : (
            <Button size="sm" variant="tinted" disabled title="No contact info">
              Send
            </Button>
          )}
          <button
            type="button"
            onClick={onEdit}
            title="Edit lead details"
            className="bg-transparent border-0 text-fg-4 hover:text-fg-2 cursor-pointer p-1 flex"
          >
            <Icon name="pencil" size={11} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={removing}
            title="Remove lead"
            className="bg-transparent border-0 text-fg-4 hover:text-hot cursor-pointer p-1 flex"
          >
            <Icon name="x" size={11} />
          </button>
        </div>
        {sendError && (
          <p className="font-mono text-[9px] text-hot leading-none m-0">{sendError}</p>
        )}
      </div>
    </div>
  );
}
