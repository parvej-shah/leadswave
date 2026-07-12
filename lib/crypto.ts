import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM encryption-at-rest for secret Settings/User columns.
 *
 * Key: SETTINGS_ENCRYPTION_KEY env — 32 bytes, base64- or hex-encoded.
 * Stored format: `enc:v1:<ivB64>:<tagB64>:<ciphertextB64>`.
 *
 * Both directions tolerate the other's absence:
 * - encryptSecret without a key returns the plaintext (no-op rollout).
 * - decryptSecret passes through values without the `enc:v1:` prefix, so
 *   pre-migration plaintext rows keep working until the one-shot
 *   scripts/encrypt-settings.ts run.
 */
const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) return null;
  try {
    if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
    const b64 = Buffer.from(raw, "base64");
    if (b64.length === 32) return b64;
  } catch {
    // fall through
  }
  console.error("[crypto] SETTINGS_ENCRYPTION_KEY is set but not a 32-byte base64/hex key — encryption disabled");
  return null;
}

export function encryptSecret(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === "") return plain ?? null;
  if (plain.startsWith(PREFIX)) return plain; // already encrypted
  const key = getKey();
  if (!key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return value ?? null;
  if (!value.startsWith(PREFIX)) return value; // plaintext passthrough
  const key = getKey();
  if (!key) {
    console.error("[crypto] Encrypted value present but SETTINGS_ENCRYPTION_KEY missing — cannot decrypt");
    return null;
  }
  try {
    const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(":");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
  } catch (e) {
    console.error("[crypto] Failed to decrypt secret:", e);
    return null;
  }
}

const MASK = "••••";

/** For API responses: never ship the secret itself, just enough to recognize it. */
export function maskSecret(plain: string | null | undefined): string {
  if (!plain) return "";
  return `${MASK}${plain.slice(-4)}`;
}

/** True when a submitted value is a mask we produced (i.e. "unchanged"). */
export function isMaskedSecret(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(MASK);
}
