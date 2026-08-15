"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
  SkeletonRows,
  Badge,
  Toggle,
} from "@/components/ui";
import {
  Mail,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  Zap,
  Lock,
} from "lucide-react";

type SenderInbox = {
  id: string;
  name: string;
  fromEmail: string;
  fromName: string;
  replyToEmail?: string | null;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpSecure: boolean;
  isActive: boolean;
  dailyLimit: number;
  sentToday: number;
  warmupStatus: string;
  smtpPasswordMasked: string;
};

export function SenderInboxesPanel() {
  const [inboxes, setInboxes] = useState<SenderInbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // New inbox form state
  const [name, setName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(30);

  async function fetchInboxes() {
    try {
      const res = await fetch("/api/settings/inboxes");
      if (res.ok) {
        const data = await res.json();
        setInboxes(data.inboxes || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInboxes();
  }, []);

  function applyPreset(preset: "google" | "ms365") {
    if (preset === "google") {
      setSmtpHost("smtp.gmail.com");
      setSmtpPort(465);
      setSmtpSecure(true);
      if (fromEmail && !smtpUser) setSmtpUser(fromEmail);
    } else {
      setSmtpHost("smtp.office365.com");
      setSmtpPort(587);
      setSmtpSecure(false);
      if (fromEmail && !smtpUser) setSmtpUser(fromEmail);
    }
  }

  async function handleAddInbox(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/settings/inboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || fromEmail,
          fromEmail,
          fromName,
          replyToEmail: replyToEmail || undefined,
          smtpHost,
          smtpPort: Number(smtpPort),
          smtpUser: smtpUser || fromEmail,
          smtpPassword,
          smtpSecure,
          dailyLimit: Number(dailyLimit),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add sender inbox");
      }

      setSuccessMsg(`Inbox ${fromEmail} added and verified successfully!`);
      setShowAddModal(false);
      resetForm();
      await fetchInboxes();
    } catch (err: any) {
      setError(err.message || "Failed to add inbox");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setName("");
    setFromEmail("");
    setFromName("");
    setReplyToEmail("");
    setSmtpHost("smtp.gmail.com");
    setSmtpPort(465);
    setSmtpUser("");
    setSmtpPassword("");
    setSmtpSecure(true);
    setDailyLimit(30);
  }

  async function handleToggleActive(inbox: SenderInbox) {
    try {
      const res = await fetch(`/api/settings/inboxes/${inbox.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !inbox.isActive }),
      });
      if (res.ok) {
        setInboxes((prev) =>
          prev.map((i) =>
            i.id === inbox.id ? { ...i, isActive: !inbox.isActive } : i,
          ),
        );
      }
    } catch {
      // ignore
    }
  }

  async function handleSendTest(inboxId: string) {
    setTestingId(inboxId);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/settings/inboxes/${inboxId}/test`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test email failed");
      setSuccessMsg(data.message || "Test email delivered successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to send test email");
    } finally {
      setTestingId(null);
    }
  }

  async function handleDeleteInbox(inboxId: string, email: string) {
    if (!confirm(`Are you sure you want to delete inbox ${email}?`)) return;
    try {
      const res = await fetch(`/api/settings/inboxes/${inboxId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setInboxes((prev) => prev.filter((i) => i.id !== inboxId));
        setSuccessMsg(`Inbox ${email} deleted.`);
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-400" />
            Sender Inboxes & Multi-Inbox SMTP
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Connect your Google Workspace inboxes (e.g. <code>hello@withminions.com</code>, <code>growth@withminions.com</code>).
            LeadsWave automatically rotates between active inboxes to respect your daily limits.
          </p>
        </div>
        <Button
          onClick={() => {
            setError("");
            setShowAddModal(true);
          }}
          className="shrink-0 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Sender Inbox
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <Card>
          <CardBody>
            <SkeletonRows n={3} />
          </CardBody>
        </Card>
      ) : inboxes.length === 0 ? (
        <Card className="border-dashed border-slate-800 bg-slate-900/40">
          <CardBody className="py-12 text-center">
            <Server className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-200">No Sender Inboxes Connected</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-6">
              Add your Google Workspace mailboxes with their Google App Passwords to enable cold outreach with automatic rotation.
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Connect First Inbox
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4">
          {inboxes.map((inbox) => {
            const usagePercent = Math.min(
              100,
              Math.round((inbox.sentToday / inbox.dailyLimit) * 100),
            );

            return (
              <Card
                key={inbox.id}
                className={`transition-colors ${
                  inbox.isActive ? "border-slate-800 bg-slate-900/80" : "border-slate-800/40 bg-slate-950/40 opacity-70"
                }`}
              >
                <CardBody className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Inbox Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-100 text-base">
                          {inbox.name}
                        </span>
                        <Badge variant={inbox.isActive ? "success" : "neutral"}>
                          {inbox.isActive ? "Active" : "Paused"}
                        </Badge>
                        <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {inbox.smtpHost}:{inbox.smtpPort}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>
                          From: <strong className="text-slate-300">{inbox.fromName}</strong> &lt;{inbox.fromEmail}&gt;
                        </span>
                        {inbox.replyToEmail && (
                          <span>Reply-To: {inbox.replyToEmail}</span>
                        )}
                      </div>
                    </div>

                    {/* Quota Progress */}
                    <div className="min-w-[220px] max-w-xs space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Today's Outbound</span>
                        <span className="font-medium text-slate-200">
                          {inbox.sentToday} / {inbox.dailyLimit} sent
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            usagePercent >= 90
                              ? "bg-amber-500"
                              : usagePercent >= 100
                              ? "bg-rose-500"
                              : "bg-indigo-500"
                          }`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSendTest(inbox.id)}
                        disabled={testingId === inbox.id}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        {testingId === inbox.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        ) : (
                          <Send className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                        Test Send
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(inbox)}
                        className="text-xs"
                      >
                        {inbox.isActive ? "Pause" : "Resume"}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteInbox(inbox.id, inbox.fromEmail)}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Inbox Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-100">Connect Sender Inbox</h3>
                  <p className="text-xs text-slate-400">Google Workspace / Custom SMTP</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Presets */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => applyPreset("google")}
                className="text-xs flex-1"
              >
                <Zap className="w-3.5 h-3.5 mr-1 text-amber-400" />
                Google Workspace Preset
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => applyPreset("ms365")}
                className="text-xs flex-1"
              >
                <Zap className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                Microsoft 365 Preset
              </Button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Inbox Label</Label>
                  <Input
                    placeholder="e.g. Hello - WithMinions"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>From Name</Label>
                  <Input
                    placeholder="Rakib from Minions.AI"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>From Email Address</Label>
                  <Input
                    type="email"
                    placeholder="hello@withminions.com"
                    value={fromEmail}
                    onChange={(e) => {
                      setFromEmail(e.target.value);
                      if (!smtpUser) setSmtpUser(e.target.value);
                    }}
                    required
                  />
                </div>
                <div>
                  <Label>Reply-To Email (Optional)</Label>
                  <Input
                    type="email"
                    placeholder="hello@withminions.com"
                    value={replyToEmail}
                    onChange={(e) => setReplyToEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>SMTP Host</Label>
                  <Input
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    required
                  />
                </div>
                <div>
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>SMTP Username / Email</Label>
                <Input
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="hello@withminions.com"
                  required
                />
              </div>

              <div>
                <Label className="flex items-center justify-between">
                  <span>Google App Password (16-char)</span>
                  <span className="text-xs text-slate-400 font-normal">
                    myaccount.google.com/apppasswords
                  </span>
                </Label>
                <Input
                  type="password"
                  placeholder="•••• •••• •••• ••••"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <Label>Daily Send Limit</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(Number(e.target.value))}
                    required
                  />
                  <span className="text-xs text-slate-500">Recommended: 25–35 / day</span>
                </div>
                <div className="flex flex-col justify-center pt-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="smtpSecureCheckbox"
                      checked={smtpSecure}
                      onChange={(e) => setSmtpSecure(e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="smtpSecureCheckbox" className="text-xs text-slate-300 cursor-pointer">
                      Use SSL/TLS (Port 465)
                    </label>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAddInbox as any}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Testing & Saving...
                    </>
                  ) : (
                    "Verify & Save Inbox"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
