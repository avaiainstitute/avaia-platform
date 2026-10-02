import { getConversationIntegritySummary } from "@/lib/ops/conversation-integrity";

export const metadata = { title: "Conversation Integrity — AVAIA Admin" };
export const dynamic = "force-dynamic";

/** Admin-facing Conversation Integrity & Boundary Oversight view.
 *  Exceptions-first per item 23: routine NO_VIOLATION reviews are
 *  collapsed to a count, never individually paraded. A flag shown here is
 *  a possible flag for human review, never an automatic finding of
 *  misconduct -- this page exposes no conversation content beyond what an
 *  authorized reviewer needs (detection basis and the AVAIA rule
 *  implicated, never the message text). Setting human_disposition is
 *  future work for a dedicated review UI (see "intentionally deferred"
 *  in the final report); this page is read-only. */
export default async function AdminConversationIntegrityPage() {
  const { summary, flags } = await getConversationIntegritySummary();

  const openFlags = flags.filter((f) => f.reviewStatus !== "resolved");

  return (
    <div>
      <p className="label mb-3">Conversation Integrity</p>
      <h1 className="font-serif text-4xl text-ink">Boundary Oversight</h1>
      <p className="mt-4 text-lg text-muted">
        This agent protects the boundaries of the conversation without interpreting, diagnosing, or
        taking ownership of the person inside it. A flag below names an AVAIA rule a turn may be
        inconsistent with -- it is never a conclusion about anyone&apos;s character or condition, and
        never an automatic finding.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: "Open", value: summary.open },
          { label: "In review", value: summary.inReview },
          { label: "High priority", value: summary.highPriority.length },
          { label: "Policy required", value: summary.policyRequired.length },
          { label: "Legal review required", value: summary.legalReviewRequired.length },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
            <p className="font-serif text-2xl text-ink">{s.value}</p>
            <p className="label mt-1 text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {summary.recurringPatterns.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-2xl text-ink">Recurring patterns</h2>
          <ul className="mt-3 space-y-2">
            {summary.recurringPatterns.map((p) => (
              <li key={p.key} className="text-muted">
                {p.count}x {p.category} on {p.dimension}={p.value}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-serif text-2xl text-ink">Open flags</h2>
        {openFlags.length === 0 && <p className="mt-3 text-muted">No open integrity flags.</p>}
        <ul className="mt-3 space-y-3">
          {openFlags.map((flag) => (
            <li key={flag.id} className="rounded-lg border border-rule px-4 py-3">
              <p className="text-ink">
                <strong>{flag.flagCategory}</strong> -- {flag.severity} -- {flag.reviewStatus}
              </p>
              <p className="mt-1 text-muted">{flag.avaiaRuleImplicated}</p>
              <p className="mt-1 text-sm text-muted">Detection: {flag.detectionBasis}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-sm text-muted">{summary.healthyNoViolation} flag(s) reviewed as NO_VIOLATION.</p>
    </div>
  );
}
