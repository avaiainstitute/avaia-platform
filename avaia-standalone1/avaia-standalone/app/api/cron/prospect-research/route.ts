import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { runProspectResearch } from "@/lib/research/prospect-research";
import { recordCronRun } from "@/lib/ops/cron-runs";
import { SCHEDULED_RESEARCH_VERTICALS } from "@/lib/admin-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Agents 3, 4, and 8's outbound research (Automation Blueprint Round 3),
// plus the Round 4 Opportunity Finder's "speaking" vertical.
// Weekly by default (see vercel.json) -- this is research/discovery, not
// anything time-sensitive, and keeping the cadence modest keeps API cost
// and prospect-list growth manageable so Dorian is never handed a flood.
// Each vertical runs independently and best-effort: one failing never
// blocks the others, matching the posture already used by every other
// cron route in this app (see host-onboarding, guide-operations).
const MAX_RESULTS_PER_VERTICAL = Number(process.env.PROSPECT_RESEARCH_MAX_PER_RUN ?? 5);

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const results: Record<string, { inserted: number; skipped: number } | { error: string }> = {};

  // AVAIA's own business development only (program, speaking), stored in AVAIA's tables. The
  // "partnership" and "donor" research wrote into the Pink Shoelace Foundation's tables from this
  // AVAIA job (and "partnership" searched for both organizations at once); both were taken off
  // this schedule on 2026-10-05. Their earlier output is preserved untouched.
  for (const vertical of SCHEDULED_RESEARCH_VERTICALS) {
    try {
      results[vertical] = await runProspectResearch(vertical, MAX_RESULTS_PER_VERTICAL);
    } catch (e) {
      console.error(`Prospect research cron: ${vertical} failed:`, e);
      results[vertical] = { error: e instanceof Error ? e.message : "unknown error" };
    }
  }

  const anyFailed = Object.values(results).some((r) => "error" in r);
  await recordCronRun({ cronName: "prospect-research", startedAt, status: anyFailed ? "partial" : "success", detail: { results } });
  return NextResponse.json({ ok: true, results });
}
