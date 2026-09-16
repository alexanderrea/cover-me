"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Slider } from "@/components/slider";
import { lengthBand, toneBand } from "@/lib/prompt";
import type { Source } from "@/lib/types";

type Mode = "link" | "upload" | "paste";
type Phase = "idle" | "reading" | "research" | "write" | "done";

export function Composer() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const letterRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode>("link");
  const [url, setUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");

  const [tone, setTone] = useState(50);
  const [length, setLength] = useState(50);

  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [letter, setLetter] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const busy = phase === "reading" || phase === "research" || phase === "write";
  const jobWords = jobText.trim() ? jobText.trim().split(/\s+/).length : 0;

  /** Pull the job description out of a link or a file. */
  async function ingest(payload: { url: string } | File) {
    setPhase("reading");
    setStatus(payload instanceof File ? "READING FILE" : "FETCHING POSTING");
    setError(null);

    try {
      const res =
        payload instanceof File
          ? await fetch("/api/ingest", {
              method: "POST",
              body: (() => {
                const f = new FormData();
                f.append("file", payload);
                return f;
              })(),
            })
          : await fetch("/api/ingest", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that.");

      setJobText(data.text);
      if (data.role && !role) setRole(data.role);
      if (data.company && !company) setCompany(data.company);
      setMode("paste");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that.");
    } finally {
      setPhase("idle");
      setStatus("");
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function generate() {
    setError(null);
    setLetter("");
    setSources([]);
    setSavedId(null);
    setCopied(false);
    setPhase("research");
    setStatus("STARTING");

    // Bring the output panel into view once — not on every streamed token.
    setTimeout(() => letterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobText,
          jobUrl: url.trim() || null,
          company: company.trim() || null,
          role: role.trim() || null,
          tone,
          length,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error((await res.text()) || "The server refused that request.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Server-sent events: blocks separated by a blank line.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const event = block.match(/^event: (.+)$/m)?.[1];
          const raw = block.match(/^data: (.*)$/m)?.[1];
          if (!event || raw === undefined) continue;

          const data = JSON.parse(raw);

          if (event === "status") {
            setPhase(data.phase === "write" ? "write" : "research");
            setStatus(data.message);
          } else if (event === "sources") {
            setSources(data);
          } else if (event === "token") {
            setLetter((t) => t + data);
          } else if (event === "error") {
            throw new Error(data);
          } else if (event === "done") {
            setSavedId(data.id);
            setPhase("done");
            setStatus("");
            router.refresh();
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
      setPhase(letter ? "done" : "idle");
      setStatus("");
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const name = [company, role].filter(Boolean).join(" — ") || "cover-letter";
    const blob = new Blob([letter], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${name.replace(/[^\w\- ]+/g, "").trim()}.txt`;
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <>
      <h2 style={{ marginBottom: 6 }}>New letter</h2>
      <p className="hint" style={{ marginBottom: 18 }}>
        Paste a link, drop the posting in, or type it out.
      </p>

      {error ? <div className="notice notice--error">{error}</div> : null}

      {/* --- Source ------------------------------------------------------ */}
      <section className="panel">
        <div className="panel__head">
          <h3>The job</h3>
          <span className="step">01 / 02</span>
        </div>

        <div className="tabs" role="tablist">
          {(["link", "upload", "paste"] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              className="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === "link" ? (
          <>
            <div className="field">
              <label className="mono-label" htmlFor="url">
                Job posting URL
              </label>
              <input
                id="url"
                type="url"
                placeholder="https://company.com/careers/design-director"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <button
              className="btn btn--accent"
              disabled={!url.trim() || busy}
              onClick={() => ingest({ url: url.trim() })}
            >
              {phase === "reading" ? "Fetching…" : "Fetch posting"}
            </button>
            <p className="hint" style={{ marginTop: 10 }}>
              LinkedIn, Indeed and Glassdoor block server-side reads — for those,
              copy the text and use PASTE.
            </p>
          </>
        ) : null}

        {mode === "upload" ? (
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) ingest(file);
              }}
            />
            <button
              className="btn btn--accent"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              {phase === "reading" ? "Reading…" : "Choose file"}
            </button>
            <p className="hint" style={{ marginTop: 10 }}>PDF, DOCX, TXT or MD. Max 10MB.</p>
          </>
        ) : null}

        {mode === "paste" || jobText ? (
          <>
            <hr className="dotted" />
            <div className="field">
              <label className="mono-label" htmlFor="jobText">
                Job description {jobWords ? `— ${jobWords.toLocaleString()} words` : ""}
              </label>
              <textarea
                id="jobText"
                value={jobText}
                placeholder="Paste the full job description…"
                onChange={(e) => setJobText(e.target.value)}
                style={{ minHeight: 170 }}
              />
            </div>

            <div className="grid-2">
              <div className="field">
                <label className="mono-label" htmlFor="company">
                  Company
                </label>
                <input
                  id="company"
                  type="text"
                  placeholder="Who's hiring"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="mono-label" htmlFor="role">
                  Role
                </label>
                <input
                  id="role"
                  type="text"
                  placeholder="Job title"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
            </div>
            <p className="hint">
              Company and role are optional, but naming them makes the web
              research far better.
            </p>
          </>
        ) : null}
      </section>

      {/* --- Voice -------------------------------------------------------- */}
      <section className="panel">
        <div className="panel__head">
          <h3>Voice</h3>
          <span className="step">02 / 02</span>
        </div>

        <Slider
          label="Tone"
          value={tone}
          onChange={setTone}
          readout={toneBand(tone).label}
          min="Reserved"
          max="Bold"
          disabled={busy}
        />

        <Slider
          label="Length"
          value={length}
          onChange={setLength}
          readout={`≈${lengthBand(length).words} words`}
          min="Terse"
          max="Full"
          disabled={busy}
        />

        <div className="field" style={{ marginBottom: 0 }}>
          <label className="mono-label" htmlFor="notes">
            Anything for this letter only
          </label>
          <input
            id="notes"
            type="text"
            placeholder="Mention I met Priya at the conference"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </section>

      {/* --- Output ------------------------------------------------------- */}
      {busy || letter ? (
        <section className="panel panel--flush" ref={letterRef}>
          <div className="panel__head" style={{ margin: 0 }}>
            <h3>Letter</h3>
            <span className="step">
              {phase === "research"
                ? status || "RESEARCHING"
                : phase === "write"
                  ? "WRITING"
                  : `${letter.trim().split(/\s+/).filter(Boolean).length} WORDS`}
            </span>
          </div>

          {phase === "research" ? (
            <div className="console" style={{ border: 0, borderBottom: "1px solid var(--rule)" }}>
              <span className="blink">▮</span>
              <span>{status || "WORKING"}…</span>
            </div>
          ) : null}

          <div className={`letter ${phase === "write" ? "caret" : ""}`} style={{ border: 0 }}>
            {letter}
          </div>

          {sources.length ? (
            <div style={{ borderTop: "1px solid var(--rule)", padding: "14px 18px" }}>
              <span className="mono-label">Sources — {sources.length}</span>
              <ul className="sources">
                {sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title}
                    </a>
                    <span>{new URL(s.url).hostname.replace(/^www\./, "")}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {phase === "done" && letter ? (
            <div className="btn-row" style={{ borderTop: "1px solid var(--rule)", padding: 14 }}>
              <button className="btn btn--sm" onClick={copy}>
                {copied ? "Copied ✓" : "Copy"}
              </button>
              <button className="btn btn--sm" onClick={download}>
                Download .txt
              </button>
              {savedId ? (
                <a className="btn btn--sm btn--ghost" href={`/letters/${savedId}`}>
                  Open record
                </a>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="actionbar">
        <button
          className="btn btn--primary"
          disabled={busy || jobText.trim().length < 80}
          onClick={generate}
        >
          {busy ? status || "Working…" : letter ? "Write it again" : "Write the letter"}
        </button>
      </div>
    </>
  );
}
