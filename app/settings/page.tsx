import { redirect } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { supabaseServer } from "@/lib/supabase/server";
import { KeyForm } from "./key-form";

export default async function SettingsPage() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/settings");

  // Deliberately never selects anthropic_key_cipher — the encrypted key must
  // not travel to the browser, even inside a server-rendered payload.
  const { data } = await supabase
    .from("profiles")
    .select("anthropic_key_hint, anthropic_key_set_at")
    .eq("id", auth.user.id)
    .single<{ anthropic_key_hint: string | null; anthropic_key_set_at: string | null }>();

  return (
    <div className="shell">
      <Masthead signedIn active="settings" />

      <h2 style={{ marginBottom: 6 }}>Settings</h2>
      <p className="hint" style={{ marginBottom: 18 }}>
        Your account, and the key that pays for your letters.
      </p>

      <section className="panel">
        <div className="panel__head">
          <h3>Account</h3>
          <span className="step">GOOGLE</span>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <span className="mono-label">Signed in as</span>
          <div style={{ fontSize: 15, overflowWrap: "anywhere" }}>{auth.user.email}</div>
        </div>
      </section>

      <KeyForm
        hint={data?.anthropic_key_hint ?? null}
        setAt={data?.anthropic_key_set_at ?? null}
      />
    </div>
  );
}
