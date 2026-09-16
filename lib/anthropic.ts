import Anthropic from "@anthropic-ai/sdk";

/** Every request in the app goes through Claude Opus 5. */
export const MODEL = "claude-opus-5";

let client: Anthropic | null = null;

export function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. See .env.example.");
  }
  client ??= new Anthropic();
  return client;
}
