"use client";

import { useState } from "react";
import { virtueChemistryHref } from "@/components/VirtueLink";
import type { VirtueClassification } from "@/lib/engine/referral-provenance";

/** "What Became Visible" -- the Chemistry connection point requested for
 *  the Journey completion card (and reused by Unsung Heroes): each
 *  virtue/element a completed conversation already recognized (the same
 *  structured data Workbook renders, from CompletionSummary.virtues),
 *  offered with two Host-controlled actions -- explore its real Chemistry
 *  entry, or add it to the Host's own living Virtue Signature. Recognition
 *  never becomes identity automatically; "Consider for My Virtue
 *  Signature" is the one and only path an entry reaches
 *  virtue_signature_entries, and it only ever fires on the Host's own
 *  click. */
export default function WhatBecameVisible({
  virtues,
  sourceType,
  sourceReference,
  participantId,
}: {
  virtues: VirtueClassification[];
  sourceType: "conversation_referral" | "unsung_heroes";
  sourceReference?: string | null;
  /** Set only inside a Guide-facilitated session -- routes the entry to
   *  this participant's own Signature instead of the signed-in Guide's.
   *  Omitted (self-serve), it lands on the Host's own Signature as before. */
  participantId?: string | null;
}) {
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<number | null>(null);

  if (virtues.length === 0) return null;

  async function consider(v: VirtueClassification, index: number) {
    setPending(index);
    try {
      const res = await fetch("/api/virtue-signature/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layer: "recognize_in_myself",
          family: v.family,
          element: v.element,
          sourceType,
          sourceReference: sourceReference ?? null,
          participantId: participantId ?? null,
        }),
      });
      if (res.ok) setAdded((prev) => new Set(prev).add(index));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-seal/40 bg-seal/[0.06] p-4">
      <p className="label mb-3 text-muted">What Became Visible</p>
      <div className="space-y-2">
        {virtues.map((v, i) => (
          <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-ink">{v.element ? `${v.family} — ${v.element}` : v.family}</span>
            <div className="flex items-center gap-3">
              <a
                href={virtueChemistryHref(v.family, v.element)}
                className="text-xs text-ink underline decoration-rule underline-offset-2 hover:text-seal"
              >
                Explore in Chemistry
              </a>
              {added.has(i) ? (
                <span className="text-xs text-muted">Added to your Signature</span>
              ) : (
                <button
                  type="button"
                  onClick={() => consider(v, i)}
                  disabled={pending === i}
                  className="rounded-md border border-rule px-3 py-1 text-xs text-ink transition-colors hover:border-seal disabled:opacity-50"
                >
                  {pending === i ? "Adding…" : "Consider for My Virtue Signature"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
