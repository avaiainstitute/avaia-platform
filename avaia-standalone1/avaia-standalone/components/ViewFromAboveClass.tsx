"use client";

import { useState } from "react";
import Link from "next/link";
import type { Experience } from "@/lib/experiences";
import {
  groupSectionsByType,
  parseModuleFields,
  type ExperienceSection,
} from "@/lib/experience-sections";
import type { ComponentAvailabilityItem, RelatedClass } from "@/components/ExperienceDetail";
import { VIEW_FROM_ABOVE_CLASSES } from "@/lib/view-from-above";

/** Delivery interface for a View From Above class -- rendered by both the
 *  Guide-facing (app/toolkit/experiences/[experienceId]) and admin
 *  draft-preview routes in place of the generic ExperienceDetail,
 *  whenever an Experience's `components` tags include "view-from-above"
 *  (see lib/experiences.ts / migration 0055). Mirrors
 *  DefyingGriefCurriculum.tsx's structure exactly -- same pattern, content
 *  reorganized for this collection's own field set (a single class, not
 *  an eleven-module program, so one "movement" row rather than many).
 *  Reads only `experiences` and `experience_sections` -- no new table, no
 *  Host/participant data of any kind. */

type ViewFromAboveClassProps = {
  experience: Experience;
  sections: ExperienceSection[];
  componentAvailability: ComponentAvailabilityItem[];
  relatedClasses: RelatedClass[];
};

type TabKey = "overview" | "teaching" | "activities" | "personal" | "conversation" | "takehome" | "formats";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview & Hike Lesson" },
  { key: "teaching", label: "Shared Teaching" },
  { key: "activities", label: "Activities" },
  { key: "personal", label: "Personal Recognition" },
  { key: "conversation", label: "Private Conversation" },
  { key: "takehome", label: "Take-Home" },
  { key: "formats", label: "Formats" },
];

export default function ViewFromAboveClass({
  experience,
  sections,
  componentAvailability,
  relatedClasses,
}: ViewFromAboveClassProps) {
  const grouped = groupSectionsByType(sections);
  const orientation = grouped.orientation ?? [];
  const hikeLesson = grouped.hike_lesson ?? [];
  const question = grouped.question?.[0] ?? null;
  const anchor = grouped.anchor?.[0] ?? null;
  const virtueFamily = grouped.reference?.[0] ?? null;
  const storiesExamples = grouped.reference?.[1] ?? null;
  const successDefinition = grouped.success_definition?.[0] ?? null;
  const movement = grouped.movement?.[0] ?? null;
  const guidePreparation = grouped.guide_preparation ?? [];
  const boundary = grouped.boundary ?? [];
  const activities = grouped.activity ?? [];
  const participantGuide = grouped.participant_guide ?? [];
  const conversationWindows = grouped.conversation_window ?? [];
  const takeHome = grouped.take_home ?? [];
  const formatVariants = grouped.format_variant ?? [];

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const movementFields = movement ? parseModuleFields(movement.body) : [];
  const matchingSlug = VIEW_FROM_ABOVE_CLASSES.find((c) => c.title === experience.title)?.slug ?? "";

  return (
    <div>
      <p className="label mb-3">
        View From Above — A Class Built on Bailand's Hike
        {experience.status !== "published" ? " — DRAFT PREVIEW" : ""}
      </p>
      <h1 className="font-serif text-4xl text-ink">{experience.title}</h1>
      {experience.summary && <p className="mt-3 text-lg text-muted">{experience.summary}</p>}
      {question && <p className="mt-4 font-serif text-xl italic text-ink">{question.body}</p>}

      <div className="mt-6 rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
        <p className="text-sm text-muted">
          This is the curriculum content foundation for facilitating this class to a room or an
          individual. A member can also take this same class self-directed at{" "}
          <Link
            href="/view-from-above"
            className="text-ink underline decoration-rule underline-offset-2 hover:text-seal"
          >
            /view-from-above
          </Link>
          .
        </p>
      </div>

      <div className="mt-4">
        <Link
          href={`/toolkit/view-from-above?class=${encodeURIComponent(matchingSlug)}`}
          className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Begin a Private Conversation for This Class →
        </Link>
      </div>

      {relatedClasses.length > 0 && (
        <div className="mt-4">
          <p className="label mb-2 text-muted">In the Class Library as</p>
          <ul className="list-disc pl-5 text-sm text-ink">
            {relatedClasses.map((c) => (
              <li key={c.id}>{c.title}</li>
            ))}
          </ul>
        </div>
      )}

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
        <section className="mt-10 space-y-4">
          {orientation.map((s) => (
            <div key={s.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              {s.title && <p className="font-serif text-lg text-ink">{s.title}</p>}
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{s.body}</p>
            </div>
          ))}

          {anchor && (
            <div className="rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-4">
              <p className="label mb-1 text-muted">Anchor — Dorian's Own Words</p>
              <p className="font-serif text-lg text-ink">{anchor.body}</p>
            </div>
          )}

          {hikeLesson.map((s) => (
            <div key={s.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              <p className="label mb-1 text-muted">{s.title}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink">{s.body}</p>
            </div>
          ))}

          {virtueFamily && (
            <div className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              <p className="font-serif text-lg text-ink">{virtueFamily.title}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{virtueFamily.body}</p>
            </div>
          )}

          {successDefinition && (
            <div className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              <p className="label mb-1 text-muted">What Becomes Possible</p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink">{successDefinition.body}</p>
            </div>
          )}

          {componentAvailability.length > 0 && (
            <div className="pt-4">
              <p className="label mb-3 text-muted">Components</p>
              <div className="flex flex-wrap gap-2">
                {componentAvailability.map((c) => (
                  <span key={c.key} className="rounded-md border border-rule px-3 py-1 text-sm text-ink">
                    {c.label} — {c.statusLabel}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === "teaching" && (
        <section className="mt-10 space-y-4">
          {movement && (
            <div className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              <p className="font-serif text-lg text-ink">{movement.title}</p>
              <div className="mt-3 space-y-3">
                {movementFields.length > 0 ? (
                  movementFields.map((f, i) => (
                    <div key={i}>
                      <p className="label text-muted">{f.label}</p>
                      <p className="mt-1 text-sm text-ink">{f.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink">{movement.body}</p>
                )}
              </div>
            </div>
          )}
          {guidePreparation.map((g) => (
            <div key={g.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              {g.title && <p className="font-serif text-lg text-ink">{g.title}</p>}
              <p className="mt-2 whitespace-pre-line text-sm text-ink">{g.body}</p>
            </div>
          ))}
          {boundary.map((b) => (
            <div key={b.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              {b.title && <p className="font-serif text-lg text-ink">{b.title}</p>}
              <p className="mt-2 whitespace-pre-line text-sm text-ink">{b.body}</p>
            </div>
          ))}
        </section>
      )}

      {activeTab === "activities" && (
        <section className="mt-10 space-y-4">
          {activities.map((a) => (
            <div key={a.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              {a.title && <p className="font-serif text-lg text-ink">{a.title}</p>}
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.body}</p>
            </div>
          ))}
          {storiesExamples && (
            <div className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              <p className="font-serif text-lg text-ink">{storiesExamples.title}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{storiesExamples.body}</p>
            </div>
          )}
        </section>
      )}

      {activeTab === "personal" && (
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

      {activeTab === "conversation" && (
        <section className="mt-10 space-y-4">
          {conversationWindows.map((c) => (
            <div key={c.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              {c.title && <p className="font-serif text-lg text-ink">{c.title}</p>}
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{c.body}</p>
            </div>
          ))}
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

      {activeTab === "formats" && (
        <section className="mt-10 space-y-3">
          {formatVariants.map((f) => (
            <div key={f.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              <p className="font-serif text-lg text-ink">{f.title}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
