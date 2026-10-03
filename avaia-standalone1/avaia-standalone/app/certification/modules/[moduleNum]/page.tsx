import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClassroomCandidate } from "@/lib/certification-access";
import { getCandidateProgress, getLessonsWithReflections } from "@/lib/certification";
import { buildClassroomSummary } from "@/lib/certification-classroom";
import { getModule } from "@/lib/certification-content";
import CertificationProgressBar from "@/components/CertificationProgressBar";

export const dynamic = "force-dynamic";

const STATUS_TEXT = {
  not_started: "Not started",
  in_progress: "In progress",
  self_checked_complete: "Complete",
} as const;

export default async function CertificationModulePage({ params }: { params: { moduleNum: string } }) {
  const num = Number(params.moduleNum);
  const mod = Number.isInteger(num) ? getModule(num) : null;
  if (!mod) notFound();

  const { supabase, candidate } = await requireClassroomCandidate(`/certification/modules/${params.moduleNum}`);
  const [progress, reflectionKeys] = await Promise.all([
    getCandidateProgress(supabase, candidate.id),
    getLessonsWithReflections(supabase, candidate.id),
  ]);
  const summary = buildClassroomSummary(progress, reflectionKeys);
  const view = summary.modules.find((m) => m.num === mod.num);
  if (!view) notFound();

  const nextUp = view.lessons.find((l) => !l.held && l.status !== "self_checked_complete");
  const prevModule = mod.num > 1 ? summary.modules.find((m) => m.num === mod.num - 1) : null;
  const nextModule = summary.modules.find((m) => m.num === mod.num + 1);

  return (
    <div>
      <p className="mb-6">
        <Link href="/certification" className="label hover:text-seal">
          ← Your Certification
        </Link>
      </p>
      <p className="label mb-3 text-muted">Module {mod.num} of 7</p>
      <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">{mod.title}</h1>

      <div className="mt-6">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="text-muted">Module progress</span>
          <span className="text-ink">
            {view.completedCount} of {view.availableCount} available lessons
          </span>
        </div>
        <CertificationProgressBar done={view.completedCount} total={view.availableCount} label={`Module ${mod.num} progress`} />
        {nextUp ? (
          <Link
            href={`/certification/lessons/${encodeURIComponent(nextUp.itemKey)}`}
            className="mt-5 inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            {view.completedCount === 0 && nextUp.status === "not_started" ? "Start this module" : "Continue this module"}
          </Link>
        ) : (
          <p className="mt-4 text-sm text-ink">
            {view.fullyComplete ? "You have completed this module." : "You have completed every lesson available in this module."}
          </p>
        )}
      </div>

      <ol className="mt-10 divide-y divide-rule rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm">
        {view.lessons.map((l, i) => {
          const body = (
            <div className="flex items-start gap-4 px-5 py-4">
              <span className="mt-0.5 w-6 shrink-0 text-right font-serif text-sm text-muted">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className={l.held ? "text-muted" : "text-ink"}>{l.title}</p>
                {l.held && (
                  <p className="mt-1 text-xs text-muted">
                    Pending content. AVAIA has not published this lesson yet, so there is nothing to read or complete.
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right text-xs">
                {l.held ? (
                  <span className="rounded-full border border-rule px-2.5 py-1 text-muted">Pending</span>
                ) : (
                  <>
                    <span
                      className={
                        l.status === "self_checked_complete"
                          ? "rounded-full border border-seal/50 px-2.5 py-1 text-seal"
                          : l.status === "in_progress"
                            ? "rounded-full border border-rule px-2.5 py-1 text-ink"
                            : "rounded-full border border-rule px-2.5 py-1 text-muted"
                      }
                    >
                      {STATUS_TEXT[l.status]}
                    </span>
                    {l.hasReflection && l.status !== "self_checked_complete" && (
                      <p className="mt-1 text-muted">Reflection saved</p>
                    )}
                  </>
                )}
              </div>
            </div>
          );
          return (
            <li key={l.itemKey}>
              {/* A held lesson can be looked at (its page says plainly that it
                  is pending) but never worked. */}
              <Link href={`/certification/lessons/${encodeURIComponent(l.itemKey)}`} className="block hover:bg-white/[0.03]">
                {body}
              </Link>
            </li>
          );
        })}
      </ol>

      <nav className="mt-10 flex flex-wrap items-center justify-between gap-4 text-sm">
        {prevModule ? (
          <Link href={`/certification/modules/${prevModule.num}`} className="text-muted hover:text-seal">
            ← Module {prevModule.num}
          </Link>
        ) : (
          <span />
        )}
        {nextModule ? (
          <Link href={`/certification/modules/${nextModule.num}`} className="text-muted hover:text-seal">
            Module {nextModule.num} →
          </Link>
        ) : (
          <Link href="/certification/labs" className="text-muted hover:text-seal">
            Practice Labs →
          </Link>
        )}
      </nav>
    </div>
  );
}
