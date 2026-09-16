"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function GoogleButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || window.location.origin;

    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <>
      {error ? <div className="notice notice--error">{error}</div> : null}
      <button className="btn btn--primary" onClick={signIn} disabled={busy}>
        {busy ? "Opening Google…" : "Continue with Google →"}
      </button>
    </>
  );
}
