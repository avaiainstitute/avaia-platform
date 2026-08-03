"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LibrarySuggestion } from "@/lib/library";

export default function AdminSuggestionRow({ suggestion }: { suggestion: LibrarySuggestion }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function review(action: "approve" | "reject") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/library/suggestions/${suggestion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not review this suggestion.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
      <p className="font-serif text-lg text-ink">{suggestion.title}</p>
      {suggestion.author && <p className="text-sm text-muted">By {suggestion.author}</p>}
      {suggestion.link && (
        <a
          href={suggestion.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-seal hover:underline"
        >
          {suggestion.link}
        </a>
      )}
      {suggestion.description && <p className="mt-2 text-sm text-ink">{suggestion.description}</p>}
      <p className="mt-2 text-sm text-muted">
        <span className="text-ink">Why relevant: </span>
        {suggestion.why_relevant}
      </p>
      {(suggestion.suggested_virtue_family || suggestion.suggested_secondary_loss || suggestion.suggested_program) && (
        <p className="mt-2 text-xs text-muted">
          Suggested: {[suggestion.suggested_virtue_family, suggestion.suggested_secondary_loss, suggestion.suggested_program]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-[#e0857d]">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => review("approve")}
          disabled={busy}
          className="rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Approve → draft entry
        </button>
        <button
          type="button"
          onClick={() => review("reject")}
          disabled={busy}
          className="rounded-md border border-rule px-4 py-2 font-sans text-sm text-muted transition-colors hover:border-seal hover:text-ink disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
