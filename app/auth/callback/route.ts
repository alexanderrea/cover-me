import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Where Google sends the user back to. Swaps the code for a session cookie. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/new";

  if (!code) {
    const error = url.searchParams.get("error_description") ?? "Sign-in was cancelled.";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, req.url));
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url),
    );
  }

  // `next` comes from our own login link, but treat it as untrusted anyway —
  // only same-site paths are allowed.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/new";
  return NextResponse.redirect(new URL(safeNext, req.url));
}
