import type { Experience } from "@/lib/experiences";
import {
  groupSectionsByType,
  SECTION_TYPE_LABEL,
  type ExperienceSection,
  type SectionType,
} from "@/lib/experience-sections";
import type { ToolKey, ToolStatus } from "@/lib/toolkit";

/** Reusable Experience-detail presentation. Used today by the
 *  admin-only draft-preview route; the eventual Guide-facing
 *  `/toolkit/experiences/[experienceId]` route is meant to render the
 *  exact same component against published-only data, so "preview"
 *  genuinely means "preview what a Guide will eventually see" — not a
 *  separate UI that has to be rebuilt later. No section is invented
 *  for a category the Experience's own source doesn't support; a
 *  group with zero rows simply doesn't render. */

export type ComponentAvailabilityItem = {
  key: ToolKey;
  label: string;
  status: ToolStatus;
  statusLabel: string;
};

export type RelatedClass = {
  id: string;
  title: string;
  family: string;
};

type ExperienceDetailProps = {
  experience: Experience;
  sections: ExperienceSection[];
  componentAvailability: ComponentAvailabilityItem[];
  relatedClasses: RelatedClass[];
};

/** Presentation order, not document order — grouped by what the
 *  Guide is trying to do, per the approved Experience Detail design.
 *  A heading naming several section_types (e.g. "Before You
 *  Facilitate") is a single filtered view over the same underlying
 *  rows, not a separate content system. */
const LAYOUT_GROUPS: { heading: string; types: SectionType[] }[] = [
  { heading: "Orientation", types: ["orientation"] },
  { heading: "Anchor & Signature Question", types: ["anchor", "question"] },
  { heading: "Before You Facilitate", types: ["governing_distinction", "boundary", "guide_preparation"] },
  { heading: "Reference", types: ["reference"] },
  { heading: "The Arc", types: ["movement"] },
  { heading: "Activities", types: ["activity"] },
  { heading: "Conversation Windows", types: ["conversation_window"] },
  { heading: "Participant Guide", types: ["participant_guide"] },
  { heading: "Take-Home", types: ["take_home"] },
  { heading: "Formats", types: ["format_variant"] },
  { heading: "Definition of Success", types: ["success_definition"] },
];

export default function ExperienceDetail({
  experience,
  sections,
  componentAvailability,
  relatedClasses,
}: ExperienceDetailProps) {
  const grouped = groupSectionsByType(sections);

  return (
    <div>
      <p className="label mb-3">
        Full AVAIA Experience
        {experience.status !== "published" ? " — DRAFT PREVIEW" : ""}
      </p>
      <h1 className="font-serif text-4xl text-ink">{experience.title}</h1>
      {experience.summary && <p className="mt-4 text-lg text-muted">{experience.summary}</p>}

      {experience.conversation_stages.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          Conversation stages: {experience.conversation_stages.join(" → ")}
        </p>
      )}

      {componentAvailability.length > 0 && (
        <section className="mt-10">
          <p className="label mb-3 text-muted">Components</p>
          <div className="flex flex-wrap gap-2">
            {componentAvailability.map((c) => (
              <span
                key={c.key}
                className="rounded-md border border-rule px-3 py-1 text-sm text-ink"
              >
                {c.label} — {c.statusLabel}
              </span>
            ))}
          </div>
        </section>
      )}

      {relatedClasses.length > 0 && (
        <section className="mt-10">
          <p className="label mb-3 text-muted">Related Classes</p>
          <ul className="list-disc pl-5 text-ink">
            {relatedClasses.map((c) => (
              <li key={c.id}>{c.title}</li>
            ))}
          </ul>
        </section>
      )}

      {LAYOUT_GROUPS.map(({ heading, types }) => {
        const rows = types.flatMap((t) => grouped[t] ?? []);
        if (rows.length === 0) return null;
        return (
          <section key={heading} className="rule-t mt-14 border-t border-rule pt-8">
            <p className="label mb-3 text-muted">{heading}</p>
            <div className="space-y-4">
              {rows.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    {s.title && <p className="font-serif text-lg text-ink">{s.title}</p>}
                    <span className="label shrink-0 text-muted">
                      {SECTION_TYPE_LABEL[s.section_type]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
