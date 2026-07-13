"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, Input, Label, Select, SkeletonRows } from "@/components/ui";

type Member = {
  membershipId: string;
  userId: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: string;
  isSelf: boolean;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  link: string;
};

export function TeamPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const myRole = members.find((m) => m.isSelf)?.role ?? "member";
  const canManage = myRole === "admin" || myRole === "owner";
  const isOwner = myRole === "owner";

  async function refresh() {
    try {
      const [mRes, iRes] = await Promise.all([
        fetch("/api/org/members"),
        fetch("/api/org/invites"),
      ]);
      if (mRes.ok) setMembers(await mRes.json());
      if (iRes.ok) setInvites(await iRes.json());
      else setInvites([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function sendInvite() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/org/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create invite");
      setInviteEmail("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(membershipId: string, role: string) {
    setError("");
    const res = await fetch(`/api/org/members/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) setError((await res.json()).error ?? "Failed to change role");
    await refresh();
  }

  async function removeMember(membershipId: string) {
    setError("");
    const res = await fetch(`/api/org/members/${membershipId}`, { method: "DELETE" });
    if (!res.ok) setError((await res.json()).error ?? "Failed to remove member");
    await refresh();
  }

  async function revokeInvite(id: string) {
    await fetch(`/api/org/invites?id=${id}`, { method: "DELETE" });
    await refresh();
  }

  async function copyLink(invite: Invite) {
    await navigator.clipboard.writeText(invite.link).catch(() => {});
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) {
    return (
      <Card>
        <SkeletonRows n={3} rowClassName="h-[52px]" />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>Members</CardHeader>
        <CardBody className="flex flex-col gap-3">
          {error && <p className="font-mono text-[12px] text-red-400 m-0">{error}</p>}
          {members.map((m) => (
            <div key={m.membershipId} className="flex items-center gap-3">
              {m.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.image} alt="" className="w-7 h-7 rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[oklch(0.3_0_0)] flex items-center justify-center font-mono text-[11px] text-fg-3">
                  {(m.name ?? m.email ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[13px] text-fg-1 truncate">
                  {m.name ?? m.email}
                  {m.isSelf && <span className="text-fg-4"> (you)</span>}
                </div>
                <div className="font-mono text-[11px] text-fg-4 truncate">{m.email}</div>
              </div>
              {isOwner && !m.isSelf ? (
                <>
                  <Select
                    value={m.role}
                    onChange={(e) => changeRole(m.membershipId, e.target.value)}
                    className="w-[110px]"
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => removeMember(m.membershipId)}>
                    Remove
                  </Button>
                </>
              ) : (
                <span className="font-mono text-[11px] uppercase tracking-wider text-fg-4">{m.role}</span>
              )}
            </div>
          ))}
        </CardBody>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>Invite teammate</CardHeader>
          <CardBody className="flex flex-col gap-3">
            <div className="flex gap-2 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="teammate@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="w-[130px]">
                <Label>Role</Label>
                <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>
              <Button onClick={sendInvite} disabled={busy || !inviteEmail.trim()}>
                {busy ? "Creating…" : "Create invite"}
              </Button>
            </div>

            {invites.length > 0 && (
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <Label>Pending invites</Label>
                {invites.map((i) => (
                  <div key={i.id} className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[12px] text-fg-2 flex-1 min-w-[160px] truncate">
                      {i.email} <span className="text-fg-4">({i.role})</span>
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => copyLink(i)}>
                      {copiedId === i.id ? "Copied!" : "Copy link"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => revokeInvite(i.id)}>
                      Revoke
                    </Button>
                  </div>
                ))}
                <p className="font-mono text-[11px] text-fg-5 m-0">
                  Share the link with your teammate — they sign in with the invited Google
                  account to join. Links expire in 7 days.
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
