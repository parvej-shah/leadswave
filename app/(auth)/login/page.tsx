"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button, GoogleIcon } from "@/components/ui";

function SignInButton() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("callbackUrl") ?? "/";
  // Only same-origin relative paths — never an absolute URL from the query string.
  const callbackUrl = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  // NextAuth sends ?error=AccessDenied when the signIn callback rejects the
  // identity — without this the blocked user just bounces back to a blank form.
  const denied = searchParams.get("error") === "AccessDenied";
  return (
    <>
      {denied && (
        <p
          role="alert"
          className="font-mono text-[12px] text-center leading-[1.55] m-0 rounded-lg px-3 py-2.5 bg-[oklch(0.55_0.19_25/12%)] border border-[oklch(0.55_0.19_25/30%)] text-[oklch(0.78_0.13_25)]"
        >
          This platform is private. That Google account is not authorized.
        </p>
      )}
      <Button fullWidth size="lg" onClick={() => signIn("google", { callbackUrl })}>
        <GoogleIcon size={16} />
        <span>Continue with Google →</span>
      </Button>
    </>
  );
}

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
          <h1 className="ds-serif-welcome m-0 mb-1.5" style={{ fontSize: 32 }}>
            Welcome back.
          </h1>
          <p className="font-mono text-[13px] text-fg-4 m-0">Sign in to continue</p>
        </div>

        <div className="bg-[oklch(0.15_0_0)] border border-[oklch(1_0_0/8%)] rounded-xl p-5 flex flex-col gap-3.5">
          <p className="font-mono text-[12px] text-fg-4 text-center leading-[1.55] m-0">
            Sign in with your Google account to access your calendar and outreach tools.
          </p>

          <Suspense fallback={null}>
            <SignInButton />
          </Suspense>
        </div>

        <div className="mt-6 flex justify-center">
          <img
            src="/logo-transparent.png"
            alt="LeadsWave"
            width={2508}
            height={627}
            className="h-auto w-[320px] max-w-full opacity-90"
          />
        </div>

        <p className="text-center font-mono text-[11px] text-fg-5 mt-4">
          Find. Enrich. Outreach. Follow up. Close.
        </p>
      </div>
    </div>
  );
}
