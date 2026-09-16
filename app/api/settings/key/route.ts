import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { encrypt, hintFor } from "@/lib/crypto";
import { verifyKey } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  apiKey: z
    .string()
    .trim()
    .min(20, "That looks too short to be an API key.")
    .max(500, "That looks too long to be an API key."),
});

/** Save a verified key. The plaintext never leaves this function. */
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Bad request." },
      { status: 400 },
    );
  }

  const apiKey = parsed.data.apiKey;

  if (!apiKey.startsWith("sk-ant-")) {
    return NextResponse.json(
      { error: "Anthropic keys start with “sk-ant-”. Check you pasted the whole thing." },
      { status: 400 },
    );
  }

  // Check it actually works before storing it — a key that 401s at generation
  // time is a far worse experience than one rejected here.
  const check = await verifyKey(apiKey);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  let cipher: string;
  try {
    cipher = encrypt(apiKey);
  } catch (err) {
    console.error("[settings/key] encryption failed:", err);
    return NextResponse.json(
      { error: "The server can't store keys right now — ENCRYPTION_KEY is missing or invalid." },
      { status: 500 },
    );
  }

  const hint = hintFor(apiKey);

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: auth.user.id,
      anthropic_key_cipher: cipher,
      anthropic_key_hint: hint,
      anthropic_key_set_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("[settings/key] save failed:", error);
    return NextResponse.json({ error: "Couldn't save the key." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, hint });
}

/** Forget the stored key. */
export async function DELETE() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      anthropic_key_cipher: null,
      anthropic_key_hint: null,
      anthropic_key_set_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.user.id);

  if (error) {
    console.error("[settings/key] delete failed:", error);
    return NextResponse.json({ error: "Couldn't remove the key." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
