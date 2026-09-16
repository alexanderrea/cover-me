import { redirect } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { currentUser } from "@/lib/supabase/server";
import { GoogleButton } from "./google-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  if (await currentUser()) redirect("/new");

  const { error, next } = await searchParams;

  return (
    <div className="shell">
      <Masthead signedIn={false} />

      <div style={{ maxWidth: 420, margin: "32px auto 0" }}>
        <h2 style={{ marginBottom: 14 }}>Sign in</h2>
        <p className="hint" style={{ marginBottom: 20 }}>
          One account, so your resume and your letters are waiting next time.
        </p>

        {error ? <div className="notice notice--error">{error}</div> : null}

        <GoogleButton next={next ?? "/new"} />

        <hr className="dotted" />

        <p className="hint">
          Google tells us your name and email address. Nothing is posted anywhere
          on your behalf.
        </p>
      </div>
    </div>
  );
}
