/**
 * Global dry-run switch for outbound email.
 *
 * When SEND_DISABLED=true, every Resend send site logs what it WOULD have sent
 * and returns a fake success, so downstream state transitions (Message rows,
 * lead state, job status) still exercise end-to-end. Used for safe verification
 * on staging/prod during refactors.
 */
export function sendsDisabled(): boolean {
  return process.env.SEND_DISABLED === "true";
}

/** Fake Resend success payload, shaped like `resend.emails.send()`'s result. */
export function dryRunSend(to: string | string[], subject?: string) {
  console.log(`[dry-run] SEND_DISABLED — would send to ${Array.isArray(to) ? to.join(", ") : to}${subject ? ` — "${subject}"` : ""}`);
  return { data: { id: "dry-run" }, error: null as null };
}
