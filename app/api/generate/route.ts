import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { anthropicFor, MODEL } from "@/lib/anthropic";
import { decrypt } from "@/lib/crypto";
import { buildWritePrompt, WRITE_SYSTEM } from "@/lib/prompt";
import { research } from "@/lib/research";
import type { Profile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  jobText: z.string().min(80, "That job description is too short to work from."),
  jobUrl: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  tone: z.number().min(0).max(100),
  length: z.number().min(0).max(100),
  notes: z.string().max(2_000).nullable().optional(),
  skipResearch: z.boolean().optional(),
});

/** Server-sent events, one JSON object per line. */
function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return new Response("Not signed in.", { status: 401 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return new Response(parsed.error.issues[0]?.message ?? "Bad request.", { status: 400 });
  }
  const input = parsed.data;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .single<Profile>();

  if (!profile) {
    return new Response("Add your details before generating a letter.", { status: 409 });
  }
  if (!profile.resume_text?.trim() && !profile.linkedin_text?.trim()) {
    return new Response(
      "Add a resume or your LinkedIn profile text first — there's nothing to write from.",
      { status: 409 },
    );
  }

  // Bring-your-own-key: every call is billed to the user who made it.
  if (!profile.anthropic_key_cipher) {
    return new Response("Add your Anthropic API key in Settings before writing a letter.", {
      status: 402,
    });
  }

  let client;
  try {
    client = anthropicFor(decrypt(profile.anthropic_key_cipher));
  } catch (err) {
    console.error("[generate] could not read stored key:", err);
    return new Response(
      "Your stored API key couldn't be read. Remove it in Settings and add it again.",
      { status: 409 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(sse(event, data)));
      };

      try {
        // --- 1. Research -------------------------------------------------
        let brief = null;
        if (!input.skipResearch) {
          send("status", { phase: "research", message: "RESEARCHING COMPANY" });
          brief = await research(
            client,
            { company: input.company, role: input.role, jobText: input.jobText },
            (message) => send("status", { phase: "research", message }),
          );
          if (brief?.sources.length) send("sources", brief.sources);
        }

        // --- 2. Write ----------------------------------------------------
        send("status", { phase: "write", message: "WRITING LETTER" });

        const writing = client.messages.stream({
          model: MODEL,
          max_tokens: 16_000,
          system: WRITE_SYSTEM,
          messages: [
            {
              role: "user",
              content: buildWritePrompt({
                profile,
                jobText: input.jobText,
                company: input.company,
                role: input.role,
                jobUrl: input.jobUrl,
                research: brief,
                tone: input.tone,
                length: input.length,
                notes: input.notes,
              }),
            },
          ],
        });

        let body = "";
        for await (const event of writing) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            body += event.delta.text;
            send("token", event.delta.text);
          }
        }

        const final = await writing.finalMessage();
        if (final.stop_reason === "refusal") {
          send("error", "Claude declined to write this one. Try a different job description.");
          return;
        }

        body = body.trim();
        if (!body) {
          send("error", "No letter came back. Try again.");
          return;
        }

        // --- 3. Save -----------------------------------------------------
        const { data: saved, error } = await supabase
          .from("letters")
          .insert({
            user_id: auth.user.id,
            company: input.company ?? null,
            role: input.role ?? null,
            job_url: input.jobUrl ?? null,
            job_text: input.jobText,
            tone: input.tone,
            length: input.length,
            research: brief,
            body,
          })
          .select("id")
          .single<{ id: string }>();

        if (error) console.error("[generate] save failed:", error);

        send("done", { id: saved?.id ?? null, saved: !error });
      } catch (err) {
        console.error("[generate] failed:", err);
        const message =
          err instanceof Error && /authentication|401|invalid x-api-key/i.test(err.message)
            ? "Anthropic rejected your API key. Check it in Settings."
            : err instanceof Error && /credit|billing|quota|429/i.test(err.message)
              ? "Your Anthropic account refused the request — check your credit balance."
              : "Something broke while writing. Try again.";
        send("error", message);
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Stop proxies (notably Vercel's) from buffering the stream.
      "x-accel-buffering": "no",
    },
  });
}
