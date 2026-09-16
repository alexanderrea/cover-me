"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function KeyForm({ hint, setAt }: { hint: string | null; setAt: string | null }) {
  const router = useRouter();

  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(!hint);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/settings/key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: value.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the key.");

      setValue("");
      setEditing(false);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the key.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Remove your API key? You won't be able to write letters until you add another.")) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/key", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't remove the key.");

      setEditing(true);
      setSaved(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the key.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <h3>Anthropic key</h3>
        <span className="step">{hint ? "ACTIVE" : "REQUIRED"}</span>
      </div>

      {error ? <div className="notice notice--error">{error}</div> : null}
      {saved ? <div className="notice notice--ok">Key verified and saved.</div> : null}

      {hint && !editing ? (
        <>
          <div className="field">
            <span className="mono-label">On file</span>
            <div style={{ fontSize: 16, letterSpacing: "0.04em" }}>{hint}</div>
            {setAt ? (
              <p className="hint" style={{ marginTop: 6 }}>
                Added{" "}
                {new Date(setAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
                .
              </p>
            ) : null}
          </div>

          <div className="btn-row">
            <button className="btn btn--sm" onClick={() => setEditing(true)} disabled={busy}>
              Replace
            </button>
            <button className="btn btn--sm btn--ghost" onClick={remove} disabled={busy}>
              {busy ? "Working…" : "Remove"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="hint" style={{ marginBottom: 12 }}>
            COVER ME runs on your own Anthropic key, so your letters are billed to
            you and nobody else. Create one at{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>
            . A letter costs a few cents.
          </p>

          <div className="field">
            <label className="mono-label" htmlFor="apiKey">
              API key
            </label>
            <input
              id="apiKey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>

          <div className="btn-row">
            <button
              className="btn btn--acid"
              onClick={save}
              disabled={busy || value.trim().length < 20}
            >
              {busy ? "Verifying…" : "Verify and save"}
            </button>
            {hint ? (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setEditing(false);
                  setValue("");
                  setError(null);
                }}
                disabled={busy}
              >
                Cancel
              </button>
            ) : null}
          </div>

          <hr className="dotted" />

          <p className="hint">
            The key is checked against Anthropic before it&apos;s stored, then
            encrypted at rest. It&apos;s never sent back to this page — only the
            last four characters are.
          </p>
        </>
      )}
    </section>
  );
}
