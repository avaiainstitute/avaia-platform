import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Experience } from "@/lib/experiences";
import { groupSectionsByType, parsePromptFields, type ExperienceSection } from "@/lib/experience-sections";
import { VIEW_FROM_ABOVE_CLASSES } from "@/lib/view-from-above";
import { PrintButton } from "@/components/DefyingGriefPrintControls";

export const dynamic = "force-dynamic";

/** The combined ten-class Participant Workbook -- packaging only, same
 *  source rows as the per-class print route (participant_guide +
 *  take_home), same private, second-person writing-space treatment. See
 *  the sibling Facilitator Workbook route for the query/ordering
 *  rationale. */
export default async function ViewFromAboveParticipantWorkbookPage() {
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

  function renderPrompts(body: string) {
    const fields = parsePromptFields(body);
    if (fields.length === 0) {
      return <p className="field-text">{body}</p>;
    }
    return fields.map((f, i) => (
      <div key={i} className="prompt">
        <p className="prompt-label">{f.label}</p>
        <p className="prompt-text">{f.text}</p>
        <div className="write-space" />
      </div>
    ));
  }

  return (
    <div className="print-page">
      <style>{`
        @media print {
          #toolkit-chrome, .no-print { display: none !important; }
          body { background: #fff !important; }
          @page { size: letter; margin: 0.75in; }
        }
        .print-page { max-width: 7in; margin: 0 auto; color: #1a1a1a; font-family: Georgia, 'Times New Roman', serif; line-height: 1.5; }
        .print-page h1 { font-size: 1.7rem; margin: 0 0 0.15em; }
        .print-page h2 { font-size: 1.2rem; margin: 0 0 0.4em; page-break-before: always; }
        .print-page .class-block:first-of-type h2 { page-break-before: avoid; }
        .print-page .intro { font-style: italic; color: #444; margin-bottom: 1.5em; }
        .print-page .prompt { margin-bottom: 1.1em; page-break-inside: avoid; }
        .print-page .prompt-label { font-weight: bold; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #333; margin: 0; }
        .print-page .prompt-text { margin: 0.2em 0 0.4em; }
        .print-page .write-space { border-bottom: 1px solid #bbb; height: 1.9em; }
        .print-page .meta { font-size: 0.85rem; color: #555; }
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
          <PrintButton label="Print Participant Workbook" />
        </div>
      </div>

      <h1>The View From Above</h1>
      <p className="meta">Participant Workbook · All Ten Classes</p>
      <p className="intro">
        This workbook is yours. Nothing on it has to be shown to anyone. Write only what is true
        for you, and leave blank whatever doesn&rsquo;t fit.
      </p>

      {VIEW_FROM_ABOVE_CLASSES.map((cls) => {
        const experience = byTitle.get(cls.title);
        if (!experience) {
          return (
            <div key={cls.slug} className="class-block">
              <h2>{cls.title}</h2>
              <p className="missing">
                No published experience row found for "{cls.title}" in this database.
              </p>
            </div>
          );
        }
        const sections = sectionsByExperienceId.get(experience.id) ?? [];
        const grouped = groupSectionsByType(sections);
        const participantGuide = grouped.participant_guide ?? [];
        const takeHome = grouped.take_home ?? [];

        return (
          <div key={cls.slug} className="class-block">
            <h2>{cls.title}</h2>
            {participantGuide.map((p) => (
              <div key={p.id}>
                <p className="meta">{p.title ?? "Personal Recognition"}</p>
                {renderPrompts(p.body)}
              </div>
            ))}
            {takeHome.map((t) => (
              <div key={t.id}>
                <p className="meta">{t.title ?? "Take-Home"}</p>
                {renderPrompts(t.body)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
