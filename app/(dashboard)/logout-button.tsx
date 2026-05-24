"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="w-full text-left px-2 py-1.5 rounded text-xs transition-colors"
      style={{ color: "oklch(0.40 0 0)", fontFamily: "'DM Mono', monospace" }}
      onMouseOver={(e) => (e.currentTarget.style.color = "oklch(0.65 0 0)")}
      onMouseOut={(e) => (e.currentTarget.style.color = "oklch(0.40 0 0)")}
    >
      Sign out
    </button>
  );
}
