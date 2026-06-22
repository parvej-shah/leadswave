"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Avatar, Button, Dialog, Icon } from "@/components/ui";

export function MobileTopBar({
  userEmail,
  userName,
}: {
  userEmail: string;
  userName: string;
}) {
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  function openCommand() {
    window.dispatchEvent(new CustomEvent("lw:open-command"));
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center gap-2 px-4 h-12 bg-sidebar border-b border-border pt-[env(safe-area-inset-top)] box-content">
      <img
        src="/logo.png"
        alt="LeadsWave"
        width={2508}
        height={627}
        className="h-auto w-[132px]"
      />
      <button
        type="button"
        onClick={openCommand}
        title="Search"
        className="ml-auto w-9 h-9 flex items-center justify-center bg-[oklch(0.12_0_0)] border border-border hover:border-[oklch(0.20_0_0)] text-fg-4 hover:text-fg-3 rounded-md transition-colors duration-150 cursor-pointer"
      >
        <Icon name="search" size={15} />
      </button>
      <button
        type="button"
        onClick={() => setSignOutOpen(true)}
        title="Account"
        aria-label="Account"
        className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-[oklch(0.13_0_0)] transition-colors duration-150 cursor-pointer"
      >
        <Avatar name={userName || userEmail} size={24} />
      </button>

      <Dialog
        open={signOutOpen}
        onClose={() => !signingOut && setSignOutOpen(false)}
        title="Account"
        dotColor="var(--amber)"
        width={420}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setSignOutOpen(false)}
              disabled={signingOut}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={userName || userEmail} size={32} />
            <div className="min-w-0">
              <p className="font-mono text-[12px] text-fg-2 m-0 leading-tight truncate">
                {userName || userEmail.split("@")[0]}
              </p>
              <p className="font-mono text-[11px] text-fg-5 m-0 leading-tight truncate">
                {userEmail}
              </p>
            </div>
          </div>
          <p className="font-mono text-[11px] text-fg-4 leading-relaxed bg-[oklch(0.13_0_0)] p-2.5 rounded border border-border-soft m-0">
            You can sign back in anytime with your account.
          </p>
        </div>
      </Dialog>
    </header>
  );
}
