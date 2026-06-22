"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Avatar,
  Badge,
  Button,
  CategoryBadge,
  Icon,
  StateBadge,
  Toast,
  Input,
} from "@/components/ui";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { RichTextEditor } from "@/components/rich-text-editor";
import { RichTextViewer } from "@/components/rich-text-viewer";

type Message = {
  id: string;
  direction: "outbound" | "inbound" | "system";
  subject: string | null;
  body: string;
  bodyHtml?: string | null;
  sentAt: string;
};

type Lead = {
  id: string;
  companyName: string;
  email: string | null;
  emailStatus: string | null;
  hasContactForm: boolean | null;
  facebookUrl: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  description: string | null;
  category: string | null;
  rating: number | null;
  mapsUrl: string | null;
  state: string;
  lastTouchedAt: string | null;
  createdAt: string;
  campaign: { id: string; name: string };
  messages: Message[];
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function truncateUrl(href: string): string {
  return href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 30);
}


export default function LeadDetailPage() {
  const { id: campaignId, leadId } = useParams<{ id: string; leadId: string }>();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loadError, setLoadError] = useState("");

  // Email compose state
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sentOk, setSentOk] = useState(false);

  useEffect(() => {
    fetch(`/api/leads/${leadId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load lead");
        setLead(data);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [leadId]);

  async function handleGenerate() {
    setGenerating(true);
    setGenError("");
    setSentOk(false);
    try {
      const res = await fetch("/api/agents/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const text = await res.text();
      let data: Record<string, string>;
      try {
        data = JSON.parse(text);
      } catch {
        setGenError("Invalid response from server");
        return;
      }
      if (!res.ok) {
        setGenError(data.error ?? "Failed to generate email");
        return;
      }
      setComposeSubject(data.subject ?? "");
      const raw = data.body ?? "";
      const html = raw.includes("<") ? raw : raw.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
      setComposeBody(html);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!composeSubject.trim() || !composeBody.trim()) {
      setSendError("Subject and body are required.");
      return;
    }
    setSending(true);
    setSendError("");
    setSentOk(false);
    try {
      const res = await fetch("/api/agents/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, subject: composeSubject, body: composeBody }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "Failed to send email");
        return;
      }
      setSentOk(true);
      const newMsg: Message = {
        id: `optimistic-${Date.now()}`,
        direction: "outbound",
        subject: composeSubject,
        body: composeBody.replace(/<[^>]*>/g, ""),
        bodyHtml: composeBody,
        sentAt: new Date().toISOString(),
      };
      setLead((prev) =>
        prev
          ? {
              ...prev,
              state: "contacted",
              messages: [...prev.messages, newMsg],
            }
          : prev
      );
      setComposeSubject("");
      setComposeBody("");
    } finally {
      setSending(false);
    }
  }

  if (loadError) {
    return (
      <p className="font-mono text-[12px] text-hot border border-hot-border bg-hot-bg rounded-md px-3 py-2 inline-block">
        {loadError}
      </p>
    );
  }

  if (!lead) {
    return <p className="font-mono text-[13px] text-fg-4">Loading…</p>;
  }

  const canSend = !!lead.email;
  const alreadySent = ["contacted", "replied", "converted", "meeting_booked", "unsubscribed", "bounced"].includes(lead.state);

  return (
    <div className="max-w-220 mx-auto w-full py-4 flex flex-col gap-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-fg-4 flex-wrap min-w-0">
        <Link href="/campaigns" className="hover:text-fg-2 transition-colors duration-150">
          Campaigns
        </Link>
        <span>/</span>
        <Link
          href={`/campaigns/${campaignId}`}
          className="hover:text-fg-2 transition-colors duration-150"
        >
          {lead.campaign.name}
        </Link>
        <span>/</span>
        <span className="text-fg-2">{lead.companyName}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
        {/* Left: thread + compose */}
        <div className="flex flex-col gap-3 order-2 lg:order-1">
          {/* Lead name + meta */}
          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={lead.companyName} size={36} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="ds-h2 m-0">{lead.companyName}</h1>
                    <CategoryBadge category={lead.category} size="sm" />
                    <StateBadge state={lead.state} />
                  </div>
                  {lead.address && (
                    <p className="font-mono text-[11px] text-fg-4 m-0 mt-0.5">{lead.address}</p>
                  )}
                </div>
              </div>
              {lead.rating != null && (
                <div className="flex items-center gap-1 shrink-0 font-mono text-[12px]">
                  <span style={{ color: lead.rating >= 4 ? "var(--amber)" : "var(--fg-4)" }}>
                    ★
                  </span>
                  <span className="text-fg-2">{lead.rating.toFixed(1)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 flex-wrap mt-0.5">
              {lead.email && (
                <span className="font-mono text-[11px] text-fg-3">
                  {lead.email}
                  {lead.emailStatus === "verified" && (
                    <span className="text-success" title="Email verified — safe to send"> ✓</span>
                  )}
                  {lead.emailStatus === "catch_all" && (
                    <span className="text-amber" title="Catch-all domain — email is a medium-confidence guess"> ~</span>
                  )}
                  {lead.emailStatus === "invalid" && (
                    <span className="text-hot" title="Email failed verification — sending is blocked"> ✕</span>
                  )}
                </span>
              )}
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="font-mono text-[11px] text-fg-3 hover:text-fg-1 transition-colors"
                >
                  {lead.phone}
                </a>
              )}
              {lead.phone && (
                <WhatsAppButton
                  leadId={lead.id}
                  phone={lead.phone}
                  companyName={lead.companyName}
                  label="WhatsApp"
                  className="font-mono text-[11px] text-success hover:underline bg-transparent border-0 cursor-pointer p-0"
                />
              )}
              {lead.facebookUrl && (
                <a
                  href={lead.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] text-info hover:text-fg-1 transition-colors"
                >
                  Facebook ↗
                </a>
              )}
              {lead.website && (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] text-info hover:text-fg-1 transition-colors flex items-center gap-1"
                >
                  {truncateUrl(lead.website)}
                  <Icon name="arrow" size={9} />
                </a>
              )}
              {lead.mapsUrl && (
                <a
                  href={lead.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] text-fg-4 hover:text-fg-2 transition-colors"
                >
                  Maps ↗
                </a>
              )}
            </div>

            {lead.description && (
              <p className="font-mono text-[11px] text-fg-4 m-0 border-t border-border pt-2 leading-relaxed">
                {lead.description}
              </p>
            )}
          </div>

          {/* Message thread */}
          <div className="flex flex-col gap-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-fg-5 mb-2">
              Messages ({lead.messages.length})
            </p>

            {lead.messages.length === 0 ? (
              <div className="bg-surface border border-border rounded-xl px-4 py-6 text-center">
                <p className="font-mono text-[12px] text-fg-5 m-0">No messages yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {lead.messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </div>
            )}
          </div>

          {/* Compose */}
          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wider text-fg-5 m-0">
                {alreadySent ? "Send Reply" : "Send First Email"}
              </p>
              {canSend && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  iconStart="sparkle"
                  disabled={generating}
                  onClick={handleGenerate}
                >
                  {generating ? "Generating…" : "Generate Message"}
                </Button>
              )}
            </div>

            {!canSend ? (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[12px] text-fg-4 m-0">
                  No email address — reach this lead through another channel:
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  {lead.phone && (
                    <>
                      <a
                        href={`tel:${lead.phone}`}
                        className="font-mono text-[12px] text-amber hover:underline"
                      >
                        Call {lead.phone}
                      </a>
                      <WhatsAppButton
                        leadId={lead.id}
                        phone={lead.phone}
                        companyName={lead.companyName}
                        label="WhatsApp"
                        className="font-mono text-[12px] text-success hover:underline bg-transparent border-0 cursor-pointer p-0"
                      />
                    </>
                  )}
                  {lead.hasContactForm && lead.website && (
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[12px] text-info hover:underline"
                    >
                      Website contact form ↗
                    </a>
                  )}
                  {lead.facebookUrl && (
                    <a
                      href={lead.facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[12px] text-info hover:underline"
                    >
                      Facebook page ↗
                    </a>
                  )}
                  {!lead.phone && !lead.hasContactForm && !lead.facebookUrl && (
                    <span className="font-mono text-[12px] text-fg-5">
                      No known channels — try re-enriching the campaign.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <>
                <Input
                  label="Subject"
                  placeholder="Email subject…"
                  value={composeSubject}
                  onChange={(e) => {
                    setSentOk(false);
                    setComposeSubject(e.target.value);
                  }}
                  disabled={sending}
                />
                <RichTextEditor
                  label="Body"
                  placeholder="Write your message here, or click Generate Message to draft with AI…"
                  value={composeBody}
                  onChange={(html) => {
                    setSentOk(false);
                    setComposeBody(html);
                  }}
                  hint="Your signature is appended automatically."
                />

                {genError && <Toast kind="hot" pill="ERROR">{genError}</Toast>}
                {sendError && <Toast kind="hot" pill="ERROR">{sendError}</Toast>}
                {sentOk && <Toast kind="success" pill="SENT">Email sent successfully.</Toast>}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="lg"
                    iconStart={sending ? "refresh" : "check"}
                    disabled={sending || !composeSubject.trim() || !composeBody.trim()}
                    onClick={handleSend}
                  >
                    {sending ? "Sending…" : "Send Email"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: lead info sidebar */}
        <div className="flex flex-col gap-3 order-1 lg:order-2 lg:sticky lg:top-4">
          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-fg-5 m-0">Details</p>

            <InfoRow label="State">
              <StateBadge state={lead.state} />
            </InfoRow>
            <InfoRow label="Category">
              <CategoryBadge category={lead.category} size="sm" />
            </InfoRow>
            {lead.rating != null && (
              <InfoRow label="Rating">
                <span
                  className="font-mono text-[12px]"
                  style={{ color: lead.rating >= 4 ? "var(--amber)" : "var(--fg-3)" }}
                >
                  ★ {lead.rating.toFixed(1)}
                </span>
              </InfoRow>
            )}
            <InfoRow label="Added">
              <span className="font-mono text-[11px] text-fg-3">{relativeTime(lead.createdAt)}</span>
            </InfoRow>
            {lead.lastTouchedAt && (
              <InfoRow label="Last touch">
                <span className="font-mono text-[11px] text-fg-3">
                  {relativeTime(lead.lastTouchedAt)}
                </span>
              </InfoRow>
            )}
            <InfoRow label="Messages">
              <span
                className="font-mono text-[12px] tabular-nums"
                style={{ color: lead.messages.length > 0 ? "var(--amber)" : "var(--fg-4)" }}
              >
                {lead.messages.length}
              </span>
            </InfoRow>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-fg-5 m-0">Campaign</p>
            <Link
              href={`/campaigns/${campaignId}`}
              className="font-mono text-[12px] text-info hover:text-fg-1 transition-colors"
            >
              {lead.campaign.name}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === "outbound";
  const isSystem = message.direction === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="font-mono text-[10px] text-fg-5 bg-[oklch(0.14_0_0)] border border-border rounded-full px-3 py-1">
          {message.body}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-xl px-3.5 py-3 flex flex-col gap-1.5",
          isOutbound
            ? "bg-amber-bg border border-amber-border"
            : "bg-surface border border-border",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-4">
          <span
            className={[
              "font-mono text-[9px] uppercase tracking-wider",
              isOutbound ? "text-amber" : "text-info",
            ].join(" ")}
          >
            {isOutbound ? "You" : "Lead"}
          </span>
          <span className="font-mono text-[9px] text-fg-5">{relativeTime(message.sentAt)}</span>
        </div>
        {message.subject && (
          <p className="font-mono text-[11px] text-fg-3 m-0 font-medium">{message.subject}</p>
        )}
        <RichTextViewer
          html={message.bodyHtml || message.body.replace(/\n/g, "<br>")}
          className="font-mono text-[11.5px] text-fg-2 leading-relaxed"
        />
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-fg-5">{label}</span>
      {children}
    </div>
  );
}
