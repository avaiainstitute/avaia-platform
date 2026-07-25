import { REPORTS, CONSENT_COVERS } from "@/lib/institution";

export const metadata = { title: "Reports & Consent — AVAIA" };

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <p className="label mb-3">Core Engine</p>
      <h1 className="font-serif text-4xl text-ink">The Report Engine</h1>
      <p className="mt-4 max-w-prose text-lg text-muted">
        One conversation, multiple report types. The conversation itself stays
        unchanged — only the report output changes, and each report shares only
        what its stated purpose requires, only with consent. Reports are starting
        points for conversation, not conclusions about a person.
      </p>

      <div className="mt-12 space-y-3">
        {REPORTS.map((r) => (
          <div key={r.name} className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-serif text-xl text-seal">{r.name}</p>
              <p className="label">{r.recipient}</p>
            </div>
            <p className="mt-2 text-ink">{r.contains}</p>
          </div>
        ))}
      </div>

      {/* Consent */}
      <section className="rule-t mt-16 border-t border-rule pt-12">
        <p className="label mb-2">Before anything is shared</p>
        <h2 className="font-serif text-3xl text-ink">The Consent Step</h2>
        <p className="mt-4 max-w-prose text-muted">
          The Host owns their story. Before recording or sharing, the platform
          makes the terms explicit:
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONSENT_COVERS.map((c) => (
            <div key={c} className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4">
              <p className="text-ink">{c}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
