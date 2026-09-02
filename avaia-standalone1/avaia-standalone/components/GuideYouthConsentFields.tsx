"use client";

import { useState } from "react";
import { YOUTH_ASSENT_TEXT } from "@/lib/youth-assent-text";
import type { DevelopmentalBand } from "@/lib/engine/prompts";

const BAND_LABEL: Record<DevelopmentalBand, string> = {
  "8-11": "8–11",
  "12-14": "12–14",
  "15-17": "15–17",
};

/** The shared block of form fields any Guide-facilitated Youth start form
 *  needs: developmental band, guardian consent (name/email + a required
 *  confirmation that the Guide actually collected it), and the Guide's
 *  own confirmation that they communicated the age-appropriate
 *  participation information to the Youth Host themselves -- two
 *  separate things per the governing decision (guardian authorizes
 *  participation; the Youth Host's own understanding is a distinct
 *  requirement). Used by both the individual Guide-facilitated entry
 *  point and the group/workshop one, so the two can never drift out of
 *  sync on what consent actually requires. Renders only the fields --
 *  each page keeps its own participant name/email fields and submit
 *  button around this. */
export default function GuideYouthConsentFields({
  sponsoringOrganizationField = false,
  bandOptional = false,
}: {
  /** Show the optional sponsoring-organization field -- only the
   *  school/organization-sponsored context needs it. */
  sponsoringOrganizationField?: boolean;
  /** When true, band starts unselected and isn't required -- for a tool
   *  most participants use as adults (Unsung Heroes), where a Guide only
   *  sets a band when this specific participant is actually a Youth Host.
   *  Guardian consent then becomes required only once a band is picked --
   *  an adult session stays exactly as simple as before this component
   *  existed. Youth Defying Grief, where every participant is a Youth
   *  Host by definition, keeps band and guardian consent always required
   *  (the default). */
  bandOptional?: boolean;
}) {
  const [band, setBand] = useState<DevelopmentalBand | "">("");
  const showGuardianFields = !bandOptional || band !== "";

  return (
    <>
      <fieldset className="mt-6">
        <legend className="label mb-3">
          Developmental band{bandOptional ? " (only if this participant is a young person)" : ""}
        </legend>
        {bandOptional && (
          <p className="mb-2 text-sm text-muted">
            Leave unselected for an adult participant. Setting a band adapts this conversation and
            requires guardian consent below, the same as Youth Defying Grief.
          </p>
        )}
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
              onChange={() => setBand(b)}
              className="mt-1"
              required={!bandOptional}
            />
            <span className="text-ink">{BAND_LABEL[b]}</span>
          </label>
        ))}
      </fieldset>

      {band && (
        <div className="mt-6 rounded-lg border border-seal/40 bg-seal/[0.06] p-5">
          <p className="label mb-3">Youth participation information — {BAND_LABEL[band]}</p>
          <p className="mb-3 text-sm text-muted">
            Communicate this to the Youth Host yourself, in whatever form fits the moment —
            reading it aloud, paraphrasing it, or handing it to them to read. It is their own
            understanding of what participation involves, separate from guardian consent below.
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{YOUTH_ASSENT_TEXT[band]}</p>
        </div>
      )}

      {showGuardianFields && (
        <div className="mt-6 rounded-lg border border-rule bg-white/[0.03] p-5">
          <p className="label mb-3">Guardian consent</p>
          <p className="mb-4 text-sm text-muted">
            Guardian consent authorizes this Youth Host&rsquo;s participation. It does not give the
            guardian, a school, or a sponsoring organization access to what the Youth Host says
            privately in this conversation.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label mb-2 block" htmlFor="guardianName">
                Parent/guardian name
              </label>
              <input
                id="guardianName"
                name="guardianName"
                type="text"
                required
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
            </div>
            <div>
              <label className="label mb-2 block" htmlFor="guardianEmail">
                Parent/guardian email
              </label>
              <input
                id="guardianEmail"
                name="guardianEmail"
                type="email"
                required
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
            </div>
          </div>

          {sponsoringOrganizationField && (
            <div className="mt-4">
              <label className="label mb-2 block" htmlFor="sponsoringOrganization">
                Sponsoring school or organization (optional)
              </label>
              <input
                id="sponsoringOrganization"
                name="sponsoringOrganization"
                type="text"
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
              <p className="mt-2 text-xs text-muted">
                Arranging or sponsoring participation does not give the school or organization
                access to this Youth Host&rsquo;s private conversation.
              </p>
            </div>
          )}

          <label className="mt-5 flex cursor-pointer items-start gap-3 border-t border-rule pt-4">
            <input type="checkbox" name="guardianConsentConfirmed" value="1" required className="mt-1" />
            <span className="text-sm text-ink">
              I confirm this participant&rsquo;s parent or guardian has given permission for
              participation, per the information above.
            </span>
          </label>
          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="assentDelivered" value="1" required className="mt-1" />
            <span className="text-sm text-ink">
              I have communicated the age-appropriate participation information above to this
              Youth Host, in a form that fits them.
            </span>
          </label>
        </div>
      )}
    </>
  );
}
