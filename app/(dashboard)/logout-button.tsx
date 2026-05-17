"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="w-full text-left px-2 py-1.5 rounded text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      Sign out
    </button>
  );
}
