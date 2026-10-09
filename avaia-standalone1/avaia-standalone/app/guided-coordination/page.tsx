import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { GuideHostSummary } from "@/lib/coordination-guide";
import { listGuideHosts } from "@/lib/ops/coordination-guide";

export const metadata = { title: "Guide coordination, AVAIA" };
export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const fmtDue = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

/** The Guide's landing: only Hosts who have given this Guide a live, unexpired grant. Counts only, nothing
 *  inferred or ranked. Everything shown here comes from one database function that re-checks, on every call,
 *  the Guide's certification and coordination_support capability and each Host's grant. */
export default async function GuidedCoordinationPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/guided-coordination");

  let hosts: GuideHostSummary[] = [];
  let failed = false;
  try {
    hosts = await listGuideHosts(supabase);
  } catch {
    failed = true;
  }

  return (
    <div>
      <p className="label mb-3">Guide coordination</p>
      <h1 className="font-serif text-4xl text-ink">Hosts who have given you access.</h1>
      <p className="mt-4 text-lg text-muted">
        You can see only the items and entries each Host chose, for the time they chose. You do not own their decisions, their record or their words.
        What you record here is labelled as yours.
      </p>

      {failed && (
        <p className="mt-8 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          This could not be loaded just now. Please try again in a moment.
        </p>
      )}

      {!failed && hosts.length === 0 ? (
        <p className="mt-10 text-muted">No Host has given you coordination access right now.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {hosts.map((h) => (
            <li key={h.grant_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
              <div>
                <p className="text-ink">{h.host_label}</p>
                <p className="text-xs text-muted">
                  {h.item_count} {h.item_count === 1 ? "item" : "items"}
                  {h.waiting_on_guide_count > 0 ? ` · ${h.waiting_on_guide_count} waiting on you` : ""}
                  {h.next_due ? ` · next due ${fmtDue(h.next_due)}` : ""}
                  {h.open_flags > 0 ? ` · ${h.open_flags} flag${h.open_flags === 1 ? "" : "s"} not yet seen by the Host` : ""}
                </p>
                <p className="text-xs text-muted">Access until {fmt(h.ends_at)}</p>
              </div>
              <Link
                href={`/guided-coordination/${h.grant_id}`}
                prefetch={false}
                className="rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
