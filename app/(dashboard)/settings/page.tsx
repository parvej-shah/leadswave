"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Icon,
  Input,
  Label,
  Select,
  Textarea,
  Toast,
  Toggle,
} from "@/components/ui";
import { Eye, EyeOff } from "lucide-react";

type Settings = {
  offerText: string;
  fromName: string;
  fromEmail: string;
  resendApiKey: string;
  firecrawlApiKey: string;
  anthropicApiKey: string;
  emailVerifierApiKey: string;
  enrichmentProvider: string;
  enrichmentApiKey: string;
  apifyApiKey: string;
  googleMapsApiKey: string;
  telegramChatId: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string;
  calendarId: string;
  dailySendLimit: number;
  perCampaignDailyLimit: number;
  sendThrottleSeconds: number;
  autoSendReplies: boolean;
  notifyHotOnly: boolean;
  notifyEmailDigest: boolean;
};

type TabKey = "outreach" | "keys" | "calendar" | "limits" | "notifications" | "connection";

const TABS: { key: TabKey; label: string }[] = [
  { key: "outreach", label: "Outreach" },
  { key: "keys", label: "API Keys" },
  { key: "calendar", label: "Calendar" },
  { key: "limits", label: "Sending Limits" },
  { key: "notifications", label: "Notifications" },
  { key: "connection", label: "Connection" },
];

const DEFAULTS: Settings = {
  offerText: "",
  fromName: "",
  fromEmail: "",
  resendApiKey: "",
  firecrawlApiKey: "",
  anthropicApiKey: "",
  emailVerifierApiKey: "",
  enrichmentProvider: "hunter",
  enrichmentApiKey: "",
  apifyApiKey: "",
  googleMapsApiKey: "",
  telegramChatId: "",
  googleClientId: "",
  googleClientSecret: "",
  googleRefreshToken: "",
  calendarId: "primary",
  dailySendLimit: 100,
  perCampaignDailyLimit: 50,
  sendThrottleSeconds: 30,
  autoSendReplies: false,
  notifyHotOnly: false,
  notifyEmailDigest: false,
};

function SecretInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col">
      <Label>{label}</Label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full box-border bg-[oklch(0.13_0_0)] border border-[oklch(0.22_0_0)] focus:border-amber rounded-md pl-3 pr-9 py-2 text-fg-2 font-mono text-[13px] outline-none transition-colors duration-150"
        />
        <button
          type="button"
          onClick={() => setShow((p) => !p)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-4 hover:text-fg-2 p-1 flex cursor-pointer"
          tabIndex={-1}
        >
          {show ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const googleConnected = searchParams.get("google_connected") === "1";
  const googleError = searchParams.get("google_error");

  const [tab, setTab] = useState<TabKey>("outreach");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState<Settings>(DEFAULTS);

  type GoogleProfile = { connected: boolean; name?: string; email?: string; image?: string };
  const [googleProfile, setGoogleProfile] = useState<GoogleProfile | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [digestResult, setDigestResult] = useState<"sent" | "error" | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/auth/google/profile").then((r) => r.json()),
    ])
      .then(([data, profile]) => {
        setForm({
          ...DEFAULTS,
          ...Object.fromEntries(
            Object.entries(data).filter(([, v]) => v !== null && v !== undefined)
          ),
        });
        setGoogleProfile(profile);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaveState("idle");
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/auth/google/disconnect", { method: "DELETE" });
      setGoogleProfile({ connected: false });
      setForm((prev) => ({ ...prev, googleRefreshToken: "" }));
    } catch {
      // ignore
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSendDigest() {
    setSendingDigest(true);
    setDigestResult(null);
    try {
      const res = await fetch("/api/cron/digest");
      setDigestResult(res.ok ? "sent" : "error");
    } catch {
      setDigestResult("error");
    } finally {
      setSendingDigest(false);
      setTimeout(() => setDigestResult(null), 3000);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveState("idle");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Save failed");
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setSaveState("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl">
        <div className="mb-6">
          <div className="h-6 w-32 rounded ds-pulse mb-2 bg-[oklch(0.18_0_0)]" />
          <div className="h-4 w-64 rounded ds-pulse bg-[oklch(0.16_0_0)]" />
        </div>
        <div className="flex flex-col gap-3">
          {[120, 60, 60, 60].map((h, i) => (
            <div
              key={i}
              className="rounded-xl ds-pulse bg-[oklch(0.13_0_0)] border border-border"
              style={{ height: `${h}px`, animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="ds-h1 m-0 mb-1">Settings</h1>
        <p className="font-mono text-[12px] text-fg-4 m-0">
          Configure your outreach pipeline, API credentials, and limits.
        </p>
      </div>

      {/* Google connect status */}
      {googleConnected && (
        <Toast kind="success" pill="CONNECTED">
          Google Calendar connected successfully.
        </Toast>
      )}
      {googleError && (
        <Toast kind="hot" pill="ERROR">
          Google auth error: {googleError}. Make sure Client ID and Secret are saved first.
        </Toast>
      )}

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-border -mb-px">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                "px-3.5 py-2.5 bg-transparent border-0 cursor-pointer font-mono text-[12px] -mb-px transition-colors duration-150",
                isActive
                  ? "text-amber border-b-2 border-amber"
                  : "text-fg-3 border-b-2 border-transparent hover:text-fg-2",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {tab === "outreach" && (
          <Card>
            <CardHeader>Outreach Setup</CardHeader>
            <CardBody className="flex flex-col gap-4">
              <Textarea
                label="Offer description"
                rows={5}
                placeholder="We help B2B SaaS companies cut churn by 30% in 90 days using behavioral email sequences."
                value={form.offerText}
                onChange={(e) => set("offerText", e.target.value)}
                hint="The AI personalizes this per lead — keep it concise and outcome-focused."
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="From name"
                  placeholder="Alex Kim"
                  value={form.fromName}
                  onChange={(e) => set("fromName", e.target.value)}
                />
                <Input
                  label="From email"
                  type="email"
                  placeholder="alex@yourdomain.com"
                  value={form.fromEmail}
                  onChange={(e) => set("fromEmail", e.target.value)}
                />
              </div>
            </CardBody>
          </Card>
        )}

        {tab === "keys" && (
          <Card>
            <CardHeader>API Keys</CardHeader>
            <CardBody className="flex flex-col gap-4">
              <SecretInput
                label="Resend API key"
                placeholder="re_••••••••••••••••••••••••••••••••"
                value={form.resendApiKey}
                onChange={(v) => set("resendApiKey", v)}
              />
              <SecretInput
                label="Firecrawl API key"
                placeholder="fc-••••••••••••••••••••••••••••••••"
                value={form.firecrawlApiKey}
                onChange={(v) => set("firecrawlApiKey", v)}
              />
              <SecretInput
                label="Anthropic API key"
                placeholder="sk-ant-••••••••••••••••••••••••••••••"
                value={form.anthropicApiKey}
                onChange={(v) => set("anthropicApiKey", v)}
              />
              <SecretInput
                label="Google Maps API key"
                placeholder="AIza••••••••••••••••••••••••••••••••••"
                value={form.googleMapsApiKey}
                onChange={(v) => set("googleMapsApiKey", v)}
              />
              <SecretInput
                label="Email verifier API key (MillionVerifier)"
                placeholder="••••••••••••••••••••••••••••••••"
                value={form.emailVerifierApiKey}
                onChange={(v) => set("emailVerifierApiKey", v)}
              />
              <Select
                label="Email enrichment provider"
                value={form.enrichmentProvider}
                onChange={(e) => set("enrichmentProvider", e.target.value)}
              >
                <option value="hunter">Hunter.io</option>
                <option value="anymailfinder">Anymailfinder</option>
                <option value="apify">Apify</option>
              </Select>
              <SecretInput
                label="Email enrichment API key"
                placeholder="••••••••••••••••••••••••••••••••"
                value={form.enrichmentApiKey}
                onChange={(v) => set("enrichmentApiKey", v)}
              />
              <SecretInput
                label="Apify API token (fallback when Hunter quota runs out)"
                placeholder="apify_api_••••••••••••••••••••••••••••"
                value={form.apifyApiKey}
                onChange={(v) => set("apifyApiKey", v)}
              />
            </CardBody>
          </Card>
        )}

        {tab === "calendar" && (
          <Card>
            <CardHeader>Google Calendar</CardHeader>
            <CardBody className="flex flex-col gap-4">
              <Input
                label="Calendar ID"
                placeholder="primary"
                value={form.calendarId}
                onChange={(e) => set("calendarId", e.target.value)}
                hint='Use "primary" for your main calendar, or paste a specific calendar ID.'
              />
              <div>
                <Label>Calendar connection</Label>
                {form.googleRefreshToken ? (
                  <div className="flex items-center gap-2 font-mono text-[12px] text-success">
                    <Icon name="check" size={14} />
                    connected via Google sign-in
                  </div>
                ) : (
                  <p className="font-mono text-[12px] text-fg-4 m-0">
                    Sign out and sign back in with Google to connect your calendar.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {tab === "limits" && (
          <Card>
            <CardHeader>Sending Limits</CardHeader>
            <CardBody className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Daily send limit"
                  type="number"
                  min={1}
                  max={500}
                  value={form.dailySendLimit}
                  onChange={(e) =>
                    set(
                      "dailySendLimit",
                      Math.min(500, Math.max(1, parseInt(e.target.value) || 1))
                    )
                  }
                  hint="Max emails sent per 24h across all campaigns (max 500)"
                />
                <Input
                  label="Per-campaign daily limit"
                  type="number"
                  min={1}
                  max={500}
                  value={form.perCampaignDailyLimit}
                  onChange={(e) =>
                    set(
                      "perCampaignDailyLimit",
                      Math.min(500, Math.max(1, parseInt(e.target.value) || 1))
                    )
                  }
                  hint="Max emails per campaign per day (max 500)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Throttle (seconds between sends)"
                  type="number"
                  min={0}
                  max={3600}
                  value={form.sendThrottleSeconds}
                  onChange={(e) =>
                    set(
                      "sendThrottleSeconds",
                      Math.min(3600, Math.max(0, parseInt(e.target.value) || 0))
                    )
                  }
                  hint="Minimum gap between outbound emails (0 = no delay)"
                />
                <div>
                  <Label>Auto-send replies</Label>
                  <div className="mt-1">
                    <Toggle
                      checked={form.autoSendReplies}
                      onChange={(v) => set("autoSendReplies", v)}
                      label={form.autoSendReplies ? "enabled" : "disabled"}
                    />
                  </div>
                  <p className="font-mono text-[11px] text-fg-4 mt-1.5">
                    AI auto-replies to incoming leads.
                  </p>
                </div>
              </div>
              <div className="px-3.5 py-2.5 bg-info-tinted-surface border border-info-border rounded-md flex gap-2.5 items-start">
                <Icon name="pulse" size={14} className="text-info mt-0.5" />
                <p className="font-mono text-[11px] text-info m-0 leading-[1.55]">
                  LeadsWave paces sends throughout the day to stay under your daily cap. Per-campaign and throttle limits apply on top.
                </p>
              </div>
            </CardBody>
          </Card>
        )}

        {tab === "notifications" && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>Telegram</CardHeader>
              <CardBody className="flex flex-col gap-4">
                <Input
                  label="Telegram Chat ID"
                  value={form.telegramChatId}
                  readOnly
                  placeholder="—"
                  hint="Auto-detected from your Telegram bot. Send any message to your bot to populate this."
                />
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[12.5px] text-fg-2 m-0">HOT-only alerts</p>
                      <p className="font-mono text-[11px] text-fg-4 m-0 mt-0.5">
                        Only send Telegram pings for HOT leads and meeting bookings. Warm "has a question" pings are suppressed.
                      </p>
                    </div>
                    <Toggle
                      checked={form.notifyHotOnly}
                      onChange={(v) => set("notifyHotOnly", v)}
                      label={form.notifyHotOnly ? "enabled" : "disabled"}
                    />
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[12.5px] text-fg-2 m-0">Daily digest</p>
                      <p className="font-mono text-[11px] text-fg-4 m-0 mt-0.5">
                        Send a daily summary to Telegram every morning with yesterday's sends, replies, hot leads, and meetings.
                      </p>
                    </div>
                    <Toggle
                      checked={form.notifyEmailDigest}
                      onChange={(v) => set("notifyEmailDigest", v)}
                      label={form.notifyEmailDigest ? "enabled" : "disabled"}
                    />
                  </div>
                </div>
                {form.notifyEmailDigest && form.telegramChatId && (
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={sendingDigest}
                      onClick={handleSendDigest}
                    >
                      {sendingDigest ? "Sending…" : "Send digest now"}
                    </Button>
                    {digestResult === "sent" && (
                      <span className="font-mono text-[11px] text-success">Sent ✓</span>
                    )}
                    {digestResult === "error" && (
                      <span className="font-mono text-[11px] text-hot">Failed — check Telegram config</span>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}

        {tab === "connection" && (
          <Card>
            <CardHeader>Google Account</CardHeader>
            <CardBody className="flex flex-col gap-5">
              {googleProfile?.connected ? (
                <div className="flex items-center gap-4">
                  {googleProfile.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={googleProfile.image}
                      alt={googleProfile.name ?? "Google account"}
                      className="w-10 h-10 rounded-full border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full border border-border bg-[oklch(0.18_0_0)] flex items-center justify-center shrink-0">
                      <Icon name="users" size={16} className="text-fg-4" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[13px] text-fg-1 m-0 truncate">
                      {googleProfile.name ?? "—"}
                    </p>
                    <p className="font-mono text-[11px] text-fg-4 m-0 truncate">
                      {googleProfile.email ?? "—"}
                    </p>
                    <p className="font-mono text-[10px] text-fg-5 m-0 mt-0.5">
                      Calendar · Read &amp; Send
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        window.location.href = "/api/auth/signin/google";
                      }}
                    >
                      Reconnect
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={disconnecting}
                      onClick={handleDisconnect}
                    >
                      {disconnecting ? "Disconnecting…" : "Disconnect"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="font-mono text-[12px] text-fg-4 m-0">
                    No Google account connected. Sign in with Google to enable Calendar and Gmail integration.
                  </p>
                  <div>
                    <Button
                      type="button"
                      onClick={() => {
                        window.location.href = "/api/auth/signin/google";
                      }}
                    >
                      Connect Google Account
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* Save bar */}
        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button type="submit" disabled={saving} iconStart={saving ? "refresh" : undefined}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
          {saveState === "saved" && (
            <Toast kind="success" pill="SAVED">
              Settings saved
            </Toast>
          )}
          {saveState === "error" && (
            <Toast kind="hot" pill="ERROR">
              {errorMsg}
            </Toast>
          )}
        </div>
      </form>
    </div>
  );
}
