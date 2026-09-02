import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Experience } from "@/lib/experiences";
import {
  groupSectionsByType,
  parseModuleFields,
  parseModuleMovement,
  parseReferencedModuleNumbers,
  type ExperienceSection,
} from "@/lib/experience-sections";
import { PrintFormatSelect, PrintButton } from "@/components/DefyingGriefPrintControls";

export const dynamic = "force-dynamic";

const MOVEMENT_ORDER = ["Awareness", "Understanding", "Agency"] as const;

/** Printable Facilitator Packet for the Defying Grief Master Curriculum --
 *  a print-only rendering of exactly the same experience_sections rows
 *  the live Guide Toolkit delivery interface (components/
 *  DefyingGriefCurriculum.tsx) already reads, so there is no second
 *  curriculum to keep in sync. Sits inside /toolkit, so
 *  app/toolkit/layout.tsx's own Toolkit authorization gate already
 *  applies before this runs -- same as the sibling
 *  app/toolkit/experiences/[experienceId]/page.tsx, no separate check is
 *  added here. Every module prints in full regardless of the selected
 *  format; the format's own official run-of-show text is shown verbatim
 *  at the top, and modules it names are softly highlighted -- nothing is
 *  ever excluded based on a best-effort text match, so this can never
 *  hand a Guide an incomplete or incorrectly-cut packet. */
export default async function DefyingGriefFacilitatorPrintPage({
  params,
  searchParams,
}: {
  params: { experienceId: string };
  searchParams: { format?: string };
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
  const modules = (grouped.movement ?? []).slice().sort((a, b) => a.position - b.position);
  const activities = grouped.activity ?? [];
  const guidePreparation = grouped.guide_preparation ?? [];
  const boundaries = grouped.boundary ?? [];
  const takeHome = grouped.take_home ?? [];
  const formatVariants = grouped.format_variant ?? [];
  const overview = [
    ...(grouped.orientation ?? []),
    ...(grouped.governing_distinction ?? []),
    ...(grouped.anchor ?? []),
    ...(grouped.success_definition ?? []),
  ];

  const nonYouthFormats = formatVariants.filter(
    (f) => !/youth/i.test(f.title ?? "") && !/youth/i.test(f.body)
  );
  const selectedFormat =
    nonYouthFormats.find((f) => f.id === searchParams.format) ?? nonYouthFormats[0] ?? null;
  const referencedModules = selectedFormat ? parseReferencedModuleNumbers(selectedFormat.body) : new Set<number>();

  const modulesByMovement = new Map<string, ExperienceSection[]>();
  for (const m of modules) {
    const movement = parseModuleMovement(m.body) ?? "Other";
    if (!modulesByMovement.has(movement)) modulesByMovement.set(movement, []);
    modulesByMovement.get(movement)!.push(m);
  }

  function activityUsage(activityTitle: string | null): string[] {
    if (!activityTitle) return [];
    const used: string[] = [];
    for (const m of modules) {
      if (m.body.toLowerCase().includes(activityTitle.toLowerCase())) {
        used.push(m.title ?? `Module ${m.position}`);
      }
    }
    return used;
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
        .print-page h1 { font-size: 1.7rem; margin: 0 0 0.15em; }
        .print-page h2 { font-size: 1.2rem; margin: 1.6em 0 0.5em; padding-top: 0.6em; border-top: 1px solid #999; page-break-after: avoid; }
        .print-page h3 { font-size: 1.05rem; margin: 1.1em 0 0.3em; page-break-after: avoid; }
        .print-page .module-block { margin-bottom: 1.2em; page-break-inside: avoid; }
        .print-page .field { margin: 0.5em 0; }
        .print-page .field-label { font-weight: bold; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; color: #444; }
        .print-page .field-text { margin: 0.15em 0 0; }
        .print-page .meta { font-size: 0.85rem; color: #555; }
        .print-page .badge { display: inline-block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid #888; border-radius: 3px; padding: 1px 6px; margin-left: 8px; }
        .print-page .movement-group { page-break-before: auto; }
        .print-page .format-box { border: 1px solid #999; padding: 0.8em 1em; margin: 1em 0; background: #f7f7f7; }
        @media screen {
          .print-page { padding: 2rem 1.5rem; }
        }
      `}</style>

      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <Link href={`/toolkit/experiences/${experience.id}`} className="label text-muted hover:text-seal">
          ← Back to {experience.title}
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <PrintFormatSelect
            formats={nonYouthFormats.map((f) => ({ id: f.id, title: f.title ?? "Untitled format" }))}
            selectedFormatId={selectedFormat?.id ?? null}
          />
          <PrintButton label="Print Facilitator Guide" />
        </div>
      </div>

      <h1>Defying Grief — A Sacred Rebellion</h1>
      <p className="meta">
        Facilitator Guide · {experience.title}
        {selectedFormat ? ` · ${selectedFormat.title}` : ""}
      </p>
      <p className="meta">Awareness → Understanding → Agency</p>

      {selectedFormat && (
        <div className="format-box">
          <strong>{selectedFormat.title} — Run of Show</strong>
          <p className="field-text">{selectedFormat.body}</p>
        </div>
      )}

      {overview.length > 0 && (
        <>
          <h2>Foundation</h2>
          {overview.map((s) => (
            <div key={s.id} className="field">
              {s.title && <p className="field-label">{s.title}</p>}
              <p className="field-text">{s.body}</p>
            </div>
          ))}
        </>
      )}

      {boundaries.length > 0 && (
        <>
          <h2>Protected Boundaries — Guide Reminders</h2>
          {boundaries.map((b) => (
            <div key={b.id} className="field">
              {b.title && <p className="field-label">{b.title}</p>}
              <p className="field-text">{b.body}</p>
            </div>
          ))}
        </>
      )}

      <h2>Master Curriculum — Full Module Sequence</h2>
      <p className="meta">
        Modules marked "In this format" are the ones {selectedFormat?.title ?? "the selected format"}{" "}
        names explicitly above. Every module is printed in full below regardless, for reference.
      </p>
      {MOVEMENT_ORDER.map((movement) => {
        const rows = modulesByMovement.get(movement) ?? [];
        if (rows.length === 0) return null;
        return (
          <div key={movement} className="movement-group">
            <h3 style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.85rem" }}>
              {movement}
            </h3>
            {rows.map((m) => {
              const fields = parseModuleFields(m.body);
              const inFormat = referencedModules.has(m.position);
              return (
                <div key={m.id} className="module-block">
                  <h3>
                    {m.title}
                    {inFormat && <span className="badge">In this format</span>}
                  </h3>
                  {fields.length > 0 ? (
                    fields.map((f, i) => (
                      <div key={i} className="field">
                        <p className="field-label">{f.label}</p>
                        <p className="field-text">{f.text}</p>
                      </div>
                    ))
                  ) : (
                    <p className="field-text">{m.body}</p>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {activities.length > 0 && (
        <>
          <h2>Activities</h2>
          {activities.map((a) => {
            const usedIn = activityUsage(a.title);
            return (
              <div key={a.id} className="field">
                {a.title && <p className="field-label">{a.title}</p>}
                <p className="field-text">{a.body}</p>
                {usedIn.length > 0 && <p className="meta">Used in: {usedIn.join(", ")}</p>}
              </div>
            );
          })}
        </>
      )}

      {guidePreparation.length > 0 && (
        <>
          <h2>Facilitator Preparation</h2>
          {guidePreparation.map((g) => (
            <div key={g.id} className="field">
              {g.title && <p className="field-label">{g.title}</p>}
              <p className="field-text">{g.body}</p>
            </div>
          ))}
        </>
      )}

      {takeHome.length > 0 && (
        <>
          <h2>What the Participant Takes Home</h2>
          <p className="meta">
            The participant's own copy of this material is in the separate Participant Packet.
          </p>
          {takeHome.map((t) => (
            <div key={t.id} className="field">
              {t.title && <p className="field-label">{t.title}</p>}
              <p className="field-text">{t.body}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
