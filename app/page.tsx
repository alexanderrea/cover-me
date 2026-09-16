import Link from "next/link";
import { redirect } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { currentUser } from "@/lib/supabase/server";

export default async function Landing() {
  if (await currentUser()) redirect("/new");

  return (
    <div className="shell">
      <Masthead signedIn={false} />

      <section className="hero">
        <div className="hero__kicker">Cover letters / no boilerplate</div>
        <h1>
          Stop writing
          <br />
          the same
          <br />
          <span style={{ background: "var(--acid)", color: "#0d0d0c", padding: "0 6px" }}>
            letter twice
          </span>
        </h1>
        <p className="hero__lede">
          Feed it a job link. It reads the posting, researches the company on the
          web, and writes from your actual resume — not from a template.
        </p>

        <Link href="/login" className="btn btn--primary">
          Sign in with Google →
        </Link>
      </section>

      <hr className="dotted" />

      <ol className="steps">
        <li>
          <b>01</b>
          <p>
            <strong>Tell it about you</strong>
            Upload a resume, paste your LinkedIn profile, add your contact details.
            Once.
          </p>
        </li>
        <li>
          <b>02</b>
          <p>
            <strong>Add the job</strong>
            A link, a PDF, or pasted text. It pulls out the posting and finds the
            company.
          </p>
        </li>
        <li>
          <b>03</b>
          <p>
            <strong>Set tone and length</strong>
            Two sliders. Reserved to bold, 130 words to 450.
          </p>
        </li>
        <li>
          <b>04</b>
          <p>
            <strong>Read it, send it</strong>
            Every letter is saved, with the sources it was built from.
          </p>
        </li>
      </ol>

      <p className="hint">
        Nothing is invented. If your resume doesn&apos;t say it, the letter
        doesn&apos;t claim it.
      </p>
    </div>
  );
}
