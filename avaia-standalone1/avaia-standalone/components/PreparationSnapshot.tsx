"use client";

import { useState } from "react";
import type { ParticipantSnapshot } from "@/lib/engine/preparation";

/** One bounded, Guide-triggered generation -- never a conversation, never
 *  auto-run on page load (matching Preparation's own "does not conduct
 *  conversations" boundary and avoiding an AI call on every page view).
 *  Sits above the existing, unchanged ThreadsRecorded / FullSessionDetails
 *  sections on /toolkit/preparation/[participantId] -- this is the one
 *  generative piece that page never had; those two stay exactly as they
 *  were, a strict, non-generative record of what's already on file. */

const FIELDS: { key: keyof ParticipantSnapshot; label: string }[] = [
  { key: "currentFocus", label: "Current Focus" },
  { key: "whatsStillActive", label: "What's Still Active" },
  { key: "strengthsVisible", label: "Strengths Visible" },
  { key: "growthOpportunities", label: "Growth Opportunities" },
  { key: "questionsWorthRevisiting", label: "Questions Worth Revisiting" },
  { key: "whatHasChanged", label: "What Has Changed" },
  { key: "guideReminder", label: "Guide Reminder" },
];

export default function PreparationSnapshot({ participantId }: { participantId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [snapshot, setSnapshot] = useState<ParticipantSnapshot | null>(null);
  const [error, setError] = useState("");

  async function generate() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/preparation/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not generate the snapshot.");
      setSnapshot(data.snapshot);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="label text-muted">Participant Snapshot</p>
          <p className="mt-1 text-sm text-muted">
            Generated only from what&rsquo;s already on record above — organized, not interpreted.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={status === "loading"}
          className="shrink-0 rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? "Generating…" : snapshot ? "Regenerate" : "Generate Participant Snapshot"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-[#e0857d]">{error}</p>}

      {snapshot && (
        <dl className="mt-5 space-y-4">
          {FIELDS.map(({ key, label }) => {
            const value = snapshot[key]?.trim();
            if (!value) return null;
            return (
              <div key={key}>
                <dt className="label text-muted">{label}</dt>
                <dd className="mt-1 text-sm text-ink">{value}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}
