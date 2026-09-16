"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";

const FIELDS = [
  { key: "full_name", label: "Full name", type: "text", placeholder: "Alexander Rea" },
  { key: "email", label: "Email", type: "email", placeholder: "you@example.com" },
  { key: "phone", label: "Phone", type: "tel", placeholder: "+44 7700 900000" },
  { key: "location", label: "Location", type: "text", placeholder: "London, UK" },
  { key: "linkedin_url", label: "LinkedIn URL", type: "url", placeholder: "linkedin.com/in/you" },
  { key: "portfolio_url", label: "Portfolio / site", type: "url", placeholder: "yoursite.com" },
] as const;

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(profile);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus("idle");
  };

  async function uploadResume(file: File) {
    setUploading(true);
    setError(null);

    try {
      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/api/ingest", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Couldn't read that file.");

      setForm((f) => ({ ...f, resume_text: data.text, resume_name: data.name }));
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function save() {
    setStatus("saving");
    setError(null);

    const { id, updated_at, ...patch } = form;

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't save.");
      setStatus("idle");
      return;
    }

    setStatus("saved");
    router.refresh();
  }

  const resumeWords = form.resume_text?.trim().split(/\s+/).length ?? 0;

  return (
    <>
      <h2 style={{ marginBottom: 6 }}>About you</h2>
      <p className="hint" style={{ marginBottom: 18 }}>
        Every letter is written from this. The more that&apos;s here, the less
        generic it reads.
      </p>

      {error ? <div className="notice notice--error">{error}</div> : null}

      {/* --- Contact --------------------------------------------------- */}
      <section className="panel">
        <div className="panel__head">
          <h3>Details</h3>
          <span className="step">01 / 04</span>
        </div>

        <div className="grid-2">
          {FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label className="mono-label" htmlFor={f.key}>
                {f.label}
              </label>
              <input
                id={f.key}
                type={f.type}
                placeholder={f.placeholder}
                value={form[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label className="mono-label" htmlFor="headline">
            One-line headline
          </label>
          <input
            id="headline"
            type="text"
            placeholder="Design director — brand and product, 12 years"
            value={form.headline ?? ""}
            onChange={(e) => set("headline", e.target.value)}
          />
        </div>
      </section>

      {/* --- Resume ---------------------------------------------------- */}
      <section className="panel">
        <div className="panel__head">
          <h3>Resume</h3>
          <span className="step">02 / 04</span>
        </div>

        {form.resume_name || resumeWords > 0 ? (
          <div className="notice notice--ok" style={{ marginBottom: 14 }}>
            LOADED — {form.resume_name ?? "pasted text"} · {resumeWords.toLocaleString()} words
          </div>
        ) : (
          <p className="hint" style={{ marginBottom: 14 }}>
            PDF, DOCX, TXT or MD. Text is extracted and stored; the file itself
            isn&apos;t kept.
          </p>
        )}

        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadResume(file);
          }}
        />

        <div className="btn-row" style={{ marginBottom: 14 }}>
          <button
            className="btn btn--acid"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Reading…" : form.resume_text ? "Replace file" : "Upload resume"}
          </button>
          {form.resume_text ? (
            <button
              className="btn btn--ghost"
              onClick={() => {
                set("resume_text", null);
                set("resume_name", null);
              }}
            >
              Clear
            </button>
          ) : null}
        </div>

        <label className="mono-label" htmlFor="resume_text">
          Extracted text — edit freely
        </label>
        <textarea
          id="resume_text"
          value={form.resume_text ?? ""}
          placeholder="Or paste your resume here."
          onChange={(e) => set("resume_text", e.target.value)}
          style={{ minHeight: 180 }}
        />
      </section>

      {/* --- LinkedIn --------------------------------------------------- */}
      <section className="panel">
        <div className="panel__head">
          <h3>LinkedIn</h3>
          <span className="step">03 / 04</span>
        </div>

        <p className="hint" style={{ marginBottom: 12 }}>
          LinkedIn blocks automated reads of profiles, so paste yours here.
          Open your profile, select all, paste. Or use{" "}
          <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noreferrer">
            Get a copy of your data
          </a>
          . It often carries detail a resume trims out.
        </p>

        <textarea
          id="linkedin_text"
          value={form.linkedin_text ?? ""}
          placeholder="Paste your LinkedIn profile text…"
          onChange={(e) => set("linkedin_text", e.target.value)}
          style={{ minHeight: 160 }}
        />
      </section>

      {/* --- Standing rules --------------------------------------------- */}
      <section className="panel">
        <div className="panel__head">
          <h3>Standing rules</h3>
          <span className="step">04 / 04</span>
        </div>

        <p className="hint" style={{ marginBottom: 12 }}>
          Applied to every letter. &ldquo;British spelling.&rdquo; &ldquo;Never
          mention the gap in 2019.&rdquo; &ldquo;Don&apos;t call me a guru.&rdquo;
        </p>

        <textarea
          id="notes"
          value={form.notes ?? ""}
          placeholder="Anything the writer should always know…"
          onChange={(e) => set("notes", e.target.value)}
          style={{ minHeight: 90 }}
        />
      </section>

      <div className="actionbar">
        <button
          className="btn btn--primary"
          onClick={save}
          disabled={status === "saving"}
        >
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save details"}
        </button>
      </div>
    </>
  );
}
