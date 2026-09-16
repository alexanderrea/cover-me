import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "./anthropic";
import { RESEARCH_SYSTEM } from "./prompt";
import type { Research, Source } from "./types";

/** A paused server-tool turn is resumed by replaying it — cap the replays. */
const MAX_CONTINUATIONS = 4;

const TOOLS: Anthropic.ToolUnion[] = [
  { type: "web_search_20260209", name: "web_search", max_uses: 8 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 4 },
];

function collect(content: Anthropic.ContentBlock[], sources: Map<string, Source>) {
  let text = "";

  for (const block of content) {
    if (block.type === "text") {
      text += block.text;
      continue;
    }

    if (block.type !== "web_search_tool_result") continue;

    // A successful search returns a list of results; a failed one returns a
    // single error object. Indexing without this check throws on errors.
    if (!Array.isArray(block.content)) continue;

    for (const r of block.content) {
      if (r.type === "web_search_result" && !sources.has(r.url)) {
        sources.set(r.url, { title: r.title || r.url, url: r.url });
      }
    }
  }

  return text;
}

/**
 * Search the web for what a candidate should know before writing, and return a
 * short brief plus the sources it came from. Never throws — research is a
 * nice-to-have, and a letter written from the job description alone is still a
 * letter.
 */
export async function research(
  args: { company?: string | null; role?: string | null; jobText: string },
  onStatus?: (message: string) => void,
): Promise<Research | null> {
  const target = [args.role, args.company].filter(Boolean).join(" at ") || "this role";

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Research the hiring company for ${target}, so a candidate can write an informed cover letter.

<job_description>
${args.jobText.slice(0, 20_000)}
</job_description>`,
    },
  ];

  const sources = new Map<string, Source>();
  let brief = "";

  try {
    for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
      const stream = anthropic().messages.stream({
        model: MODEL,
        max_tokens: 16_000,
        system: RESEARCH_SYSTEM,
        tools: TOOLS,
        messages,
      });

      stream.on("streamEvent", (event) => {
        if (event.type !== "content_block_start") return;
        const block = event.content_block;
        if (block.type === "server_tool_use") {
          onStatus?.(block.name === "web_fetch" ? "READING SOURCE" : "SEARCHING WEB");
        }
      });

      const message = await stream.finalMessage();
      brief += collect(message.content, sources);

      // The server-side tool loop hit its iteration cap. Replay the turn and
      // it picks up where it left off — no extra user message.
      if (message.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: message.content });
        onStatus?.("STILL SEARCHING");
        continue;
      }

      break;
    }
  } catch (err) {
    console.error("[research] failed:", err);
    onStatus?.("RESEARCH UNAVAILABLE");
    return sources.size ? { brief: brief.trim(), sources: [...sources.values()] } : null;
  }

  brief = brief.trim();
  if (!brief && !sources.size) return null;

  return { brief, sources: [...sources.values()].slice(0, 12) };
}
