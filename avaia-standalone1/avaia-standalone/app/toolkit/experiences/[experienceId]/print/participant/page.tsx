import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Experience } from "@/lib/experiences";
import { groupSectionsByType, parsePromptFields, type ExperienceSection } from "@/lib/experience-sections";
import { PrintButton } from "@/components/DefyingGriefPrintControls";

export const dynamic = "force-dynamic";

/** Printable Participant Packet for the Defying Grief Master Curriculum --
 *  workshop material a Guide hands to a participant, distinct from the
 *  persistent AVAIA digital Workbook. Uses only material the Master
 *  Curriculum already authored (participant_guide + take_home
 *  experience_sections rows): the private "Your Own Ripple" worksheet and
 *  the Take-Home Record. Nothing here requires disclosure to the Guide or
 *  anyone else -- both source rows are written as private, second-person
 *  reflection, and this page only adds writing space, it never collects
 *  or transmits what a participant writes. Sits inside /toolkit, so
 *  app/toolkit/layout.tsx's own Toolkit authorization gate already
 *  applies -- only an authorized Guide can reach this to print copies for
 *  a session; there is no public route to this material. */
export default async function DefyingGriefParticipantPrintPage({
  params,
}: {
  params: { experienceId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const { data: experienceRow } = await supabase
    .from("experiences")
    .select("*")
    .eq("id", params.experienceId)
    .maybeSingle();
  if (!experienceRow) notFound();
  const experience = experienceRow as Experience;

  const { data: sectionRows } = await supabase
    .from("experience_sections")
    .select("*")
    .eq("experience_id", experience.id);
  const sections = (sectionRows as ExperienceSection[]) ?? [];

  const grouped = groupSectionsByType(sections);
  const participantGuide = grouped.participant_guide ?? [];
  const takeHome = grouped.take_home ?? [];

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
        .print-page h1 { font-size: 1.6rem; margin: 0 0 0.15em; }
        .print-page h2 { font-size: 1.15rem; margin: 1.8em 0 0.6em; padding-top: 0.6em; border-top: 1px solid #999; page-break-after: avoid; }
        .print-page .intro { font-style: italic; color: #444; margin-bottom: 1.5em; }
        .print-page .prompt { margin-bottom: 1.1em; page-break-inside: avoid; }
        .print-page .prompt-label { font-weight: bold; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #333; margin: 0; }
        .print-page .prompt-text { margin: 0.2em 0 0.4em; }
        .print-page .write-space { border-bottom: 1px solid #bbb; height: 1.9em; }
        .print-page .meta { font-size: 0.85rem; color: #555; }
        @media screen {
          .print-page { padding: 2rem 1.5rem; }
        }
      `}</style>

      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <Link href={`/toolkit/experiences/${experience.id}`} className="label text-muted hover:text-seal">
          ← Back to {experience.title}
        </Link>
        <div className="ml-auto">
          <PrintButton label="Print Participant Materials" />
        </div>
      </div>

      <h1>Defying Grief</h1>
      <p className="meta">Participant Materials · {experience.title}</p>
      <p className="intro">
        This packet is yours. Nothing on it has to be shown to anyone — not your Guide, not the
        group, not AVAIA. Write only what is true for you, and leave blank whatever doesn&rsquo;t
        fit.
      </p>

      {participantGuide.map((p) => (
        <div key={p.id}>
          <h2>{p.title ?? "Your Own Ripple"}</h2>
          {renderPrompts(p.body)}
        </div>
      ))}

      {takeHome.map((t) => (
        <div key={t.id}>
          <h2>{t.title ?? "Take-Home Record"}</h2>
          {renderPrompts(t.body)}
        </div>
      ))}
    </div>
  );
}
