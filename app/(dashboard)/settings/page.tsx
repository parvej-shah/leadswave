"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Settings = {
  offerText?: string;
  fromName?: string;
  fromEmail?: string;
  resendApiKey?: string;
  firecrawlApiKey?: string;
  anthropicApiKey?: string;
  telegramChatId?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRefreshToken?: string;
  calendarId?: string;
  dailySendLimit?: number;
  autoSendReplies?: boolean;
};

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded animate-pulse ${className}`}
      style={{ background: "oklch(0.18 0 0)", ...style }}
    />
  );
}

const AMBER = "oklch(0.78 0.18 65)";
const AMBER_DIM = "oklch(0.55 0.14 65)";

const focusStyle = {
  borderColor: AMBER,
  boxShadow: `0 0 0 1px ${AMBER}22`,
};

const inputStyle = {
  background: "oklch(0.13 0 0)",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "oklch(0.22 0 0)",
  color: "oklch(0.90 0 0)",
  fontFamily: "'DM Mono', 'Fira Mono', 'Cascadia Code', monospace",
  fontSize: "0.8125rem",
  outline: "none",
  transition: "border-color 0.15s",
} as React.CSSProperties;

function FocusInput({
  type = "text",
  value,
  onChange,
  placeholder = "",
  readOnly = false,
  min,
  max,
}: {
  type?: string;
  value: string | number;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  min?: number;
  max?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      readOnly={readOnly}
      min={min}
      max={max}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputStyle,
        ...(focused ? focusStyle : {}),
        ...(readOnly ? { color: "oklch(0.50 0 0)", cursor: "default" } : {}),
      }}
      className="w-full px-3 py-2 rounded"
    />
  );
}

function FocusTextarea({
  value,
  onChange,
  placeholder = "",
  rows = 5,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputStyle,
        ...(focused ? focusStyle : {}),
        resize: "vertical",
      }}
      className="w-full px-3 py-2 rounded"
    />
  );
}

function SecretInput({
  value,
  onChange,
  placeholder,
  show,
  onToggle,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...inputStyle,
          ...(focused ? focusStyle : {}),
          paddingRight: "2.5rem",
        }}
        className="w-full px-3 py-2 rounded"
      />
      <button
        type="button"
        onClick={onToggle}
        style={{ color: "oklch(0.45 0 0)" }}
        className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-80 transition-opacity"
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const googleConnected = searchParams.get("google_connected") === "1";
  const googleError = searchParams.get("google_error");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [showFirecrawl, setShowFirecrawl] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showGoogleSecret, setShowGoogleSecret] = useState(false);

  const [form, setForm] = useState<Settings>({
    offerText: "",
    fromName: "",
    fromEmail: "",
    resendApiKey: "",
    firecrawlApiKey: "",
    anthropicApiKey: "",
    telegramChatId: "",
    googleClientId: "",
    googleClientSecret: "",
    googleRefreshToken: "",
    calendarId: "primary",
    dailySendLimit: 100,
    autoSendReplies: false,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setForm({
          offerText: data.offerText ?? "",
          fromName: data.fromName ?? "",
          fromEmail: data.fromEmail ?? "",
          resendApiKey: data.resendApiKey ?? "",
          firecrawlApiKey: data.firecrawlApiKey ?? "",
          anthropicApiKey: data.anthropicApiKey ?? "",
          telegramChatId: data.telegramChatId ?? "",
          googleClientId: data.googleClientId ?? "",
          googleClientSecret: data.googleClientSecret ?? "",
          googleRefreshToken: data.googleRefreshToken ?? "",
          calendarId: data.calendarId ?? "primary",
          dailySendLimit: data.dailySendLimit ?? 100,
          autoSendReplies: data.autoSendReplies ?? false,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaveState("idle");
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
    } catch (err: unknown) {
      setSaveState("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  function SectionHeader({ label, index }: { label: string; index: number }) {
    return (
      <div className="flex items-center gap-3 mb-5" style={{ animationDelay: `${index * 60}ms` }}>
        <span
          style={{
            fontFamily: "'DM Mono', 'Fira Mono', monospace",
            fontSize: "0.6875rem",
            letterSpacing: "0.12em",
            color: AMBER_DIM,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <div style={{ flex: 1, height: "1px", background: "oklch(0.20 0 0)" }} />
      </div>
    );
  }

  function Label({ children }: { children: React.ReactNode }) {
    return (
      <label
        style={{
          fontFamily: "'DM Mono', 'Fira Mono', monospace",
          fontSize: "0.75rem",
          color: "oklch(0.55 0 0)",
          letterSpacing: "0.02em",
          display: "block",
          marginBottom: "0.375rem",
        }}
      >
        {children}
      </label>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl">
        <div className="mb-8">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-6">
          {[120, 40, 40, 40, 40, 40, 40].map((h, i) => (
            <Skeleton key={i} style={{ height: `${h}px` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');
        .settings-field { animation: fadeUp 0.25s ease both; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="mb-8 settings-field">
        <h1
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: "1.125rem",
            fontWeight: 500,
            color: "oklch(0.88 0 0)",
            letterSpacing: "-0.01em",
            marginBottom: "0.25rem",
          }}
        >
          Settings
        </h1>
        <p style={{ fontSize: "0.8125rem", color: "oklch(0.45 0 0)", fontFamily: "inherit" }}>
          Configure your outreach pipeline, API credentials, and limits.
        </p>
      </div>

      {googleConnected && (
        <div
          className="mb-6 px-4 py-3 rounded text-sm settings-field"
          style={{ background: "oklch(0.15 0.04 145)", border: "1px solid oklch(0.25 0.06 145)", color: "oklch(0.72 0.18 145)", fontFamily: "'DM Mono', monospace" }}
        >
          ✓ Google Calendar connected successfully.
        </div>
      )}
      {googleError && (
        <div
          className="mb-6 px-4 py-3 rounded text-sm settings-field"
          style={{ background: "oklch(0.16 0.04 25)", border: "1px solid oklch(0.26 0.06 25)", color: "oklch(0.72 0.18 25)", fontFamily: "'DM Mono', monospace" }}
        >
          Google auth error: {googleError}. Make sure Client ID and Secret are saved first.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* OUTREACH SETUP */}
        <section className="settings-field" style={{ animationDelay: "40ms" }}>
          <SectionHeader label="Outreach Setup" index={0} />
          <div className="space-y-4">
            <div>
              <Label>Offer description</Label>
              <FocusTextarea
                value={form.offerText ?? ""}
                onChange={(v) => set("offerText", v)}
                placeholder="We help B2B SaaS companies cut churn by 30% in 90 days using behavioral email sequences. No long-term contracts."
                rows={5}
              />
              <p style={{ fontSize: "0.7rem", color: "oklch(0.40 0 0)", marginTop: "0.375rem", fontFamily: "monospace" }}>
                The AI personalizes this per lead — keep it concise and outcome-focused.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From name</Label>
                <FocusInput
                  value={form.fromName ?? ""}
                  onChange={(v) => set("fromName", v)}
                  placeholder="Alex Kim"
                />
              </div>
              <div>
                <Label>From email</Label>
                <FocusInput
                  type="email"
                  value={form.fromEmail ?? ""}
                  onChange={(v) => set("fromEmail", v)}
                  placeholder="alex@yourdomain.com"
                />
              </div>
            </div>
          </div>
        </section>

        {/* API KEYS */}
        <section className="settings-field" style={{ animationDelay: "80ms" }}>
          <SectionHeader label="API Keys" index={1} />
          <div className="space-y-4">
            <div>
              <Label>Resend API key</Label>
              <SecretInput
                value={form.resendApiKey ?? ""}
                onChange={(v) => set("resendApiKey", v)}
                placeholder="re_••••••••••••••••••••••••••••••••"
                show={showResend}
                onToggle={() => setShowResend((p) => !p)}
              />
            </div>
            <div>
              <Label>Firecrawl API key</Label>
              <SecretInput
                value={form.firecrawlApiKey ?? ""}
                onChange={(v) => set("firecrawlApiKey", v)}
                placeholder="fc-••••••••••••••••••••••••••••••••"
                show={showFirecrawl}
                onToggle={() => setShowFirecrawl((p) => !p)}
              />
            </div>
            <div>
              <Label>Anthropic API key</Label>
              <SecretInput
                value={form.anthropicApiKey ?? ""}
                onChange={(v) => set("anthropicApiKey", v)}
                placeholder="sk-ant-••••••••••••••••••••••••••••••"
                show={showAnthropic}
                onToggle={() => setShowAnthropic((p) => !p)}
              />
            </div>
          </div>
        </section>

        {/* NOTIFICATIONS */}
        <section className="settings-field" style={{ animationDelay: "120ms" }}>
          <SectionHeader label="Notifications" index={2} />
          <div>
            <Label>Telegram Chat ID</Label>
            <FocusInput
              value={form.telegramChatId ?? ""}
              readOnly
              placeholder="—"
            />
            <p style={{ fontSize: "0.7rem", color: "oklch(0.40 0 0)", marginTop: "0.375rem", fontFamily: "monospace" }}>
              Auto-detected from your Telegram bot. Send any message to your bot to populate this.
            </p>
          </div>
        </section>

        {/* GOOGLE CALENDAR */}
        <section className="settings-field" style={{ animationDelay: "140ms" }}>
          <SectionHeader label="Google Calendar" index={3} />
          <div className="space-y-4">
            <div>
              <Label>Calendar ID</Label>
              <FocusInput
                value={form.calendarId ?? "primary"}
                onChange={(v) => set("calendarId", v)}
                placeholder="primary"
              />
              <p style={{ fontSize: "0.7rem", color: "oklch(0.40 0 0)", marginTop: "0.375rem", fontFamily: "monospace" }}>
                Use "primary" for your main calendar, or paste a specific calendar ID.
              </p>
            </div>
            <div>
              <Label>Calendar connection</Label>
              {form.googleRefreshToken ? (
                <div className="flex items-center gap-3">
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8rem", color: "oklch(0.65 0.15 145)" }}>
                    ✓ connected via Google sign-in
                  </span>
                </div>
              ) : (
                <p style={{ fontSize: "0.8rem", color: "oklch(0.50 0 0)", fontFamily: "monospace" }}>
                  Sign out and sign back in with Google to connect your calendar.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* SENDING LIMITS */}
        <section className="settings-field" style={{ animationDelay: "160ms" }}>
          <SectionHeader label="Sending Limits" index={3} />
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 items-start">
              <div>
                <Label>Daily send limit</Label>
                <FocusInput
                  type="number"
                  value={form.dailySendLimit ?? 100}
                  onChange={(v) => set("dailySendLimit", Math.min(500, Math.max(1, parseInt(v) || 1)))}
                  min={1}
                  max={500}
                />
                <p style={{ fontSize: "0.7rem", color: "oklch(0.40 0 0)", marginTop: "0.375rem", fontFamily: "monospace" }}>
                  Max 500/day
                </p>
              </div>
              <div>
                <Label>Auto-send replies</Label>
                <button
                  type="button"
                  onClick={() => set("autoSendReplies", !form.autoSendReplies)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                    marginTop: "0.125rem",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      width: "2.25rem",
                      height: "1.25rem",
                      borderRadius: "9999px",
                      background: form.autoSendReplies ? AMBER : "oklch(0.22 0 0)",
                      position: "relative",
                      transition: "background 0.2s",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: "0.1875rem",
                        left: form.autoSendReplies ? "1.125rem" : "0.1875rem",
                        width: "0.875rem",
                        height: "0.875rem",
                        borderRadius: "50%",
                        background: form.autoSendReplies ? "oklch(0.12 0 0)" : "oklch(0.40 0 0)",
                        transition: "left 0.2s, background 0.2s",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: "0.8125rem",
                      color: form.autoSendReplies ? AMBER : "oklch(0.50 0 0)",
                      transition: "color 0.2s",
                    }}
                  >
                    {form.autoSendReplies ? "enabled" : "disabled"}
                  </span>
                </button>
                <p style={{ fontSize: "0.7rem", color: "oklch(0.40 0 0)", marginTop: "0.625rem", fontFamily: "monospace" }}>
                  AI auto-replies to incoming leads
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SAVE */}
        <div
          className="settings-field flex items-center gap-4 pt-2"
          style={{ animationDelay: "200ms", borderTop: "1px solid oklch(0.18 0 0)", paddingTop: "1.5rem" }}
        >
          <button
            type="submit"
            disabled={saving}
            style={{
              background: saving ? "oklch(0.22 0 0)" : AMBER,
              color: saving ? "oklch(0.50 0 0)" : "oklch(0.10 0 0)",
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.8125rem",
              fontWeight: 500,
              letterSpacing: "0.04em",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.5rem 1.5rem",
              cursor: saving ? "not-allowed" : "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {saving ? "saving..." : "save changes"}
          </button>

          {saveState === "saved" && (
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "0.75rem",
                color: "oklch(0.65 0.15 145)",
                letterSpacing: "0.04em",
                animation: "fadeUp 0.2s ease both",
              }}
            >
              ✓ saved
            </span>
          )}
          {saveState === "error" && (
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "0.75rem",
                color: "oklch(0.65 0.20 25)",
                letterSpacing: "0.04em",
              }}
            >
              ✗ {errorMsg}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
