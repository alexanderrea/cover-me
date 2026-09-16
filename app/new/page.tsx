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
    .select("resume_text, linkedin_text, full_name")
    .eq("id", auth.user.id)
    .single<Pick<Profile, "resume_text" | "linkedin_text" | "full_name">>();

  const ready = Boolean(profile?.resume_text?.trim() || profile?.linkedin_text?.trim());

  return (
    <div className="shell">
      <Masthead signedIn active="new" />

      {ready ? (
        <Composer />
      ) : (
        <>
          <h2 style={{ marginBottom: 10 }}>First, who are you?</h2>
          <p className="hint" style={{ marginBottom: 18 }}>
            There&apos;s no resume or LinkedIn profile on file yet, so there&apos;s
            nothing to write a letter from.
          </p>
          <Link href="/profile" className="btn btn--acid">
            Add your details →
          </Link>
        </>
      )}
    </div>
  );
}
