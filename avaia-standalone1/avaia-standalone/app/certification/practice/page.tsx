import Link from "next/link";
import { requireClassroomCandidate } from "@/lib/certification-access";
import { practiceOptions } from "@/lib/certification-practice";
import { boundaryGatePassed } from "@/lib/ops/certification-evaluations";
import CertificationPracticeChat from "@/components/CertificationPracticeChat";

export const metadata = { title: "Practice with an AI Host, AVAIA Certification" };
export const dynamic = "force-dynamic";

export default async function CertificationPracticePage({ searchParams }: { searchParams: { lab?: string; scenario?: string } }) {
  const { candidate } = await requireClassroomCandidate("/certification/practice");
  const gatePassed = await boundaryGatePassed(candidate.id);
  const options = practiceOptions(gatePassed);
  const chosen = searchParams?.lab
    ? options.find((o) => o.labKey === searchParams.lab && o.scenario === (searchParams.scenario ?? null) && o.available)
    : null;

  return (
    <div>
      <p className="mb-6">
        <Link href="/certification" className="label hover:text-seal">
          ← Your Certification
        </Link>
      </p>
      <p className="label mb-3 text-muted">Practice with an AI Host</p>
      <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">{chosen ? chosen.title : "Rehearse a Practice Lab"}</h1>
      <p className="mt-4 max-w-prose text-lg leading-relaxed text-muted">
        An AI plays the Host from the Lab&rsquo;s Host card, so you can rehearse the Guide seat on your own. It is rehearsal only: the AI never evaluates,
        scores or hints, nothing here is part of your record, and it is not a substitute for the Practice Labs with people. Feedback and the evaluation of
        each Lab come from a person at AVAIA, and certification is a separate decision people make.
      </p>

      {chosen ? (
        <>
          <p className="mt-4 text-sm">
            <Link href="/certification/practice" className="text-seal hover:underline">
              Choose a different practice
            </Link>
          </p>
          <CertificationPracticeChat labKey={chosen.labKey} scenario={chosen.scenario} />
        </>
      ) : (
        <ul className="mt-8 space-y-3">
          {options.map((o) => (
            <li key={`${o.labKey}:${o.scenario ?? ""}`} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-ink">{o.title}</p>
                {o.available ? (
                  <Link
                    href={`/certification/practice?lab=${encodeURIComponent(o.labKey)}${o.scenario ? `&scenario=${o.scenario}` : ""}`}
                    className="label text-seal hover:opacity-80"
                  >
                    Practice →
                  </Link>
                ) : (
                  <span className="text-sm text-muted">{o.reason}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
