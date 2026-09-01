"use client";

import { useState } from "react";
import Link from "next/link";
import type { Experience } from "@/lib/experiences";
import {
  groupSectionsByType,
  parseModuleFields,
  parseModuleMovement,
  SECTION_TYPE_LABEL,
  type ExperienceSection,
  type SectionType,
} from "@/lib/experience-sections";
import type { ComponentAvailabilityItem, RelatedClass } from "@/components/ExperienceDetail";

/** Delivery interface for the Defying Grief Master Curriculum -- rendered
 *  by both the Guide-facing (app/toolkit/experiences/[experienceId]) and
 *  admin draft-preview routes in place of the generic ExperienceDetail,
 *  whenever an Experience's own `components` tags include "defying-grief"
 *  (see lib/experiences.ts / migration 0030). Reads only `experiences`
 *  and `experience_sections` -- the same rows ExperienceDetail already
 *  reads, grouped and navigated differently. No new content, no new
 *  table, no Host/participant data of any kind. */

type DefyingGriefCurriculumProps = {
  experience: Experience;
  sections: ExperienceSection[];
  componentAvailability: ComponentAvailabilityItem[];
  relatedClasses: RelatedClass[];
};

type TabKey =
  | "overview"
  | "curriculum"
  | "formats"
  | "activities"
  | "participant"
  | "facilitator"
  | "takehome";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "curriculum", label: "Master Curriculum" },
  { key: "formats", label: "Delivery Formats" },
  { key: "activities", label: "Activities" },
  { key: "participant", label: "Participant Materials" },
  { key: "facilitator", label: "Facilitator Guide" },
  { key: "takehome", label: "Take-Home & Continuity" },
];

const MOVEMENT_ORDER = ["Awareness", "Understanding", "Agency"] as const;

const OVERVIEW_TYPES: SectionType[] = [
  "orientation",
  "governing_distinction",
  "anchor",
  "question",
  "boundary",
  "reference",
  "conversation_window",
  "success_definition",
];

export default function DefyingGriefCurriculum({
  experience,
  sections,
  componentAvailability,
  relatedClasses,
}: DefyingGriefCurriculumProps) {
  const grouped = groupSectionsByType(sections);
  const modules = (grouped.movement ?? []).slice().sort((a, b) => a.position - b.position);
  const guidePreparation = grouped.guide_preparation ?? [];
  const participantGuide = grouped.participant_guide ?? [];
  const activities = grouped.activity ?? [];
  const formatVariants = grouped.format_variant ?? [];
  const takeHome = grouped.take_home ?? [];
  const overviewRows = OVERVIEW_TYPES.flatMap((t) => grouped[t] ?? []);

  const modulesByMovement = new Map<string, ExperienceSection[]>();
  for (const m of modules) {
    const movement = parseModuleMovement(m.body) ?? "Other";
    if (!modulesByMovement.has(movement)) modulesByMovement.set(movement, []);
    modulesByMovement.get(movement)!.push(m);
  }

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(
    formatVariants[0]?.id ?? null
  );
  const selectedFormat = formatVariants.find((f) => f.id === selectedFormatId) ?? null;

  function toggleModule(id: string) {
    setOpenModules((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function activityUsage(activityTitle: string | null): string[] {
    if (!activityTitle) return [];
    const used: string[] = [];
    for (const m of modules) {
      if (m.body.toLowerCase().includes(activityTitle.toLowerCase())) {
        used.push(`Module ${m.position}${m.title ? ` — ${m.title}` : ""}`);
      }
    }
    return used;
  }

  function isYouth(row: ExperienceSection): boolean {
    return /youth/i.test(row.title ?? "") || /youth/i.test(row.body);
  }

  return (
    <div>
      <p className="label mb-3">
        Defying Grief — A Sacred Rebellion
        {experience.status !== "published" ? " — DRAFT PREVIEW" : ""}
      </p>
      <h1 className="font-serif text-4xl text-ink">Master Curriculum</h1>
      <p className="mt-3 text-sm text-muted">
        Content foundation: <span className="text-ink">{experience.title}</span> — one component
        inside Defying Grief, not the entire program.
      </p>
      <p className="mt-4 text-lg text-muted">Awareness → Understanding → Agency</p>

      <div className="mt-6 rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
        <p className="text-sm text-muted">
          This is the curriculum content foundation — teaching sequence, activities, and delivery
          formats for facilitating Defying Grief to a room or an individual. To start a live,
          one-on-one facilitated Defying Grief conversation with a participant instead, use{" "}
          <Link
            href="/toolkit/defying-grief"
            className="text-ink underline decoration-rule underline-offset-2 hover:text-seal"
          >
            the Defying Grief tool
          </Link>{" "}
          in the Toolkit.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-2 border-t border-rule pt-8">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={
              activeTab === t.key
                ? "rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b]"
                : "rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-muted transition-colors hover:border-seal hover:text-ink"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <section className="mt-10">
          {experience.summary && <p className="text-lg text-muted">{experience.summary}</p>}

          {componentAvailability.length > 0 && (
            <div className="mt-8">
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
            </div>
          )}

          {relatedClasses.length > 0 && (
            <div className="mt-8">
              <p className="label mb-3 text-muted">Related Classes</p>
              <ul className="list-disc pl-5 text-ink">
                {relatedClasses.map((c) => (
                  <li key={c.id}>{c.title}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 space-y-4">
            {overviewRows.map((s) => (
              <div key={s.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
                <div className="flex items-baseline justify-between gap-2">
                  {s.title && <p className="font-serif text-lg text-ink">{s.title}</p>}
                  <span className="label shrink-0 text-muted">
                    {SECTION_TYPE_LABEL[s.section_type]}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "curriculum" && (
        <section className="mt-10 space-y-12">
          {MOVEMENT_ORDER.map((movement) => {
            const rows = modulesByMovement.get(movement) ?? [];
            if (rows.length === 0) return null;
            return (
              <div key={movement}>
                <p className="label mb-4 text-muted">{movement}</p>
                <div className="space-y-3">
                  {rows.map((m) => {
                    const isOpen = !!openModules[m.id];
                    const fields = parseModuleFields(m.body);
                    return (
                      <div key={m.id} className="rounded-lg border border-rule bg-white/[0.04]">
                        <button
                          type="button"
                          onClick={() => toggleModule(m.id)}
                          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                        >
                          <span className="font-serif text-lg text-ink">
                            Module {m.position} — {m.title}
                          </span>
                          <span className="label shrink-0 text-muted">
                            {isOpen ? "Close" : "Open"}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="space-y-4 border-t border-rule px-5 py-5">
                            {fields.length > 0 ? (
                              fields.map((f, i) => (
                                <div key={i}>
                                  <p className="label text-muted">{f.label}</p>
                                  <p className="mt-1 text-sm text-ink">{f.text}</p>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-ink">{m.body}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {activeTab === "formats" && (
        <section className="mt-10">
          <p className="text-sm text-muted">
            Every format selects or compresses modules from the same eleven-module sequence above
            — none introduce a different sequence. Select a format to read what it includes, in
            what order, and what is omitted or compressed.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {formatVariants.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFormatId(f.id)}
                className={
                  selectedFormatId === f.id
                    ? "rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b]"
                    : "rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-muted transition-colors hover:border-seal hover:text-ink"
                }
              >
                {f.title}
                {isYouth(f) ? " (Safeguarded)" : ""}
              </button>
            ))}
          </div>

          {selectedFormat && (
            <div className="mt-6 rounded-lg border border-rule bg-white/[0.04] px-5 py-5">
              <p className="font-serif text-lg text-ink">{selectedFormat.title}</p>
              {isYouth(selectedFormat) && (
                <p className="mt-2 rounded-md border border-rule px-3 py-2 text-xs text-muted">
                  Safeguarded / deferred — Youth delivery requires the separate AVAIA youth
                  safeguards and guardian-consent architecture. Not operational through this
                  interface.
                </p>
              )}
              <p className="mt-3 whitespace-pre-line text-sm text-ink">{selectedFormat.body}</p>
            </div>
          )}
        </section>
      )}

      {activeTab === "activities" && (
        <section className="mt-10 space-y-4">
          {activities.map((a) => {
            const usedIn = activityUsage(a.title);
            return (
              <div key={a.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
                {a.title && <p className="font-serif text-lg text-ink">{a.title}</p>}
                <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.body}</p>
                <p className="mt-3 text-xs text-muted">
                  {usedIn.length > 0
                    ? `Used in: ${usedIn.join(", ")}`
                    : "Not directly named in a Master Curriculum module."}
                </p>
              </div>
            );
          })}
        </section>
      )}

      {activeTab === "participant" && (
        <section className="mt-10">
          <div className="rounded-md border border-rule px-4 py-3 text-xs text-muted">
            PARTICIPANT MATERIAL — previewed here for your preparation only, exactly as a
            participant would see it. Nothing a participant writes here becomes visible to you.
          </div>
          <div className="mt-5 space-y-4">
            {participantGuide.map((p) => (
              <div key={p.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
                {p.title && <p className="font-serif text-lg text-ink">{p.title}</p>}
                <p className="mt-2 whitespace-pre-line text-sm text-ink">{p.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "facilitator" && (
        <section className="mt-10">
          <div className="rounded-md border border-rule px-4 py-3 text-xs text-muted">
            FACILITATOR MATERIAL — preparation and delivery guidance, not shown to participants.
          </div>
          <div className="mt-5 space-y-4">
            {guidePreparation.map((g) => (
              <div key={g.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
                {g.title && <p className="font-serif text-lg text-ink">{g.title}</p>}
                <p className="mt-2 whitespace-pre-line text-sm text-ink">{g.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "takehome" && (
        <section className="mt-10 space-y-4">
          {takeHome.map((t) => (
            <div key={t.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              {t.title && <p className="font-serif text-lg text-ink">{t.title}</p>}
              <p className="mt-2 whitespace-pre-line text-sm text-ink">{t.body}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
