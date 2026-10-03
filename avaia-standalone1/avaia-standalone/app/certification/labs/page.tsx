import Link from "next/link";
import { requireClassroomCandidate } from "@/lib/certification-access";
import { getCandidateProgress, getLessonsWithReflections } from "@/lib/certification";
import { buildClassroomSummary } from "@/lib/certification-classroom";
import CertificationProgressBar from "@/components/CertificationProgressBar";

export const dynamic = "force-dynamic";

const STATUS_TEXT = {
  not_started: "Not recorded",
  in_progress: "Opened",
  self_checked_complete: "Recorded as done",
} as const;

export default async function CertificationLabsPage() {
  const { supabase, candidate } = await requireClassroomCandidate("/certification/labs");
  const [progress, reflectionKeys] = await Promise.all([
    getCandidateProgress(supabase, candidate.id),
    getLessonsWithReflections(supabase, candidate.id),
  ]);
  const summary = buildClassroomSummary(progress, reflectionKeys);

  return (
    <div>
      <p className="mb-6">
        <Link href="/certification" className="label hover:text-seal">
          ← Your Certification
        </Link>
      </p>
      <p className="label mb-3 text-muted">Practice</p>
      <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">Practice Labs</h1>
      <p className="mt-4 max-w-prose text-lg leading-relaxed text-muted">
        Fifteen hands-on practice conversations, each built to rehearse something the lessons teach. You run them with a partner.
        Recording a Lab here is your own note that you did it. How Labs are reviewed, and which are required, is decided by AVAIA and
        is not tracked or decided on this page.
      </p>

      <div className="mt-8">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="text-muted">Labs you have recorded</span>
          <span className="text-ink">
            {summary.labsCompleted} of {summary.labsTotal}
          </span>
        </div>
        <CertificationProgressBar done={summary.labsCompleted} total={summary.labsTotal} label="Practice Lab progress" />
      </div>

      <ol className="mt-10 divide-y divide-rule rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm">
        {summary.labs.map((lab, i) => (
          <li key={lab.itemKey}>
            <Link href={`/certification/labs/${encodeURIComponent(lab.itemKey)}`} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03]">
              <span className="w-6 shrink-0 text-right font-serif text-sm text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 text-ink">{lab.title}</span>
              <span
                className={
                  lab.status === "self_checked_complete"
                    ? "shrink-0 rounded-full border border-seal/50 px-2.5 py-1 text-xs text-seal"
                    : "shrink-0 rounded-full border border-rule px-2.5 py-1 text-xs text-muted"
                }
              >
                {STATUS_TEXT[lab.status]}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
