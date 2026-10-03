import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClassroomCandidate } from "@/lib/certification-access";
import { getCandidateProgress, getReflections, MAX_REFLECTION_LENGTH, REFLECTION_REQUIRED_FOR_COMPLETION } from "@/lib/certification";
import {
  getAdjacentLessons,
  getLessonByKey,
  getModule,
  getModuleLessons,
  getWorkbookPrompts,
  isHeldItem,
  toStringList,
} from "@/lib/certification-content";
import CertificationOpenBeacon from "@/components/CertificationOpenBeacon";
import { completeLessonAction, reopenLessonAction, saveReflectionAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function CertificationLessonPage({
  params,
  searchParams,
}: {
  params: { itemKey: string };
  searchParams?: { saved?: string; completed?: string; reopened?: string; error?: string };
}) {
  const lesson = getLessonByKey(params.itemKey);
  if (!lesson) notFound();
  const { supabase, candidate } = await requireClassroomCandidate(`/certification/lessons/${params.itemKey}`);

  const mod = getModule(lesson.module_num);
  const moduleLessons = getModuleLessons(lesson.module_num);
  const position = moduleLessons.findIndex((l) => l.item_key === lesson.item_key) + 1;

  // A HELD lesson: the curriculum marks it as unresolved AVAIA policy with no
  // approved content. It is shown honestly, with nothing to read, nothing to
  // write, and no way to mark it complete. No text is invented to fill it.
  if (isHeldItem(lesson)) {
    return (
      <div>
        <p className="mb-6">
          <Link href={`/certification/modules/${lesson.module_num}`} className="label hover:text-seal">
            ← {mod?.title ?? `Module ${lesson.module_num}`}
          </Link>
        </p>
        <p className="label mb-3 text-muted">
          Module {lesson.module_num} · Lesson {position} of {moduleLessons.length}
        </p>
        <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">{lesson.title}</h1>
        <div className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-6">
          <p className="label mb-2 text-muted">Pending content</p>
          <p className="leading-relaxed text-ink">
            AVAIA has not published this lesson yet. There is nothing to read or complete here for now, and it cannot be marked
            complete. It will appear here once AVAIA releases it.
          </p>
        </div>
        <p className="mt-8">
          <Link href={`/certification/modules/${lesson.module_num}`} className="text-sm text-muted hover:text-seal">
            ← Back to the module
          </Link>
        </p>
      </div>
    );
  }

  const [progress, saved] = await Promise.all([
    getCandidateProgress(supabase, candidate.id),
    getReflections(supabase, candidate.id, lesson.item_key),
  ]);
  const status = progress.find((p) => p.item_key === lesson.item_key)?.status ?? "not_started";
  const complete = status === "self_checked_complete";
  const prompts = getWorkbookPrompts(lesson);
  const examples = toStringList(lesson.examples);
  const activities = toStringList(lesson.activity);
  const { prev, next } = getAdjacentLessons(lesson.item_key);
  const allPromptsAnswered = prompts.every((_, i) => (saved.get(i) ?? "").trim().length > 0);

  return (
    <article>
      <CertificationOpenBeacon itemKey={lesson.item_key} />

      <p className="mb-6">
        <Link href={`/certification/modules/${lesson.module_num}`} className="label hover:text-seal">
          ← {mod?.title ?? `Module ${lesson.module_num}`}
        </Link>
      </p>
      <p className="label mb-3 text-muted">
        Module {lesson.module_num} · Lesson {position} of {moduleLessons.length}
        {complete ? " · Complete" : ""}
      </p>
      <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">{lesson.title}</h1>

      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]" role="alert">
          {searchParams.error.slice(0, 300)}
        </p>
      )}

      {lesson.purpose && <p className="mt-6 max-w-prose text-lg italic leading-relaxed text-muted">{lesson.purpose}</p>}

      {lesson.outcomes.length > 0 && (
        <section className="mt-10">
          <p className="label mb-3 text-muted">What this lesson is for</p>
          <ul className="max-w-prose space-y-2">
            {lesson.outcomes.map((o) => (
              <li key={o} className="flex gap-3 text-ink">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-seal" />
                <span className="leading-relaxed">{o}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lesson.teaching.length > 0 && (
        <section className="mt-12 rule-t border-t border-rule pt-10">
          <p className="label mb-5 text-muted">The lesson</p>
          <div className="max-w-prose space-y-5">
            {lesson.teaching.map((p, i) => (
              <p key={i} className="text-lg leading-relaxed text-ink">
                {p}
              </p>
            ))}
          </div>
        </section>
      )}

      {lesson.language.length > 0 && (
        <section className="mt-12">
          <p className="label mb-3 text-muted">Key language</p>
          <ul className="flex flex-wrap gap-2">
            {lesson.language.map((l) => (
              <li key={l} className="rounded-full border border-rule bg-white/[0.04] px-3.5 py-1.5 text-sm text-ink">
                {l}
              </li>
            ))}
          </ul>
        </section>
      )}

      {examples.length > 0 && (
        <section className="mt-12">
          <p className="label mb-3 text-muted">Examples</p>
          <div className="max-w-prose space-y-3">
            {examples.map((e, i) => (
              <p key={i} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 leading-relaxed text-ink">
                {e}
              </p>
            ))}
          </div>
        </section>
      )}

      {activities.length > 0 && (
        <section className="mt-12">
          <p className="label mb-3 text-muted">Group activity</p>
          <div className="max-w-prose space-y-3">
            {activities.map((a, i) => (
              <p key={i} className="leading-relaxed text-ink">
                {a}
              </p>
            ))}
          </div>
        </section>
      )}

      {prompts.length > 0 && (
        <section className="mt-12 rule-t border-t border-rule pt-10">
          <p className="label mb-2 text-muted">Your workbook</p>
          <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
            This is yours. Write in your own words. What you write here is private to you: it is not read, scored, or evaluated by
            anyone or anything. Write about your own choices and habits, not about anyone else&rsquo;s private story.
          </p>
          <div className="space-y-8">
            {prompts.map((prompt, i) => {
              const value = saved.get(i) ?? "";
              return (
                <form key={i} action={saveReflectionAction} id={`reflection-${i}`} className="max-w-prose">
                  <input type="hidden" name="itemKey" value={lesson.item_key} />
                  <input type="hidden" name="promptIndex" value={i} />
                  <label htmlFor={`response-${i}`} className="block text-lg leading-relaxed text-ink">
                    {prompt}
                  </label>
                  <textarea
                    id={`response-${i}`}
                    name="response"
                    rows={6}
                    maxLength={MAX_REFLECTION_LENGTH}
                    defaultValue={value}
                    placeholder="Write here…"
                    className="mt-3 w-full resize-y rounded-lg border border-rule bg-white/[0.04] px-4 py-3 leading-relaxed text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <button
                      type="submit"
                      className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
                    >
                      Save response
                    </button>
                    {searchParams?.saved === String(i) && <span className="text-sm text-ink">Saved.</span>}
                    {value && searchParams?.saved !== String(i) && <span className="text-sm text-muted">Saved earlier. You can edit and save again.</span>}
                  </div>
                </form>
              );
            })}
          </div>
        </section>
      )}

      <section id="lesson-complete" className="mt-14 rounded-lg border border-rule bg-white/[0.04] p-6">
        {complete ? (
          <>
            <p className="font-serif text-xl text-ink">You have completed this lesson.</p>
            {searchParams?.completed === "1" && <p className="mt-1 text-sm text-muted">Saved to your progress.</p>}
            <form action={reopenLessonAction} className="mt-4">
              <input type="hidden" name="itemKey" value={lesson.item_key} />
              <button type="submit" className="text-sm text-muted underline decoration-rule underline-offset-2 hover:text-seal">
                Mark as not complete
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="font-serif text-xl text-ink">Finished with this lesson?</p>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
              {REFLECTION_REQUIRED_FOR_COMPLETION && prompts.length > 0
                ? allPromptsAnswered
                  ? "Your reflection is saved. Marking the lesson complete records it in your progress."
                  : "Save a response to each reflection prompt above, then mark the lesson complete."
                : "Marking the lesson complete records it in your progress."}{" "}
              This is your own record of your coursework. It does not certify you or move you past any step.
            </p>
            <form action={completeLessonAction} className="mt-4">
              <input type="hidden" name="itemKey" value={lesson.item_key} />
              <button
                type="submit"
                className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
              >
                Mark lesson complete
              </button>
            </form>
          </>
        )}
      </section>

      <nav className="mt-10 flex flex-wrap items-center justify-between gap-4 text-sm">
        {prev ? (
          <Link href={`/certification/lessons/${encodeURIComponent(prev.item_key)}`} className="max-w-[45%] text-muted hover:text-seal">
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/certification/lessons/${encodeURIComponent(next.item_key)}`} className="max-w-[45%] text-right text-muted hover:text-seal">
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
