import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Experience } from "@/lib/experiences";
import { groupSectionsByType, parseModuleFields, type ExperienceSection } from "@/lib/experience-sections";
import { VIEW_FROM_ABOVE_CLASSES } from "@/lib/view-from-above";
import { PrintButton } from "@/components/DefyingGriefPrintControls";

export const dynamic = "force-dynamic";

/** The combined ten-class Facilitator Workbook, packaging only, no new
 *  curriculum. Reads the same `experiences` + `experience_sections` rows
 *  the per-class print route and Toolkit delivery view already read
 *  (migrations 0055-0057), one query for all ten instead of one at a
 *  time, ordered to match the collection's own hike sequence
 *  (lib/view-from-above.ts), not alphabetically. If a class's `experiences`
 *  row isn't found, most plausibly because 0055-0057 haven't been
 *  applied to this database yet, that class prints a plain notice
 *  instead of silently vanishing, so a missing class is visible, not
 *  invisible. */
export default async function ViewFromAboveFacilitatorWorkbookPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const titles = VIEW_FROM_ABOVE_CLASSES.map((c) => c.title);
  const { data: experienceRows } = await supabase.from("experiences").select("*").in("title", titles);
  const experiences = (experienceRows as Experience[]) ?? [];
  const experienceIds = experiences.map((e) => e.id);

  const { data: sectionRows } = await supabase
    .from("experience_sections")
    .select("*")
    .in("experience_id", experienceIds.length > 0 ? experienceIds : ["00000000-0000-0000-0000-000000000000"]);
  const allSections = (sectionRows as ExperienceSection[]) ?? [];

  const byTitle = new Map(experiences.map((e) => [e.title, e]));
  const sectionsByExperienceId = new Map<string, ExperienceSection[]>();
  for (const s of allSections) {
    if (!sectionsByExperienceId.has(s.experience_id)) sectionsByExperienceId.set(s.experience_id, []);
    sectionsByExperienceId.get(s.experience_id)!.push(s);
  }

  return (
    <div className="print-page">
      <style>{`
        @media print {
          #toolkit-chrome, .no-print { display: none !important; }
          body { background: #fff !important; }
          @page { size: letter; margin: 0.65in; }
        }
        .print-page { max-width: 7.5in; margin: 0 auto; color: #1a1a1a; font-family: Georgia, 'Times New Roman', serif; }
        .print-page h1 { font-size: 1.8rem; margin: 0 0 0.15em; }
        .print-page h2 { font-size: 1.3rem; margin: 0 0 0.3em; page-break-before: always; }
        .print-page h3 { font-size: 1.05rem; margin: 1.1em 0 0.3em; page-break-after: avoid; }
        .print-page .class-block:first-of-type h2 { page-break-before: avoid; }
        .print-page .field { margin: 0.5em 0; }
        .print-page .field-label { font-weight: bold; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; color: #444; }
        .print-page .field-text { margin: 0.15em 0 0; }
        .print-page .meta { font-size: 0.85rem; color: #555; }
        .print-page .toc { margin: 1.5em 0; padding: 0; list-style: decimal; padding-left: 1.4em; }
        .print-page .toc li { margin: 0.2em 0; }
        .print-page .missing { border: 1px dashed #999; padding: 0.8em 1em; color: #666; font-style: italic; }
        @media screen {
          .print-page { padding: 2rem 1.5rem; }
        }
      `}</style>

      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <Link href="/toolkit/view-from-above" className="label text-muted hover:text-seal">
          ← Back to The View From Above
        </Link>
        <div className="ml-auto">
          <PrintButton label="Print Facilitator Workbook" />
        </div>
      </div>

      <h1>The View From Above</h1>
      <p className="meta">Facilitator Workbook · All Ten Classes</p>

      <ol className="toc">
        {VIEW_FROM_ABOVE_CLASSES.map((c) => (
          <li key={c.slug}>
            {c.title}, {c.virtueFamily}
            {!byTitle.has(c.title) && " (not found in this database)"}
          </li>
        ))}
      </ol>

      {VIEW_FROM_ABOVE_CLASSES.map((cls) => {
        const experience = byTitle.get(cls.title);
        if (!experience) {
          return (
            <div key={cls.slug} className="class-block">
              <h2>{cls.title}</h2>
              <p className="missing">
                No published experience row found for "{cls.title}" in this database. This class's
                content exists in migrations 0055-0057, if those haven't been applied here yet,
                that's why it's missing.
              </p>
            </div>
          );
        }
        const sections = sectionsByExperienceId.get(experience.id) ?? [];
        const grouped = groupSectionsByType(sections);
        const movement = (grouped.movement ?? [])[0] ?? null;
        const anchor = (grouped.anchor ?? [])[0] ?? null;
        const references = grouped.reference ?? [];
        const hikeLesson = (grouped.hike_lesson ?? [])[0] ?? null;
        const conversationWindows = grouped.conversation_window ?? [];
        const activities = grouped.activity ?? [];
        const guidePreparation = grouped.guide_preparation ?? [];
        const boundaries = grouped.boundary ?? [];

        return (
          <div key={cls.slug} className="class-block">
            <h2>{cls.title}</h2>
            <p className="meta">
              Virtue Family: {cls.virtueFamily} · Human Question: {cls.humanQuestion}
            </p>

            {anchor && (
              <div className="field">
                <p className="field-label">Anchor</p>
                <p className="field-text">{anchor.body}</p>
              </div>
            )}

            {hikeLesson && (
              <div className="field">
                <p className="field-label">{hikeLesson.title ?? "The Hike Lesson"}</p>
                <p className="field-text">{hikeLesson.body}</p>
              </div>
            )}

            {references.map((r) => (
              <div key={r.id} className="field">
                <p className="field-label">{r.title}</p>
                <p className="field-text">{r.body}</p>
              </div>
            ))}

            {movement && (
              <>
                <h3>What This Class Does</h3>
                {(() => {
                  const fields = parseModuleFields(movement.body);
                  return fields.length > 0 ? (
                    fields.map((f, i) => (
                      <div key={i} className="field">
                        <p className="field-label">{f.label}</p>
                        <p className="field-text">{f.text}</p>
                      </div>
                    ))
                  ) : (
                    <p className="field-text">{movement.body}</p>
                  );
                })()}
              </>
            )}

            {guidePreparation.length > 0 && (
              <>
                <h3>Shared Teaching</h3>
                {guidePreparation.map((g) => (
                  <div key={g.id} className="field">
                    <p className="field-text">{g.body}</p>
                  </div>
                ))}
              </>
            )}

            {activities.length > 0 && (
              <>
                <h3>Activities</h3>
                {activities.map((a) => (
                  <div key={a.id} className="field">
                    {a.title && <p className="field-label">{a.title}</p>}
                    <p className="field-text">{a.body}</p>
                  </div>
                ))}
              </>
            )}

            {conversationWindows.length > 0 && (
              <>
                <h3>Conversation Windows</h3>
                {conversationWindows.map((w) => (
                  <div key={w.id} className="field">
                    <p className="field-label">{w.title}</p>
                    <p className="field-text">{w.body}</p>
                  </div>
                ))}
              </>
            )}

            {boundaries.length > 0 && (
              <>
                <h3>Shared Room Version &amp; Guide Boundaries</h3>
                {boundaries.map((b) => (
                  <div key={b.id} className="field">
                    <p className="field-text">{b.body}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
