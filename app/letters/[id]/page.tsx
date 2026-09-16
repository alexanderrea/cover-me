import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { supabaseServer } from "@/lib/supabase/server";
import { lengthBand, toneBand } from "@/lib/prompt";
import type { Letter } from "@/lib/types";
import { LetterActions } from "./actions";

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=/letters/${id}`);

  const { data: letter } = await supabase
    .from("letters")
    .select("*")
    .eq("id", id)
    .single<Letter>();

  if (!letter) notFound();

  const filename =
    [letter.company, letter.role].filter(Boolean).join(" — ") || "cover-letter";

  return (
    <div className="shell">
      <Masthead signedIn active="letters" />

      <Link href="/letters" className="navlink" style={{ padding: 0, display: "inline-block", marginBottom: 12 }}>
        ← All letters
      </Link>

      <h2 style={{ marginBottom: 8 }}>{letter.role || "Untitled role"}</h2>

      <div style={{ marginBottom: 18 }}>
        {letter.company ? <span className="tag">{letter.company}</span> : null}
        <span className="tag">{toneBand(letter.tone).label}</span>
        <span className="tag">{lengthBand(letter.length).label}</span>
        <span className="tag">
          {new Date(letter.created_at).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>

      <div className="letter" style={{ marginBottom: 14 }}>{letter.body}</div>

      <LetterActions body={letter.body} filename={filename} />

      {letter.research?.sources?.length ? (
        <section className="panel">
          <div className="panel__head">
            <h3>Research</h3>
            <span className="step">{letter.research.sources.length} SOURCES</span>
          </div>

          {letter.research.brief ? (
            <p style={{ fontSize: 13, marginBottom: 14 }}>{letter.research.brief}</p>
          ) : null}

          <ul className="sources">
            {letter.research.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
                <span>{new URL(s.url).hostname.replace(/^www\./, "")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="panel">
        <summary style={{ cursor: "pointer", fontFamily: "var(--mono)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 12 }}>
          The job description it was written from
        </summary>
        <p className="hint" style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
          {letter.job_text}
        </p>
        {letter.job_url ? (
          <p className="hint">
            <a href={letter.job_url} target="_blank" rel="noreferrer">
              {letter.job_url}
            </a>
          </p>
        ) : null}
      </details>
    </div>
  );
}
