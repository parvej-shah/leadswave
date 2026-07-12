"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function AcceptInvite({
  token,
  sessionEmail,
  inviteEmail,
}: {
  token: string;
  sessionEmail: string;
  inviteEmail: string;
}) {
  const [state, setState] = useState<"idle" | "accepting" | "accepted" | "error">("idle");
  const [message, setMessage] = useState("");
  const emailMismatch = sessionEmail.toLowerCase() !== inviteEmail.toLowerCase();

  async function accept() {
    setState("accepting");
    try {
      const res = await fetch("/api/org/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to accept invite");
      setMessage(`You've joined ${data.orgName}. Sign in again to switch into the new workspace.`);
      setState("accepted");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  if (emailMismatch) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[12px] text-fg-4 m-0">
          You&apos;re signed in as <b>{sessionEmail}</b>, but this invite was sent to{" "}
          <b>{inviteEmail}</b>.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: `/login?callbackUrl=/invite/${token}` })}
          className="w-full rounded-lg bg-amber text-black font-mono text-[13px] font-semibold py-2.5 cursor-pointer border-0"
        >
          Switch account
        </button>
      </div>
    );
  }

  if (state === "accepted") {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[12px] text-fg-3 m-0">✅ {message}</p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full rounded-lg bg-amber text-black font-mono text-[13px] font-semibold py-2.5 cursor-pointer border-0"
        >
          Sign in again →
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {state === "error" && <p className="font-mono text-[12px] text-red-400 m-0">{message}</p>}
      <button
        onClick={accept}
        disabled={state === "accepting"}
        className="w-full rounded-lg bg-amber text-black font-mono text-[13px] font-semibold py-2.5 cursor-pointer border-0 disabled:opacity-60"
      >
        {state === "accepting" ? "Joining…" : "Accept invite →"}
      </button>
    </div>
  );
}
