"use client";

import { useEffect, useState, useRef } from "react";
import {
  Button,
  Card,
  CardBody,
  Input,
  Label,
  SkeletonRows,
  Badge,
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
  Flame,
  Search,
  Filter,
  MoreVertical,
  Sliders,
  Check,
  Globe,
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

export default function EmailAccountsPage() {
  const [inboxes, setInboxes] = useState<SenderInbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals & Popups
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingInbox, setEditingInbox] = useState<SenderInbox | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
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

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  async function handleAddInbox() {
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
          fromName: fromName || name || "Rakib from Minions.AI",
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
    setActiveMenuId(null);
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
    setActiveMenuId(null);
    if (!confirm(`Are you sure you want to remove inbox ${email}?`)) return;
    try {
      const res = await fetch(`/api/settings/inboxes/${inboxId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setInboxes((prev) => prev.filter((i) => i.id !== inboxId));
        setSuccessMsg(`Inbox ${email} removed.`);
      }
    } catch {
      // ignore
    }
  }

  async function handleUpdateLimit(inboxId: string, newLimit: number) {
    try {
      const res = await fetch(`/api/settings/inboxes/${inboxId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyLimit: newLimit }),
      });
      if (res.ok) {
        setInboxes((prev) =>
          prev.map((i) => (i.id === inboxId ? { ...i, dailyLimit: newLimit } : i)),
        );
        setEditingInbox(null);
        setSuccessMsg("Daily limit updated.");
      }
    } catch {
      // ignore
    }
  }

  const filteredInboxes = inboxes.filter((inbox) => {
    const matchesSearch =
      inbox.fromEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inbox.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
        ? inbox.isActive
        : !inbox.isActive;
    return matchesSearch && matchesStatus;
  });

  const totalCapacity = inboxes.reduce((sum, i) => sum + (i.isActive ? i.dailyLimit : 0), 0);
  const totalSentToday = inboxes.reduce((sum, i) => sum + i.sentToday, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Mail className="w-6 h-6 text-indigo-400" />
            Email Accounts
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your sending inboxes, deliverability health, and automated warmup pools.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Metrics Badge */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
            <div>
              Capacity: <strong className="text-slate-100">{totalSentToday} / {totalCapacity}</strong> sent today
            </div>
            <div className="w-px h-4 bg-slate-800" />
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
              <span>{inboxes.length} Active in Warmup</span>
            </div>
          </div>

          <Button
            onClick={() => {
              setError("");
              setShowAddModal(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add New
          </Button>
        </div>
      </div>

      {/* Notifications */}
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

      {/* Controls Bar: Search & Status Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-xl p-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search accounts or domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg p-0.5 text-xs text-slate-400">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === "all" ? "bg-slate-800 text-white font-medium" : "hover:text-slate-200"
              }`}
            >
              All ({inboxes.length})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === "active" ? "bg-slate-800 text-white font-medium" : "hover:text-slate-200"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter("paused")}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === "paused" ? "bg-slate-800 text-white font-medium" : "hover:text-slate-200"
              }`}
            >
              Paused
            </button>
          </div>
        </div>
      </div>

      {/* Email Accounts Table */}
      {loading ? (
        <Card>
          <CardBody>
            <SkeletonRows n={4} />
          </CardBody>
        </Card>
      ) : filteredInboxes.length === 0 ? (
        <Card className="border-dashed border-slate-800 bg-slate-900/30">
          <CardBody className="py-16 text-center">
            <Server className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-200">No Email Accounts Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-6">
              Connect your Google Workspace inboxes to start rotating outbound cold campaigns.
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Account
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="border border-slate-800/80 rounded-2xl bg-slate-900/50 backdrop-blur-sm overflow-hidden shadow-xl">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3.5 bg-slate-950/60 border-b border-slate-800/80 text-[11px] font-mono tracking-wider uppercase text-slate-400">
            <div className="col-span-5 flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.size === filteredInboxes.length && filteredInboxes.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds(new Set(filteredInboxes.map((i) => i.id)));
                  else setSelectedIds(new Set());
                }}
                className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0"
              />
              <span>EMAIL</span>
            </div>
            <div className="col-span-2 text-center">EMAILS SENT</div>
            <div className="col-span-2 text-center">WARMUP EMAILS</div>
            <div className="col-span-2 text-center">HEALTH SCORE</div>
            <div className="col-span-1 text-right">ACTIONS</div>
          </div>

          {/* Table Body Rows */}
          <div className="divide-y divide-slate-800/50">
            {filteredInboxes.map((inbox) => {
              const domain = inbox.fromEmail.split("@")[1] || "withminions.com";
              const isSelected = selectedIds.has(inbox.id);

              return (
                <div
                  key={inbox.id}
                  className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors hover:bg-slate-800/30 ${
                    !inbox.isActive ? "opacity-60 bg-slate-950/20" : ""
                  }`}
                >
                  {/* Column 1: Checkbox + Email & Domain Tag */}
                  <div className="col-span-5 flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) next.add(inbox.id);
                        else next.delete(inbox.id);
                        setSelectedIds(next);
                      }}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100 text-sm truncate font-mono">
                          {inbox.fromEmail}
                        </span>
                        {!inbox.isActive && (
                          <Badge variant="neutral" className="text-[10px]">
                            Paused
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                          <Globe className="w-3 h-3 text-slate-600" />
                          {domain}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="truncate">{inbox.fromName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Emails Sent Quota */}
                  <div className="col-span-2 text-center">
                    <span className="font-mono text-sm font-semibold text-slate-200">
                      {inbox.sentToday} of {inbox.dailyLimit}
                    </span>
                    <div className="w-24 h-1.5 bg-slate-800 rounded-full mx-auto mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.round((inbox.sentToday / inbox.dailyLimit) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Column 3: Warmup Emails (Free Tier) */}
                  <div className="col-span-2 text-center">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs">
                      <Flame className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                      <span>10 / day</span>
                    </div>
                  </div>

                  {/* Column 4: Health Score */}
                  <div className="col-span-2 text-center">
                    <div className="inline-flex items-center gap-1 font-mono text-sm font-bold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Column 5: Actions & Dropdown Menu */}
                  <div className="col-span-1 flex items-center justify-end gap-2 relative">
                    <button
                      onClick={() => handleToggleActive(inbox)}
                      title={inbox.isActive ? "Pause Warmup & Sending" : "Resume"}
                      className={`p-1.5 rounded-lg transition-colors ${
                        inbox.isActive
                          ? "text-emerald-400 hover:bg-emerald-500/10"
                          : "text-slate-500 hover:bg-slate-800"
                      }`}
                    >
                      <Flame className={`w-4 h-4 ${inbox.isActive ? "fill-emerald-400" : ""}`} />
                    </button>

                    <button
                      onClick={() => setActiveMenuId(activeMenuId === inbox.id ? null : inbox.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Popover Action Menu */}
                    {activeMenuId === inbox.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-10 z-30 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 text-xs text-slate-300 font-sans"
                      >
                        <button
                          onClick={() => handleSendTest(inbox.id)}
                          disabled={testingId === inbox.id}
                          className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-slate-800 transition-colors"
                        >
                          <Send className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{testingId === inbox.id ? "Sending Test..." : "Send Test Email"}</span>
                        </button>

                        <button
                          onClick={() => {
                            setEditingInbox(inbox);
                            setActiveMenuId(null);
                          }}
                          className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-slate-800 transition-colors"
                        >
                          <Sliders className="w-3.5 h-3.5 text-amber-400" />
                          <span>Edit Daily Limit</span>
                        </button>

                        <button
                          onClick={() => {
                            handleToggleActive(inbox);
                            setActiveMenuId(null);
                          }}
                          className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-slate-800 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{inbox.isActive ? "Pause Account" : "Activate Account"}</span>
                        </button>

                        <div className="my-1 border-t border-slate-800" />

                        <button
                          onClick={() => handleDeleteInbox(inbox.id, inbox.fromEmail)}
                          className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove Account</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Daily Limit Modal */}
      {editingInbox && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-100 text-base">Edit Daily Send Limit</h3>
            <p className="text-xs text-slate-400">
              Set max cold outreach emails per day for <strong>{editingInbox.fromEmail}</strong>.
            </p>

            <div>
              <Label>Daily Send Cap</Label>
              <Input
                type="number"
                defaultValue={editingInbox.dailyLimit}
                id="editDailyLimitInput"
                min={1}
                max={100}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingInbox(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const input = document.getElementById("editDailyLimitInput") as HTMLInputElement;
                  if (input) handleUpdateLimit(editingInbox.id, Number(input.value));
                }}
              >
                Save Limit
              </Button>
            </div>
          </div>
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
                  <h3 className="font-bold text-lg text-slate-100">Connect Email Account</h3>
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
                  onClick={handleAddInbox}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Testing & Saving...
                    </>
                  ) : (
                    "Verify & Save Account"
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
