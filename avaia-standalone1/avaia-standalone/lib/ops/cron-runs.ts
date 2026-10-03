import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import vercelConfig from "@/vercel.json";

/** Every scheduled job that records its own runs. A job that is scheduled in
 *  vercel.json but missing from this list is itself reported as a problem
 *  (see getCronHealth), so a new schedule cannot quietly go unwatched. */
export const RECORDED_CRON_NAMES = [
  "host-onboarding",
  "guide-operations",
  "founder-digest",
  "entitlement-reconciliation",
  "guardian-consent-reminder",
  "family-invite-reminder",
  "certification-companion",
  "system-checks",
  "prospect-research",
] as const;

export type CronName = (typeof RECORDED_CRON_NAMES)[number];

/** Records one cron invocation's outcome. Never throws -- a failure to
 *  record must not take down a cron whose actual work already succeeded;
 *  it only means that one run's visibility is lost, logged via
 *  console.error same as everything else in this codebase. */
export async function recordCronRun(params: {
  cronName: CronName;
  startedAt: Date;
  status: "success" | "partial" | "error";
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("cron_runs").insert({
      cron_name: params.cronName,
      started_at: params.startedAt.toISOString(),
      status: params.status,
      detail: params.detail ?? null,
    });
    // PostgREST returns a rejected insert (for example a cron name the table's
    // check constraint does not allow yet) as a value, not an exception, so it
    // has to be looked at explicitly or it vanishes. The schedule check in
    // lib/ops/system-truth.ts is what turns a missing record into a visible problem.
    if (error) console.error("[cron-runs] cron run was not recorded", { cronName: params.cronName, error: error.message });
  } catch (err) {
    console.error("[cron-runs] failed to record cron run", {
      cronName: params.cronName,
      error: err instanceof Error ? err.message : err,
    });
  }
}

// ---------------------------------------------------------------------------
// What SHOULD be running: read from vercel.json itself, so the list of
// expected schedules can never drift from the schedules actually configured.
// ---------------------------------------------------------------------------

export type ExpectedCron = { name: string; path: string; schedule: string; maxAgeHours: number };

/** How long a healthy job may go without a recorded run, from its schedule:
 *  weekly -> 8 days, every-N-hours -> N + 7 hours, otherwise daily -> 36 hours.
 *  Deliberately generous: this is meant to catch a job that has stopped, not
 *  one that ran a little late. */
export function maxAgeHoursFor(schedule: string): number {
  const [, hour, , , dow] = schedule.trim().split(/\s+/);
  if (dow && dow !== "*") return 8 * 24;
  const everyN = /^\*\/(\d+)$/.exec(hour ?? "");
  if (everyN) return Number(everyN[1]) + 7;
  return 36;
}

export function getExpectedCrons(): ExpectedCron[] {
  const crons = (vercelConfig as unknown as { crons?: { path: string; schedule: string }[] }).crons ?? [];
  return crons
    .map((c) => {
      const name = c.path.replace(/^\/api\/cron\//, "");
      return { name, path: c.path, schedule: c.schedule, maxAgeHours: maxAgeHoursFor(c.schedule) };
    })
    .filter((c) => c.path.startsWith("/api/cron/"));
}

export type CronHealthItem = {
  name: string;
  state: "ok" | "not_recorded_yet" | "missing" | "errored" | "partial" | "not_instrumented";
  detail: string;
};

/** Structured schedule health, the single source for both the Founder
 *  Digest's cron lines and the "Scheduled jobs" system check. For each job
 *  scheduled in vercel.json: has it recorded a run recently enough, and did
 *  that run succeed? A job with no record at all is only called "missing"
 *  once recording has been running longer than the job's own interval --
 *  otherwise a brand-new or weekly job would raise a false alarm before it
 *  has had a chance to run. */
export async function getCronHealth(): Promise<CronHealthItem[]> {
  const admin = createAdminClient();
  const expected = getExpectedCrons();
  const oldest = Math.max(...expected.map((c) => c.maxAgeHours), 36);
  const since = new Date(Date.now() - (oldest + 24) * 3_600_000).toISOString();

  const { data, error } = await admin
    .from("cron_runs")
    .select("cron_name, started_at, status")
    .gte("started_at", since)
    .order("started_at", { ascending: false });
  if (error) {
    return [
      {
        name: "(all)",
        state: "missing",
        detail: `Cron run history cannot be read (${error.message}). The cron_runs table may not exist -- run the catch-up migration.`,
      },
    ];
  }
  const rows = (data ?? []) as { cron_name: string; started_at: string; status: string }[];

  const { data: firstRow } = await admin
    .from("cron_runs")
    .select("started_at")
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const trackingSince = firstRow ? new Date(firstRow.started_at).getTime() : null;

  const items: CronHealthItem[] = [];
  for (const cron of expected) {
    if (!(RECORDED_CRON_NAMES as readonly string[]).includes(cron.name)) {
      items.push({
        name: cron.name,
        state: "not_instrumented",
        detail: `Cron "${cron.name}" is scheduled in vercel.json but does not record its runs, so nobody would notice if it stopped.`,
      });
      continue;
    }
    const latest = rows.find((r) => r.cron_name === cron.name);
    const ageLimit = Date.now() - cron.maxAgeHours * 3_600_000;
    if (!latest || new Date(latest.started_at).getTime() < ageLimit) {
      const historyIsLongEnough = trackingSince !== null && trackingSince < ageLimit;
      if (!historyIsLongEnough) {
        items.push({
          name: cron.name,
          state: "not_recorded_yet",
          detail: `Cron "${cron.name}" has not recorded a run yet; recording only began recently, so this is not yet a problem.`,
        });
      } else {
        items.push({
          name: cron.name,
          state: "missing",
          detail: `Cron "${cron.name}" has no recorded run in the last ${cron.maxAgeHours} hours -- check Vercel's Cron Jobs dashboard and CRON_SECRET (or, if it is a newly added job, that the latest migration has been applied).`,
        });
      }
    } else if (latest.status === "error") {
      items.push({ name: cron.name, state: "errored", detail: `Cron "${cron.name}" errored on its most recent run.` });
    } else if (latest.status === "partial") {
      items.push({
        name: cron.name,
        state: "partial",
        detail: `Cron "${cron.name}" completed its most recent run with some items failing.`,
      });
    } else {
      items.push({ name: cron.name, state: "ok", detail: `Cron "${cron.name}" ran ${new Date(latest.started_at).toISOString()}.` });
    }
  }
  return items;
}

/** The Founder Digest's cron lines: only what is actually wrong. */
export async function getCronHealthIssues(): Promise<string[]> {
  const items = await getCronHealth();
  return items.filter((i) => i.state !== "ok" && i.state !== "not_recorded_yet").map((i) => i.detail);
}
