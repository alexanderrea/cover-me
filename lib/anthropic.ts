import Anthropic from "@anthropic-ai/sdk";

/** Every request in the app goes through Claude Opus 5. */
export const MODEL = "claude-opus-5";

/**
 * A client bound to one user's own API key. COVER ME is bring-your-own-key:
 * nothing is ever billed to the person running the server.
 */
export function anthropicFor(apiKey: string) {
  if (!apiKey) throw new Error("No API key supplied.");
  return new Anthropic({ apiKey });
}

/**
 * A client using the server's own key. Only `npm run smoke` uses this — the app
 * itself always goes through `anthropicFor`.
 */
export function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. See .env.example.");
  }
  return new Anthropic();
}

/**
 * Confirm a key works before we store it, using the cheapest authenticated
 * call there is. Returns a human-readable reason when it doesn't.
 */
export async function verifyKey(apiKey: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await new Anthropic({ apiKey, maxRetries: 1 }).models.list({ limit: 1 });
    return { ok: true };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, reason: "Anthropic rejected that key." };
    }
    if (err instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, reason: "That key exists but isn't allowed to use the API." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      // The key is valid — it's just busy. Storing it is fine.
      return { ok: true };
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return { ok: false, reason: "Couldn't reach Anthropic to check the key. Try again." };
    }
    console.error("[verifyKey] unexpected:", err);
    return { ok: false, reason: "Couldn't verify that key." };
  }
}
