import "server-only";
import type { CheckResult } from "@/lib/ops/system-checks";

// PROOF OF SEPARATION. The Pink Shoelace Foundation is separate from AVAIA, so
// AVAIA's operational list (What Needs Dorian, which is also the daily Founder
// Digest) must contain nothing that belongs to the Foundation. This check builds
// AVAIA's real snapshot and fails if any item, link or "handled automatically"
// line mentions Pink Shoelace.
//
// getNeedsDorian is loaded on demand (not imported at the top) because the
// system-check runner that calls this is itself used by getNeedsDorian.

export async function pinkSeparationChecks(): Promise<CheckResult[]> {
  const label = "AVAIA's operations contain no Pink Shoelace Foundation items";
  try {
    const { getNeedsDorian } = await import("@/lib/ops/needs-dorian");
    const snapshot = await getNeedsDorian();
    const all = [
      ...snapshot.people.items,
      ...snapshot.decisions.items,
      ...snapshot.approvals.items,
      ...snapshot.problems.items,
      ...snapshot.opportunities.items,
      ...snapshot.watching.items,
    ];
    const leaked = all.filter((i) => /pink|shoelace/i.test(`${i.text} ${i.href ?? ""} ${i.detail ?? ""}`));
    const leakedAuto = snapshot.automatic.filter((l) => /pink|shoelace/i.test(l));
    if (leaked.length === 0 && leakedAuto.length === 0) {
      return [{ category: "quality", checkKey: "separation_pink_not_in_avaia", label, status: "pass", detail: `Checked ${all.length} item(s) in AVAIA's list; none mention Pink Shoelace. Pink Shoelace operations live in /pink-admin and the Pink daily summary.` }];
    }
    return [
      {
        category: "quality",
        checkKey: "separation_pink_not_in_avaia",
        label,
        status: "problem",
        detail: `${leaked.length + leakedAuto.length} Pink Shoelace item(s) appeared in AVAIA's operational list: ${[...leaked.map((i) => i.text), ...leakedAuto].slice(0, 3).join(" | ")}.`,
      },
    ];
  } catch (e) {
    return [{ category: "quality", checkKey: "separation_pink_not_in_avaia", label, status: "problem", detail: `Could not run: ${e instanceof Error ? e.message : String(e)}.` }];
  }
}
