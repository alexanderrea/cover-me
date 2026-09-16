import { redirect } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { supabaseServer } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/profile");

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .single<Profile>();

  // The signup trigger normally creates this row; fall back to an empty one so
  // a missing trigger doesn't turn into a blank screen.
  const profile: Profile =
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
      updated_at: new Date().toISOString(),
    } satisfies Profile);

  return (
    <div className="shell">
      <Masthead signedIn active="profile" />
      <ProfileForm profile={profile} />
    </div>
  );
}
