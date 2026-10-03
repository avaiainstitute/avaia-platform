import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireClassroomCandidate } from "@/lib/certification-access";
import { getCandidateProgress } from "@/lib/certification";
import { getPracticeLabByKey, getPracticeLabs } from "@/lib/certification-content";
import CertificationOpenBeacon from "@/components/CertificationOpenBeacon";
import { setLabStatusAction } from "../../actions";

export const dynamic = "force-dynamic";

/** Renders a card (a list of {t, text|items} blocks, or a plain string)
 *  exactly as the curriculum stores it. Nothing is rewritten. */
function renderBlocks(value: unknown): ReactNode {
  if (typeof value === "string") return value.trim() ? <p className="leading-relaxed text-ink">{value}</p> : null;
  if (!Array.isArray(value)) return null;
  return (
    <div className="space-y-3">
      {value.map((block, i) => {
        if (typeof block === "string") return <p key={i} className="leading-relaxed text-ink">{block}</p>;
        if (!block || typeof block !== "object") return null;
        const b = block as { t?: string; text?: string; items?: unknown };
        if (b.t === "list" && Array.isArray(b.items)) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-6 text-ink">
              {b.items.filter((x): x is string => typeof x === "string").map((x) => (
                <li key={x} className="leading-relaxed">
                  {x}
                </li>
              ))}
            </ul>
          );
        }
        if (typeof b.text !== "string") return null;
        if (b.t === "q") {
          return (
            <blockquote key={i} className="border-l-2 border-seal/60 pl-4 font-serif text-lg italic leading-relaxed text-ink">
              {b.text}
            </blockquote>
          );
        }
        if (b.t === "note") {
          return (
            <p key={i} className="text-sm italic leading-relaxed text-muted">
              {b.text}
            </p>
          );
        }
        return (
          <p key={i} className="leading-relaxed text-ink">
            {b.text}
          </p>
        );
      })}
    </div>
  );
}

export default async function CertificationLabPage({
  params,
  searchParams,
}: {
  params: { itemKey: string };
  searchParams?: { updated?: string };
}) {
  const lab = getPracticeLabByKey(params.itemKey);
  if (!lab) notFound();
  const { supabase, candidate } = await requireClassroomCandidate(`/certification/labs/${params.itemKey}`);

  const progress = await getCandidateProgress(supabase, candidate.id);
  const status = progress.find((p) => p.item_key === lab.item_key)?.status ?? "not_started";
  const done = status === "self_checked_complete";

  const labs = getPracticeLabs();
  const idx = labs.findIndex((l) => l.item_key === lab.item_key);
  const prev = labs[idx - 1] ?? null;
  const next = labs[idx + 1] ?? null;

  const hostCard = renderBlocks(lab.host);
  const guideCard = renderBlocks(lab.guide);

  return (
    <article>
      <CertificationOpenBeacon itemKey={lab.item_key} />
      <p className="mb-6">
        <Link href="/certification/labs" className="label hover:text-seal">
          ← Practice Labs
        </Link>
      </p>
      <p className="label mb-3 text-muted">
        Practice Lab {idx + 1} of {labs.length}
        {done ? " · Recorded as done" : ""}
      </p>
      <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">{lab.title}</h1>

      {lab.competency && (
        <section className="mt-6">
          <p className="label mb-2 text-muted">What this Lab practices</p>
          <p className="max-w-prose text-lg leading-relaxed text-ink">{lab.competency}</p>
        </section>
      )}

      {lab.establishedGround && lab.establishedGround.length > 0 && (
        <section className="mt-10">
          <p className="label mb-3 text-muted">Established ground</p>
          <ul className="max-w-prose list-disc space-y-1 pl-6 text-ink">
            {lab.establishedGround.map((g) => (
              <li key={g} className="leading-relaxed">
                {g}
              </li>
            ))}
          </ul>
        </section>
      )}

      {lab.note && <p className="mt-6 max-w-prose text-sm italic leading-relaxed text-muted">{lab.note}</p>}

      {hostCard && (
        <section className="mt-12 rule-t border-t border-rule pt-10">
          <p className="label mb-1 text-muted">Host card</p>
          <p className="mb-4 text-xs text-muted">Written for the person playing the Host.</p>
          <div className="max-w-prose">{hostCard}</div>
        </section>
      )}

      {guideCard && (
        <section className="mt-12">
          <p className="label mb-1 text-muted">Guide card</p>
          <p className="mb-4 text-xs text-muted">Written for the person guiding.</p>
          <div className="max-w-prose">{guideCard}</div>
        </section>
      )}

      {lab.debrief && lab.debrief.length > 0 && (
        <section className="mt-12 rule-t border-t border-rule pt-10">
          <p className="label mb-4 text-muted">Debrief</p>
          <div className="max-w-prose space-y-4">
            {lab.debrief.map((d, i) => (
              <div key={i} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
                <p className="label mb-1 text-muted">{d.role}</p>
                <p className="leading-relaxed text-ink">{d.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {lab.retry && (
        <section className="mt-12">
          <p className="label mb-2 text-muted">To try it again</p>
          <p className="max-w-prose leading-relaxed text-ink">{lab.retry}</p>
        </section>
      )}

      <section className="mt-14 rounded-lg border border-rule bg-white/[0.04] p-6">
        {done ? (
          <>
            <p className="font-serif text-xl text-ink">You have recorded this Lab as done.</p>
            {searchParams?.updated === "1" && <p className="mt-1 text-sm text-muted">Saved.</p>}
            <form action={setLabStatusAction} className="mt-4">
              <input type="hidden" name="itemKey" value={lab.item_key} />
              <input type="hidden" name="status" value="in_progress" />
              <button type="submit" className="text-sm text-muted underline decoration-rule underline-offset-2 hover:text-seal">
                Undo
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="font-serif text-xl text-ink">Ran this Lab with a partner?</p>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
              Recording it is your own note that you did it. It is not a review or sign-off, and it does not move you past any step.
            </p>
            <form action={setLabStatusAction} className="mt-4">
              <input type="hidden" name="itemKey" value={lab.item_key} />
              <input type="hidden" name="status" value="self_checked_complete" />
              <button
                type="submit"
                className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
              >
                Record this Lab as done
              </button>
            </form>
          </>
        )}
      </section>

      <nav className="mt-10 flex flex-wrap items-center justify-between gap-4 text-sm">
        {prev ? (
          <Link href={`/certification/labs/${encodeURIComponent(prev.item_key)}`} className="max-w-[45%] text-muted hover:text-seal">
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/certification/labs/${encodeURIComponent(next.item_key)}`} className="max-w-[45%] text-right text-muted hover:text-seal">
            {next.title} →
          </Link>
        ) : (
          <Link href="/certification" className="text-muted hover:text-seal">
            Back to your certification →
          </Link>
        )}
      </nav>
    </article>
  );
}
