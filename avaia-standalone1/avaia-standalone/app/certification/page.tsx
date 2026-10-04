import Link from "next/link";
import { getCandidateProgress, getLessonsWithReflections, getCandidateAccess } from "@/lib/certification";
import { buildClassroomSummary } from "@/lib/certification-classroom";
import { getCertificationOperationsRecordForCandidate, describeCandidateStages, type StageState } from "@/lib/certification-operations";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CertificationProgressBar from "@/components/CertificationProgressBar";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  admitted: "Admitted",
  in_training: "In training",
  development_required: "Development required",
};

const STAGE_TEXT: Record<StageState, string> = {
  not_yet: "Not yet reached",
  reached: "Reached. AVAIA will be in touch to arrange it.",
  recorded: "Recorded by AVAIA. They will share the outcome with you directly.",
};

export default async function CertificationHomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The layout already shows the "not available" notice to anyone who is not
  // an active candidate; this page must not run any candidate query for them.
  if (!user) return null;
  const access = await getCandidateAccess(supabase, user.id);
  if (access.kind !== "active") return null;
  const candidate = access.candidate;

  const [progress, reflectionKeys] = await Promise.all([
    getCandidateProgress(supabase, candidate.id),
    getLessonsWithReflections(supabase, candidate.id),
  ]);
  const summary = buildClassroomSummary(progress, reflectionKeys);

  // What the candidate may see about the stages after the education: only
  // whether each is reached or has a recorded outcome, never a rating or a
  // finding. Read from the existing mechanical record a human evaluator
  // enters; nothing here advances or passes anyone.
  let stages = describeCandidateStages(null);
  try {
    stages = describeCandidateStages(await getCertificationOperationsRecordForCandidate(createAdminClient(), candidate.id));
  } catch {
    // Leave the neutral "not yet reached" defaults rather than break the page.
  }

  const { overall, resume } = summary;
  const started = progress.length > 0;

  return (
    <div>
      <p className="label mb-3">Certified AVAIA Guide</p>
      <h1 className="font-serif text-4xl text-ink">Your Certification</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Seven modules, taken at your own pace. Your work is saved as you go, and you can leave and come back any time.
      </p>
      <p className="mt-2 text-sm text-muted">
        Candidacy status: <span className="text-ink">{STATUS_LABEL[candidate.status] ?? candidate.status}</span>
      </p>

      {/* Resume */}
      <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-6 backdrop-blur-sm">
        {resume.lesson ? (
          <>
            <p className="label mb-2 text-muted">{started ? "Pick up where you left off" : "Begin"}</p>
            <p className="font-serif text-2xl text-ink">{resume.lesson.title}</p>
            <Link
              href={`/certification/lessons/${encodeURIComponent(resume.lesson.itemKey)}`}
              className="mt-5 inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
            >
              {started ? "Continue" : "Start the first lesson"}
            </Link>
          </>
        ) : (
          <>
            <p className="label mb-2 text-muted">Lessons</p>
            <p className="font-serif text-2xl text-ink">
              {overall.educationFullyComplete ? "Every lesson is complete." : "You have completed every lesson available right now."}
            </p>
            {!overall.educationFullyComplete && (
              <p className="mt-2 text-sm text-muted">
                {overall.heldLessons} lesson{overall.heldLessons === 1 ? " is" : "s are"} still waiting on AVAIA to publish them. They are marked below.
              </p>
            )}
          </>
        )}
        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-muted">Overall progress</span>
            <span className="text-ink">
              {overall.completedLessons} of {overall.availableLessons} available lessons
            </span>
          </div>
          <CertificationProgressBar done={overall.completedLessons} total={overall.availableLessons} label="Overall lesson progress" />
        </div>
      </section>

      {/* Modules */}
      <section className="mt-12">
        <p className="label mb-4 text-muted">The seven modules</p>
        <div className="space-y-3">
          {summary.modules.map((m) => (
            <Link
              key={m.num}
              href={`/certification/modules/${m.num}`}
              className="block rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm transition-colors hover:border-seal/60"
            >
              <div className="flex items-baseline justify-between gap-4">
                <p className="label text-muted">Module {m.num}</p>
                <p className="text-sm text-muted">
                  {m.completedCount} of {m.availableCount} lessons
                  {m.fullyComplete ? " · Complete" : m.allAvailableComplete ? " · Available lessons complete" : ""}
                </p>
              </div>
              <p className="mt-1 font-serif text-xl text-ink">{m.title}</p>
              <div className="mt-4">
                <CertificationProgressBar done={m.completedCount} total={m.availableCount} label={`Module ${m.num} progress`} />
              </div>
              {m.heldCount > 0 && (
                <p className="mt-3 text-xs text-muted">
                  {m.heldCount} lesson{m.heldCount === 1 ? "" : "s"} in this module {m.heldCount === 1 ? "is" : "are"} pending content from AVAIA.
                </p>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* Practice Labs */}
      <section className="mt-12">
        <p className="label mb-4 text-muted">Practice Labs</p>
        <Link
          href="/certification/labs"
          className="block rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm transition-colors hover:border-seal/60"
        >
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-serif text-xl text-ink">Practice Labs</p>
            <p className="text-sm text-muted">
              {summary.labsCompleted} of {summary.labsTotal} recorded
            </p>
          </div>
          <p className="mt-2 text-sm text-muted">
            Hands-on practice conversations you run with a partner. Recording one here is your own note that you did it.
          </p>
          <div className="mt-4">
            <CertificationProgressBar done={summary.labsCompleted} total={summary.labsTotal} label="Practice Lab progress" />
          </div>
        </Link>
      </section>

      {/* After the education */}
      <section className="mt-12">
        <p className="label mb-2 text-muted">The rest of the path</p>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          You were admitted as a Certification Candidate. Admission is not certification: certification is a separate decision AVAIA
          makes later, from what you demonstrate. Finishing the lessons does not make anyone a Certified AVAIA Guide, and it does not move
          you through the steps below automatically. Each of these is arranged, observed, and decided by people at AVAIA.
        </p>
        <ol className="space-y-3">
          <li className="rounded-lg border border-rule bg-white/[0.04] p-5">
            <p className="font-serif text-lg text-ink">Your own experience in the Host seat</p>
            <p className="mt-1 text-sm text-muted">
              Going through the AVAIA Journey yourself, as a Host, before you guide anyone else. {STAGE_TEXT[stages.hostSeat]}
            </p>
          </li>
          <li className="rounded-lg border border-rule bg-white/[0.04] p-5">
            <p className="font-serif text-lg text-ink">Table-building exercise</p>
            <p className="mt-1 text-sm text-muted">{STAGE_TEXT[stages.tableBuilding]}</p>
          </li>
          <li className="rounded-lg border border-rule bg-white/[0.04] p-5">
            <p className="font-serif text-lg text-ink">Boundary Gate</p>
            <p className="mt-1 text-sm text-muted">{STAGE_TEXT[stages.boundaryGate]}</p>
          </li>
          <li className="rounded-lg border border-rule bg-white/[0.04] p-5">
            <p className="font-serif text-lg text-ink">Practice Labs, with feedback from people</p>
            <p className="mt-1 text-sm text-muted">
              {stages.practice === "recorded"
                ? "AVAIA has recorded your Practice Lab completion."
                : stages.practice === "reached"
                  ? "Open. Practice happens before any independent Guide work, with feedback from people at AVAIA. You can also rehearse with an AI Host."
                  : "Opens once you have met the Boundary Gate. Lab 12 Scenarios A and B can be rehearsed with an AI Host sooner."}
            </p>
            <Link href="/certification/practice" className="mt-2 inline-block label text-seal hover:opacity-80">
              Rehearse with an AI Host →
            </Link>
          </li>
          <li className="rounded-lg border border-rule bg-white/[0.04] p-5">
            <p className="font-serif text-lg text-ink">Observed Practicum</p>
            <p className="mt-1 text-sm text-muted">{STAGE_TEXT[stages.observedPracticum]}</p>
          </li>
          <li className="rounded-lg border border-rule bg-white/[0.04] p-5">
            <p className="font-serif text-lg text-ink">Certification decision</p>
            <p className="mt-1 text-sm text-muted">
              {stages.decision === "recorded"
                ? "A decision has been recorded. AVAIA will share it with you directly."
                : "Made by AVAIA once the full record has been reviewed by a person."}
            </p>
          </li>
        </ol>
      </section>

      {/* Companion */}
      <section className="mt-12 rounded-lg border border-rule bg-white/[0.04] p-5">
        <p className="font-serif text-lg text-ink">Certification Companion</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Ask a question about any lesson or Practice Lab, or find your place. It answers only from approved AVAIA
          certification material. It supports your learning; it does not replace the lessons, your reflections, the Practice
          Labs, or any human decision, and it can never make or hint at one.
        </p>
        <Link href="/certification/companion" className="mt-3 inline-block label text-seal hover:opacity-80">
          Open the Companion →
        </Link>
      </section>
    </div>
  );
}
