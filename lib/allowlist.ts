/**
 * Platform access allowlist — single source of truth.
 *
 * The platform is private: only these identities may sign in or hold a session.
 * Enforced in three places, all of which must agree:
 *   1. `signIn` callback (lib/auth.ts) — blocks the OAuth sign-in outright.
 *   2. `jwt`/`session` callbacks (lib/auth.ts) — invalidates already-issued
 *      sessions, so removing an address here logs that person out on their next
 *      request rather than only blocking new logins.
 *   3. `requireOrgSession` (lib/org.ts) — final server-side check on API routes.
 *
 * Override via ALLOWED_EMAILS (comma-separated) if the list ever needs to change
 * without a redeploy. An empty/unset env var falls back to the hardcoded pair.
 */
const DEFAULT_ALLOWED_EMAILS = [
  "xpeedlab@gmail.com",
  "parvejshahlabib007@gmail.com",
];

function parseEnvAllowlist(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function getAllowedEmails(): string[] {
  const fromEnv = parseEnvAllowlist();
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWED_EMAILS;
}

/** True only for an exact, case-insensitive match against the allowlist. */
export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAllowedEmails().includes(email.trim().toLowerCase());
}
