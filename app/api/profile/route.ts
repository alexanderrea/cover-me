import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const nullableText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => (s.trim() ? s.trim() : null))
    .nullable()
    .optional();

const PatchSchema = z.object({
  full_name: nullableText(200),
  email: nullableText(320),
  phone: nullableText(60),
  location: nullableText(200),
  headline: nullableText(400),
  linkedin_url: nullableText(500),
  portfolio_url: nullableText(500),
  linkedin_text: nullableText(80_000),
  resume_text: nullableText(200_000),
  resume_name: nullableText(300),
  notes: nullableText(4_000),
});

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Some fields were too long." }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: auth.user.id, ...parsed.data, updated_at: new Date().toISOString() });

  if (error) {
    console.error("[profile] save failed:", error);
    return NextResponse.json({ error: "Couldn't save your details." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
