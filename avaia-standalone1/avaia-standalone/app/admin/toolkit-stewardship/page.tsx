import { getToolkitStewardshipSummary } from "@/lib/ops/toolkit-stewardship";
import { toolLabel } from "@/lib/toolkit";

export const metadata = { title: "Toolkit Stewardship — AVAIA Admin" };
export const dynamic = "force-dynamic";

/** Admin-facing Toolkit Stewardship view. Exceptions-first, same posture
 *  as the Conversation Integrity and Certification Operations admin
 *  pages: resolved/closed items are collapsed to a count. This page is
 *  read-only -- recording a resolution is future work for a dedicated
 *  action UI; until then, use recordToolkitSupportResolution directly. */
export default async function AdminToolkitStewardshipPage() {
  const { summary, items } = await getToolkitStewardshipSummary();

  const openItems = items.filter((i) => i.state !== "resolved" && i.state !== "closed");

  return (
    <div>
      <p className="label mb-3">Toolkit Stewardship</p>
      <h1 className="font-serif text-4xl text-ink">Toolkit Stewardship</h1>
      <p className="mt-4 text-lg text-muted">
        Organizes Toolkit issues, surfaces broken or outdated resources, and tracks repeated support
        questions. It never invents AVAIA material, approves an adaptation, or changes authorization
        rules -- every ADAPTATION_REQUEST and ADDITION_REQUEST below waits for a human decision.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Open", value: summary.open },
          { label: "In review", value: summary.inReview },
          { label: "Awaiting human", value: summary.awaitingHuman },
          { label: "Policy required", value: summary.policyRequired.length },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
            <p className="font-serif text-2xl text-ink">{s.value}</p>
            <p className="label mt-1 text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {summary.healthIssues.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-2xl text-ink">Registry health issues</h2>
          <ul className="mt-3 space-y-2">
            {summary.healthIssues.map((issue, i) => (
              <li key={i} className="text-muted">
                {toolLabel(issue.toolKey)}: {issue.detail}
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.recurringPatterns.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-2xl text-ink">Recurring patterns</h2>
          <ul className="mt-3 space-y-2">
            {summary.recurringPatterns.map((p) => (
              <li key={`${p.toolKey}-${p.category}`} className="text-muted">
                {p.count}x {p.category} on {toolLabel(p.toolKey)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-serif text-2xl text-ink">Open items</h2>
        {openItems.length === 0 && <p className="mt-3 text-muted">No open Toolkit support items.</p>}
        <ul className="mt-3 space-y-3">
          {openItems.map((item) => (
            <li key={item.id} className="rounded-lg border border-rule px-4 py-3">
              <p className="text-ink">
                <strong>{toolLabel(item.toolKey)}</strong> -- {item.category} -- {item.state}
                {item.requiresHumanApproval && " -- requires human approval"}
              </p>
              <p className="mt-1 text-muted">{item.description}</p>
              {item.hostName && <p className="mt-1 text-sm text-muted">Filed by: {item.hostName}</p>}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-sm text-muted">{summary.healthyResolved} item(s) resolved or closed.</p>
    </div>
  );
}
