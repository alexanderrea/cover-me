import { redirect } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { supabaseServer } from "@/lib/supabase/server";
import type { ProfileSafe } from "@/lib/types";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/profile");

  // Explicit columns, not "*": the encrypted API key must never reach the
  // browser, and this form's props are serialised into the page.
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, location, headline, linkedin_url, portfolio_url, linkedin_text, resume_text, resume_name, notes, anthropic_key_hint, anthropic_key_set_at, updated_at",
    )
    .eq("id", auth.user.id)
    .single<ProfileSafe>();

  // The signup trigger normally creates this row; fall back to an empty one so
  // a missing trigger doesn't turn into a blank screen.
  const profile: ProfileSafe =
    data ??
    ({
      id: auth.user.id,
      full_name: (auth.user.user_metadata?.full_name as string) ?? null,
      email: auth.user.email ?? null,
      phone: null,
      location: null,
      headline: null,
      linkedin_url: null,
      portfolio_url: null,
      linkedin_text: null,
      resume_text: null,
      resume_name: null,
      notes: null,
      anthropic_key_hint: null,
      anthropic_key_set_at: null,
      updated_at: new Date().toISOString(),
    } satisfies ProfileSafe);

  return (
    <div className="shell">
      <Masthead signedIn active="profile" />
      <ProfileForm profile={profile} />
    </div>
  );
}
