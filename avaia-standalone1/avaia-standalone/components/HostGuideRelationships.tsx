import Link from "next/link";
import type { HostGuideRelationship } from "@/lib/ops/host-guide-relationships";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

/** The Host's own view of which Guide currently has their permission, and what kind. Visibility only: it shows what the Host already
 *  granted, adds no permission, and links to the places where access is already reviewed or ended. */
export default function HostGuideRelationships({ relationships }: { relationships: HostGuideRelationship[] }) {
  const hasJourney = relationships.some((r) => r.kind === "journey");
  return (
    <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm" aria-labelledby="your-guides">
      <p className="label mb-1 text-muted">Your Guides</p>
      <h2 id="your-guides" className="font-serif text-2xl text-ink">
        Who currently has your permission
      </h2>
      <p className="mt-2 max-w-prose text-sm text-muted">
        This shows only what you have already granted. It gives no one new access, and you can end any of it.
      </p>

      {relationships.length === 0 ? (
        <p className="mt-4 text-ink">No Guide currently has access to your Journey or your coordination items.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {relationships.map((r) => (
            <li key={r.key} className="rounded-md border border-rule bg-white/[0.03] p-4">
              <p className="text-ink">
                {r.guideName} <span className="text-muted">· {r.accessLabel} · {r.statusLabel}</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                Since {fmt(r.since)}
                {r.endsOn ? `. Ends ${fmt(r.endsOn)}.` : ". No end date."}
              </p>
              <p className="mt-2 text-sm text-muted">{r.detail}</p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Link href="/workbook/coordination/guide" className="text-ink underline decoration-rule underline-offset-2 hover:text-seal">
          Review or end Guide Coordination access →
        </Link>
        {hasJourney && (
          <span className="text-muted">To end Guided Journey access, use the Guided Journey box under that Journey, further down this page.</span>
        )}
      </p>
    </section>
  );
}
