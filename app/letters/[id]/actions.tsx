"use client";

import { useState } from "react";

export function LetterActions({ body, filename }: { body: string; filename: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${filename.replace(/[^\w\- ]+/g, "").trim()}.txt`;
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="btn-row" style={{ marginBottom: 18 }}>
      <button className="btn btn--sm" onClick={copy}>
        {copied ? "Copied ✓" : "Copy"}
      </button>
      <button className="btn btn--sm" onClick={download}>
        Download .txt
      </button>
    </div>
  );
}
