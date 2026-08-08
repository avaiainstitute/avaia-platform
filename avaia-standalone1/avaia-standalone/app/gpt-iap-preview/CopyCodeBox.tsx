"use client";

import { useState } from "react";

// Small client component — a click handler can't exist in the Server
// Component page.tsx renders from, so this one tightly-scoped file is the
// single necessary exception to "everything in page.tsx." Nothing else
// about the feature lives here; it only displays a code and copies it.
export default function CopyCodeBox({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the code is still visible and
      // selectable by hand, so this fails quietly.
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <code className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 font-mono text-sm text-ink backdrop-blur-sm break-all">
        {value}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
