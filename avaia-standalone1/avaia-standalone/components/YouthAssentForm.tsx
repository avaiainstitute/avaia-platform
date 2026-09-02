"use client";

import { useState } from "react";
import { YOUTH_ASSENT_TEXT } from "@/lib/youth-assent-text";
import type { DevelopmentalBand } from "@/lib/engine/prompts";

const BAND_LABEL: Record<DevelopmentalBand, string> = {
  "8-11": "8–11",
  "12-14": "12–14",
  "15-17": "15–17",
};

/** Band selection plus the Youth Host's own assent acknowledgment --
 *  separate from guardian consent (captured earlier, at /welcome, for a
 *  self-serve Host). This is the Youth Host's own understanding of what
 *  participation actually involves, shown at their own band's reading
 *  level, before they can begin. A client component because the assent
 *  text shown must follow whichever band the Host has actually picked,
 *  with no server round-trip in between. */
export default function YouthAssentForm({
  action,
  defaultBand,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  defaultBand: DevelopmentalBand | null;
  submitLabel: string;
}) {
  const [band, setBand] = useState<DevelopmentalBand | null>(defaultBand);
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <form action={action}>
      <fieldset className="mt-8">
        <legend className="label mb-3">Developmental band</legend>
        {(Object.keys(BAND_LABEL) as DevelopmentalBand[]).map((b) => (
          <label
            key={b}
            className="mt-2 flex cursor-pointer items-start gap-3 rounded-md border border-rule bg-white/[0.03] px-4 py-3 first:mt-0"
          >
            <input
              type="radio"
              name="band"
              value={b}
              checked={band === b}
              onChange={() => {
                setBand(b);
                setAcknowledged(false);
              }}
              className="mt-1"
              required
            />
            <span className="text-ink">{BAND_LABEL[b]}</span>
          </label>
        ))}
      </fieldset>

      {band && (
        <div className="mt-6 rounded-lg border border-seal/40 bg-seal/[0.06] p-5">
          <p className="label mb-3">Before you begin</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{YOUTH_ASSENT_TEXT[band]}</p>
          <label className="mt-5 flex cursor-pointer items-start gap-3 border-t border-rule pt-4">
            <input
              type="checkbox"
              name="assentAcknowledged"
              value="1"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1"
              required
            />
            <span className="text-sm text-ink">I read this and understand it.</span>
          </label>
        </div>
      )}

      <button
        type="submit"
        disabled={!band || !acknowledged}
        className="mt-8 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
