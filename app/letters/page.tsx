import Link from "next/link";
import { redirect } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { supabaseServer } from "@/lib/supabase/server";
import { lengthBand, toneBand } from "@/lib/prompt";
import type { Letter } from "@/lib/types";

type Row = Pick<Letter, "id" | "company" | "role" | "body" | "tone" | "length" | "created_at">;

export default async function LettersPage() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/letters");

  const { data } = await supabase
    .from("letters")
    .select("id, company, role, body, tone, length, created_at")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<Row[]>();

  const letters = data ?? [];

  return (
    <div className="shell">
      <Masthead signedIn active="letters" />

      <h2 style={{ marginBottom: 6 }}>Letters</h2>
      <p className="hint" style={{ marginBottom: 18 }}>
        {letters.length
          ? `${letters.length} on file.`
          : "Nothing yet — the first one takes about a minute."}
      </p>

      {letters.length ? (
        letters.map((l) => (
          <Link key={l.id} href={`/letters/${l.id}`} className="record">
            <div className="record__top">
              <span className="record__role">{l.role || "Untitled role"}</span>
              <span className="record__meta">
                {new Date(l.created_at).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "2-digit",
                })}
              </span>
            </div>

            <div style={{ margin: "8px 0 4px" }}>
              {l.company ? <span className="tag">{l.company}</span> : null}
              <span className="tag">{toneBand(l.tone).label}</span>
              <span className="tag">{lengthBand(l.length).label}</span>
            </div>

            <div className="record__excerpt">{l.body.slice(0, 220)}</div>
          </Link>
        ))
      ) : (
        <Link href="/new" className="btn btn--accent">
          Write one →
        </Link>
      )}
    </div>
  );
}
