import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Symmetric encryption for the one genuinely secret thing we store: each
 * user's Anthropic API key.
 *
 * Row level security already stops one user reading another's row. This is the
 * layer underneath that — if the database itself ever leaks, the keys in it are
 * inert without ENCRYPTION_KEY, which lives only in the environment.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const TAG_BYTES = 16;

function secret() {
  const raw = process.env.ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set — API keys can't be stored. Generate one with: openssl rand -hex 32",
    );
  }

  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes of hex (64 characters).");
  }

  return key;
}

/** Returns `iv.ciphertext.tag`, all base64url. */
export function encrypt(plaintext: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, secret(), iv);

  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString("base64url"), body.toString("base64url"), tag.toString("base64url")].join(".");
}

/**
 * Reverses `encrypt`. Throws if the payload was tampered with, truncated, or
 * encrypted under a different ENCRYPTION_KEY.
 */
export function decrypt(payload: string) {
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("Stored value is malformed.");

  const iv = Buffer.from(parts[0], "base64url");
  const body = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Stored value is malformed.");
  }

  const decipher = createDecipheriv(ALGORITHM, secret(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

/** "sk-ant-…9f2a" — enough to recognise a key, useless to anyone else. */
export function hintFor(apiKey: string) {
  const tail = apiKey.slice(-4);
  return `sk-ant-…${tail}`;
}
