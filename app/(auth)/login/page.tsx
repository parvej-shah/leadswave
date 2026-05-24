"use client";

import { signIn } from "next-auth/react";
import { Button, GoogleIcon } from "@/components/ui";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-sidebar">
      {/* Grid overlay */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Amber blur orb */}
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none opacity-[0.06] blur-[120px] bg-amber"
      />

      <div className="relative w-full max-w-[380px] px-4">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-amber ds-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-[0.20em] text-amber">
              LeadsWave
            </span>
          </div>
          <h1 className="ds-serif-welcome m-0 mb-1.5" style={{ fontSize: 32 }}>
            Welcome back.
          </h1>
          <p className="font-mono text-[13px] text-fg-4 m-0">Sign in to continue</p>
        </div>

        <div className="bg-[oklch(0.15_0_0)] border border-[oklch(1_0_0/8%)] rounded-xl p-5 flex flex-col gap-3.5">
          <p className="font-mono text-[12px] text-fg-4 text-center leading-[1.55] m-0">
            Sign in with your Google account to access your calendar and outreach tools.
          </p>

          <Button fullWidth size="lg" onClick={() => signIn("google", { callbackUrl: "/" })}>
            <GoogleIcon size={16} />
            <span>Continue with Google →</span>
          </Button>
        </div>

        <p className="text-center font-mono text-[11px] text-fg-5 mt-5">
          LeadsWave · Outbound on autopilot
        </p>
      </div>
    </div>
  );
}
