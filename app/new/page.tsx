import Link from "next/link";
import { redirect } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { supabaseServer } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { Composer } from "./composer";

export default async function NewLetterPage() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/new");

  const { data: profile } = await supabase
    .from("profiles")
    .select("resume_text, linkedin_text, anthropic_key_hint")
    .eq("id", auth.user.id)
    .single<Pick<Profile, "resume_text" | "linkedin_text" | "anthropic_key_hint">>();

  const hasSource = Boolean(profile?.resume_text?.trim() || profile?.linkedin_text?.trim());
  const hasKey = Boolean(profile?.anthropic_key_hint);

  return (
    <div className="shell">
      <Masthead signedIn active="new" />

      {!hasKey ? (
        <>
          <h2 style={{ marginBottom: 10 }}>First, add your key</h2>
          <p className="hint" style={{ marginBottom: 18 }}>
            COVER ME runs on your own Anthropic API key, so your letters are
            billed to you. It takes a minute to create one.
          </p>
          <Link href="/settings" className="btn btn--acid">
            Add your API key →
          </Link>
        </>
      ) : !hasSource ? (
        <>
          <h2 style={{ marginBottom: 10 }}>Now, who are you?</h2>
          <p className="hint" style={{ marginBottom: 18 }}>
            There&apos;s no resume or LinkedIn profile on file yet, so there&apos;s
            nothing to write a letter from.
          </p>
          <Link href="/profile" className="btn btn--acid">
            Add your details →
          </Link>
        </>
      ) : (
        <Composer />
      )}
    </div>
  );
}
