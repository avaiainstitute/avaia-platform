import { getPracticeLabs } from "@/lib/certification-content";
import {
  FEEDBACK_KEYS,
  FEEDBACK_LABEL,
  LAB_CRITERION_LABEL,
  LAB_FIRST_CRITERIA,
  LAB_FIRST_RATING_LABEL,
  LAB_SECOND_CRITERIA,
  LAB_SECOND_RATING_LABEL,
  PRACTICUM_RATING_LABEL,
  type LabFirstRating,
  type LabSecondRating,
  type PracticumRating,
} from "@/lib/certification-evaluation";
import {
  GATE_ITEM_REFERENCE,
  LAB_EVALUATOR_CHECKS,
  PRACTICE_COMPLETION_STANDARD,
  PRACTICUM_ROW_REFERENCE,
  RETRY_RULE,
} from "@/lib/certification-evaluator-reference";
import { getEvaluationSummary, getHostSeatMetadata, getPracticeStatus } from "@/lib/ops/certification-evaluations";
import { recordGateAction, recordLabAction, recordPracticumAction } from "./evaluation-actions";

// The human evaluation instruments for one candidate (admin only). A person
// evaluates and records; the system only adds up what was recorded. AI never
// evaluates, scores or certifies. The evaluator-only wording shown here (pass
// standards, retraining paths, what to watch for) is imported from the
// evaluator reference, which no candidate-facing surface or the Companion may
// import (enforced at build time).

const fieldClass = "w-full rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink";
const optionClass = "bg-[#05060b] text-ink";

const titleCase = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export default async function EvaluationSections({ candidateId, hostId, closed }: { candidateId: string; hostId: string; closed: boolean }) {
  const [summary, practice, hostSeat] = await Promise.all([getEvaluationSummary(candidateId), getPracticeStatus(candidateId), getHostSeatMetadata(hostId)]);
  const labs = getPracticeLabs();
  const latestGate = summary.gate[0] ?? null;
  const latestPracticum = summary.practicum[0] ?? null;

  return (
    <div id="evaluations" className="mt-14 space-y-12 border-t border-rule pt-8">
      <div>
        <p className="label mb-3 text-muted">Human Evaluations</p>
        <p className="text-sm text-muted">
          You evaluate; the system only adds up what you record. Each result is written as the matching evidence step above, which feeds the
          certification decision. AI may support a candidate&rsquo;s practice but never evaluates, scores or certifies. Admission already happened
          (Gate 1); certification is the separate decision you make at the end (Gate 2).
        </p>
      </div>

      {/* Host-seat experience */}
      <section>
        <p className="label mb-3 text-muted">Personal Host-Seat Experience</p>
        <div className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 text-sm">
          <p className="text-muted">
            Metadata only: the stages this person has been through as a Host. Their conversations, Guide&rsquo;s Records and Workbook are not shown here.
            Whether this was a genuine Host-seat experience is your judgment; record it with &ldquo;Record Evidence&rdquo; above (type: Personal Host-Seat Experience).
          </p>
          <p className="mt-3 text-ink">
            Journeys started: {hostSeat.journeysStarted}; completed: {hostSeat.journeysCompleted}.
          </p>
          {hostSeat.stages.length === 0 ? (
            <p className="mt-1 text-muted">No Journey stages yet.</p>
          ) : (
            <ul className="mt-1 text-ink">
              {hostSeat.stages.map((s, i) => (
                <li key={i}>
                  {s.stage.toUpperCase()}: {s.status} (started {new Date(s.startedAt).toLocaleDateString()})
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Boundary Gate */}
      <section>
        <p className="label mb-3 text-muted">Boundary Gate (ten items)</p>
        <p className="mb-3 text-sm text-muted">
          Administered together after Module 6. Every item must be met to proceed to Practice Labs. Safety is never waived or partially scored.
          {latestGate ? ` Last recorded ${new Date(latestGate.created_at).toLocaleDateString()}: ${latestGate.all_met ? "all met" : "not all met"}.` : " Not recorded yet."}
        </p>
        {closed ? (
          <p className="text-muted">This candidacy is closed.</p>
        ) : (
          <form action={recordGateAction} className="space-y-4 rounded-lg border border-rule bg-white/[0.04] p-5">
            <input type="hidden" name="candidateId" value={candidateId} />
            {GATE_ITEM_REFERENCE.map((g) => (
              <fieldset key={g.key} className="border-b border-rule/60 pb-4 last:border-b-0">
                <legend className="font-serif text-lg text-ink">
                  {g.number}. {g.title} <span className="text-xs text-muted">({g.source})</span>
                </legend>
                <p className="mt-2 text-sm text-muted">{g.prompt}</p>
                <p className="mt-2 text-sm text-ink">
                  <span className="label text-muted">Pass standard: </span>
                  {g.passStandard}
                </p>
                <p className="mt-1 text-sm text-muted">
                  <span className="label">If not met: </span>
                  {g.retraining}
                </p>
                <div className="mt-2 flex gap-6 text-sm text-ink">
                  <label className="flex items-center gap-2">
                    <input type="radio" name={`gate_${g.key}`} value="met" required /> Met
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name={`gate_${g.key}`} value="not_met" required /> Not met
                  </label>
                </div>
              </fieldset>
            ))}
            <textarea name="notes" rows={2} className={`${fieldClass} resize-none`} placeholder="Notes (optional)" />
            <button type="submit" className="rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] hover:opacity-90">
              Record Boundary Gate
            </button>
          </form>
        )}
      </section>

      {/* Practice Labs */}
      <section>
        <p className="label mb-3 text-muted">Practice Labs ({practice.completed} of {practice.total} complete)</p>
        <p className="mb-3 text-sm text-muted">{PRACTICE_COMPLETION_STANDARD}</p>
        <div className="mb-4 grid gap-1 text-sm sm:grid-cols-2">
          {labs.map((l) => {
            const s = practice.latestByLab.get(l.item_key);
            return (
              <p key={l.item_key} className="text-ink">
                {l.title}: <span className={s?.lab_complete ? "text-seal" : "text-muted"}>{s ? (s.lab_complete ? "complete" : s.targeted_retry_required ? "targeted retry required" : "in progress") : "not evaluated"}</span>
              </p>
            );
          })}
        </div>
        {closed ? null : (
          <form action={recordLabAction} className="space-y-4 rounded-lg border border-rule bg-white/[0.04] p-5">
            <input type="hidden" name="candidateId" value={candidateId} />
            <p className="label text-muted">Universal Practice Lab Evaluation (after each Lab)</p>
            <p className="text-xs text-muted">{RETRY_RULE}</p>
            <select name="labKey" required defaultValue="" className={fieldClass}>
              <option value="" disabled className={optionClass}>
                Which Lab
              </option>
              {labs.map((l, i) => (
                <option key={l.item_key} value={l.item_key} className={optionClass}>
                  {i + 1}. {l.title}
                </option>
              ))}
            </select>
            {LAB_FIRST_CRITERIA.map((k) => (
              <div key={k}>
                <label className="label mb-1 block text-muted" htmlFor={`lab_${k}`}>
                  {LAB_CRITERION_LABEL[k]}
                </label>
                <select id={`lab_${k}`} name={`lab_${k}`} required defaultValue="" className={fieldClass}>
                  <option value="" disabled className={optionClass}>
                    Rating
                  </option>
                  {(Object.keys(LAB_FIRST_RATING_LABEL) as LabFirstRating[]).map((r) => (
                    <option key={r} value={r} className={optionClass}>
                      {LAB_FIRST_RATING_LABEL[r]}
                    </option>
                  ))}
                </select>
                <input name={`lab_${k}_evidence`} className={`${fieldClass} mt-1`} placeholder="Evidence" />
              </div>
            ))}
            {LAB_SECOND_CRITERIA.map((k) => (
              <div key={k}>
                <label className="label mb-1 block text-muted" htmlFor={`lab_${k}`}>
                  {LAB_CRITERION_LABEL[k]}
                </label>
                <select id={`lab_${k}`} name={`lab_${k}`} required defaultValue="" className={fieldClass}>
                  <option value="" disabled className={optionClass}>
                    Rating
                  </option>
                  {(Object.keys(LAB_SECOND_RATING_LABEL) as LabSecondRating[]).map((r) => (
                    <option key={r} value={r} className={optionClass}>
                      {LAB_SECOND_RATING_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <fieldset>
              <legend className="label mb-1 text-muted">Candidate Feedback Response: can the candidate&hellip;</legend>
              <div className="flex flex-wrap gap-5 text-sm text-ink">
                {FEEDBACK_KEYS.map((k) => (
                  <label key={k} className="flex items-center gap-2">
                    <input type="checkbox" name={`feedback_${k}`} /> {FEEDBACK_LABEL[k]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="targetedRetryRequired" /> A targeted retry is still required (with a different story, same competency)
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="labComplete" /> Mark this Lab complete (needs all four feedback steps and no retry required)
            </label>
            <textarea name="notes" rows={2} className={`${fieldClass} resize-none`} placeholder="Notes (optional)" />
            {Object.entries(LAB_EVALUATOR_CHECKS).map(([key, c]) => (
              <div key={key} className="rounded-md border border-rule px-4 py-3 text-sm">
                <p className="label text-muted">{c.title}</p>
                <ul className="mt-1 list-disc pl-5 text-ink">
                  {c.checks.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                {c.limit && <p className="mt-1 text-xs text-muted">{c.limit}</p>}
              </div>
            ))}
            <button type="submit" className="rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] hover:opacity-90">
              Record Lab evaluation
            </button>
          </form>
        )}
      </section>

      {/* Observed Practicum */}
      <section>
        <p className="label mb-3 text-muted">Observed Practicum (eleven rows)</p>
        <p className="mb-3 text-sm text-muted">
          A complete, realistic session watched end to end. Score every row; &ldquo;Meets&rdquo; across all rows is needed for a certification recommendation.
          {latestPracticum ? ` Last recorded ${new Date(latestPracticum.created_at).toLocaleDateString()}: ${latestPracticum.all_meets ? "Meets on all rows" : "not yet Meets on every row"}.` : " Not recorded yet."}
        </p>
        {closed ? null : (
          <form action={recordPracticumAction} className="space-y-4 rounded-lg border border-rule bg-white/[0.04] p-5">
            <input type="hidden" name="candidateId" value={candidateId} />
            {PRACTICUM_ROW_REFERENCE.map((r) => (
              <fieldset key={r.key} className="border-b border-rule/60 pb-4 last:border-b-0">
                <legend className="font-serif text-lg text-ink">
                  {r.competency} <span className="text-xs text-muted">({r.source})</span>
                </legend>
                <p className="mt-1 text-sm text-muted">{r.watchesFor}</p>
                <div className="mt-2 flex gap-6 text-sm text-ink">
                  {(Object.keys(PRACTICUM_RATING_LABEL) as PracticumRating[]).map((v) => (
                    <label key={v} className="flex items-center gap-2">
                      <input type="radio" name={`row_${r.key}`} value={v} required /> {PRACTICUM_RATING_LABEL[v]}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <textarea name="notes" rows={2} className={`${fieldClass} resize-none`} placeholder="Notes (optional)" />
            <button type="submit" className="rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] hover:opacity-90">
              Record Observed Practicum
            </button>
          </form>
        )}
      </section>

      {(summary.gate.length > 1 || summary.practicum.length > 1) && (
        <p className="text-xs text-muted">
          Earlier attempts are kept: {summary.gate.length} Gate record(s), {summary.practicum.length} Practicum record(s).{" "}
          {summary.gate.length > 0 && `Latest Gate not met on: ${Object.entries(summary.gate[0].items).filter(([, v]) => v === "not_met").map(([k]) => titleCase(k)).join(", ") || "none"}.`}
        </p>
      )}
    </div>
  );
}
