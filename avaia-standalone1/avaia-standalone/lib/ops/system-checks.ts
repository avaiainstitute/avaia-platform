import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Round 4 (Automation Blueprint): Website Watcher, Journey Watcher, Shared
// Room Operations Watcher, Launch Readiness Watcher, and Testing/QC -- one
// shared engine, per Dorian's own instruction that these "connect... rather
// than duplicating" each other. A fixed list of named, read-only checks
// runs on a schedule (app/api/cron/system-checks/route.ts) or on demand
// (app/admin/system-checks's "Run now"), and every check's result is
// written to system_check_results (migration 0073) tagged with which
// watcher category it belongs to.
//
// Every check here is read-only and side-effect-free: HTTP GETs against
// pages/routes that already exist in production (never a POST, so no form
// submission, email, or database write is ever triggered), and Supabase
// reads that select only operational metadata columns -- status flags,
// timestamps, row counts -- never conversation/message/room content. This
// is a deliberate, narrow set of checks against functionality that already
// exists and is already expected to work; nothing here invents a new
// launch requirement, a new SLA, or a new certification rubric.

export type CheckCategory = "website" | "quality" | "journey" | "shared_room" | "launch_readiness";
export type CheckStatus = "pass" | "problem" | "needs_dorian";

export type CheckResult = {
  category: CheckCategory;
  checkKey: string;
  label: string;
  status: CheckStatus;
  detail: string | null;
};

const AVAIA_SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://avaiainstitute.com";
// Confirmed production domain (lib/pink/cors.ts's own allow-list), not a
// guess -- both thepinkshoelace.org and www.thepinkshoelace.org serve the
// same content, so only the canonical apex is checked here.
const PINK_SITE = "https://thepinkshoelace.org";

const FETCH_TIMEOUT_MS = 8000;

async function fetchStatus(url: string): Promise<{ ok: boolean; status: number | null; error: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual", signal: controller.signal });
    // A 2xx/3xx (including an intentional sign-in redirect on a gated page)
    // counts as "the route is alive and responding as designed." Only a
    // 5xx, or no response at all, is treated as a real operational problem.
    return { ok: res.status < 500, status: res.status, error: null };
  } catch (e: any) {
    return { ok: false, status: null, error: e?.name === "AbortError" ? "timed out" : String(e?.message ?? e) };
  } finally {
    clearTimeout(timeout);
  }
}

async function pageCheck(category: CheckCategory, checkKey: string, label: string, url: string): Promise<CheckResult> {
  const { ok, status, error } = await fetchStatus(url);
  return {
    category,
    checkKey,
    label,
    status: ok ? "pass" : "needs_dorian",
    detail: ok ? `HTTP ${status}` : `HTTP ${status ?? "no response"}${error ? ` (${error})` : ""} -- ${url}`,
  };
}

/** A GET against a route that only exports POST should come back 405
 *  (Next.js's own automatic behavior for an unhandled method) -- proof the
 *  route exists and is deployed, with zero side effects (no submission is
 *  ever sent). A 404 means the route itself is missing; a 5xx means it's
 *  erroring before even reaching the method check. */
async function postOnlyRouteExistsCheck(checkKey: string, label: string, url: string): Promise<CheckResult> {
  const { status, error } = await fetchStatus(url);
  if (status === 405) return { category: "quality", checkKey, label, status: "pass", detail: "Route responds (405 on GET, as expected for a POST-only endpoint)." };
  if (status === 404) return { category: "quality", checkKey, label, status: "needs_dorian", detail: `Route not found (404) at ${url}.` };
  if (status && status >= 500) return { category: "quality", checkKey, label, status: "problem", detail: `Route errored (HTTP ${status}) at ${url}.` };
  return { category: "quality", checkKey, label, status: "needs_dorian", detail: `Unexpected response (HTTP ${status ?? "none"}${error ? `, ${error}` : ""}) at ${url}.` };
}

/** A cron route should reject a request with no Authorization header.
 *  Calling it with no credentials never runs the route's own side effects
 *  (isAuthorizedCronRequest denies first, before any digest/reminder logic
 *  runs) -- this only proves the gate itself is still in place. */
async function cronAuthGateCheck(checkKey: string, label: string, url: string): Promise<CheckResult> {
  const { status } = await fetchStatus(url);
  if (status === 401) return { category: "quality", checkKey, label, status: "pass", detail: "Correctly rejects an unauthenticated request (401)." };
  if (status === 404) return { category: "quality", checkKey, label, status: "needs_dorian", detail: `Route not found (404) at ${url}.` };
  return {
    category: "quality",
    checkKey,
    label,
    status: "problem",
    detail: `Expected 401 for an unauthenticated request, got HTTP ${status ?? "no response"} at ${url}. If this route is not actually rejecting unauthenticated calls, treat this as urgent.`,
  };
}

async function websiteChecks(): Promise<CheckResult[]> {
  return Promise.all([
    pageCheck("website", "avaia_home", "AVAIA home page", `${AVAIA_SITE}/`),
    pageCheck("website", "avaia_contact_page", "AVAIA contact page", `${AVAIA_SITE}/contact`),
    pageCheck("website", "avaia_experiences_page", "AVAIA Experiences page (Agent 8 inbound)", `${AVAIA_SITE}/experiences`),
    pageCheck("website", "avaia_defying_grief_page", "AVAIA Defying Grief page", `${AVAIA_SITE}/defying-grief`),
    pageCheck("website", "avaia_toolkit_gate", "AVAIA Toolkit page (membership gate)", `${AVAIA_SITE}/toolkit`),
    pageCheck("website", "pink_home", "Pink Shoelace home page", `${PINK_SITE}/`),
    pageCheck("website", "pink_get_involved_page", "Pink Shoelace Get Involved page (participation form)", `${PINK_SITE}/get-involved.html`),
    pageCheck("website", "pink_contact_page", "Pink Shoelace contact page", `${PINK_SITE}/contact.html`),
  ]);
}

async function qualityChecks(): Promise<CheckResult[]> {
  return Promise.all([
    cronAuthGateCheck("cron_auth_founder_digest", "Founder Digest cron rejects unauthenticated requests", `${AVAIA_SITE}/api/cron/founder-digest`),
    cronAuthGateCheck("cron_auth_prospect_research", "Prospect research cron rejects unauthenticated requests", `${AVAIA_SITE}/api/cron/prospect-research`),
    postOnlyRouteExistsCheck("route_contact_exists", "AVAIA contact form endpoint is deployed", `${AVAIA_SITE}/api/contact`),
    postOnlyRouteExistsCheck("route_experiences_inquiry_exists", "Experiences inquiry endpoint is deployed", `${AVAIA_SITE}/api/experiences/inquiry`),
    postOnlyRouteExistsCheck("route_pink_participation_exists", "Pink participation endpoint is deployed", `${AVAIA_SITE}/api/pink/participation`),
    postOnlyRouteExistsCheck("route_pink_contact_exists", "Pink contact endpoint is deployed", `${AVAIA_SITE}/api/pink/contact`),
  ]);
}

/** Operational metadata only -- host_id, stage, status, timestamps. Never
 *  selects messages.content or anything Host-written. This mirrors the
 *  exact same column discipline lib/ops/host-onboarding.ts's own comment
 *  already documents for the same table. */
async function journeyChecks(): Promise<CheckResult[]> {
  const admin = createAdminClient();
  const results: CheckResult[] = [];

  const { error: convError, count: convCount } = await admin
    .from("conversations")
    .select("id", { count: "exact", head: true });
  results.push({
    category: "journey",
    checkKey: "journey_conversations_reachable",
    label: "Journey machinery (conversations table) reachable",
    status: convError ? "problem" : "pass",
    detail: convError ? convError.message : `Reachable (${convCount ?? 0} total conversation record(s)).`,
  });

  const { error: journeysError, count: journeysCount } = await admin
    .from("journeys")
    .select("id", { count: "exact", head: true });
  results.push({
    category: "journey",
    checkKey: "journey_journeys_reachable",
    label: "Journey grouping (journeys table) reachable",
    status: journeysError ? "problem" : "pass",
    detail: journeysError ? journeysError.message : `Reachable (${journeysCount ?? 0} total Journey record(s)).`,
  });

  return results;
}

/** Operational state only -- rooms.status, room_participants membership
 *  timestamps. Never selects room_messages, room_workbook_items, or
 *  room_private_sessions content, and never exposes step-out material,
 *  even in aggregate, matching Dorian's explicit instruction that private
 *  Room content stays private even from Founder/Admin. */
async function sharedRoomChecks(): Promise<CheckResult[]> {
  const admin = createAdminClient();
  const results: CheckResult[] = [];

  const { data: roomRows, error: roomsError } = await admin
    .from("rooms")
    .select("id, status, created_at")
    .eq("status", "active");

  if (roomsError) {
    results.push({
      category: "shared_room",
      checkKey: "shared_room_reachable",
      label: "Shared Room machinery reachable",
      status: "problem",
      detail: roomsError.message,
    });
    return results;
  }

  results.push({
    category: "shared_room",
    checkKey: "shared_room_reachable",
    label: "Shared Room machinery reachable",
    status: "pass",
    detail: `Reachable (${roomRows?.length ?? 0} active Room(s)).`,
  });

  const activeRooms = roomRows ?? [];
  if (activeRooms.length === 0) {
    results.push({
      category: "shared_room",
      checkKey: "shared_room_unjoined_stale",
      label: "Active Rooms nobody has joined",
      status: "pass",
      detail: "No active Rooms to check.",
    });
    return results;
  }

  const { data: participantRows } = await admin
    .from("room_participants")
    .select("room_id")
    .in("room_id", activeRooms.map((r) => r.id));
  const roomsWithParticipants = new Set((participantRows ?? []).map((p) => p.room_id));

  const staleDays = Number(process.env.SHARED_ROOM_UNJOINED_STALE_DAYS ?? 14);
  const now = Date.now();
  const staleUnjoined = activeRooms.filter(
    (r) => !roomsWithParticipants.has(r.id) && (now - new Date(r.created_at).getTime()) / 86_400_000 >= staleDays
  );

  results.push({
    category: "shared_room",
    checkKey: "shared_room_unjoined_stale",
    label: "Active Rooms nobody has joined",
    status: staleUnjoined.length > 0 ? "needs_dorian" : "pass",
    detail:
      staleUnjoined.length > 0
        ? `${staleUnjoined.length} active Room(s) created ${staleDays}+ days ago with no participant yet -- an operational follow-up may be appropriate. No conversation content is included.`
        : "No active, unjoined Rooms older than the stale threshold.",
  });

  return results;
}

function summarize(checks: CheckResult[]): CheckStatus {
  if (checks.some((c) => c.status === "problem")) return "problem";
  if (checks.some((c) => c.status === "needs_dorian")) return "needs_dorian";
  return "pass";
}

/** Runs every check, writes one row per check to system_check_results under
 *  a shared run_id, and returns the full set plus Launch Readiness's own
 *  change-detection against the immediately preceding run. Always
 *  best-effort per check-group -- one category failing to run never blocks
 *  another, same posture as prospect research's per-vertical isolation. */
export async function runSystemChecks(): Promise<{
  runId: string;
  results: CheckResult[];
  launchReadiness: { status: "still_good" | "something_broke" | "needs_attention"; detail: string };
}> {
  const admin = createAdminClient();

  const groups = await Promise.allSettled([websiteChecks(), qualityChecks(), journeyChecks(), sharedRoomChecks()]);
  const results: CheckResult[] = [];
  for (const g of groups) {
    if (g.status === "fulfilled") results.push(...g.value);
    else results.push({ category: "quality", checkKey: "check_group_failed", label: "A check group failed to run", status: "problem", detail: String(g.reason) });
  }

  const overall = summarize(results);
  const launchStatus: "still_good" | "something_broke" | "needs_attention" =
    overall === "problem" ? "something_broke" : overall === "needs_dorian" ? "needs_attention" : "still_good";

  // Compare to the previous run for a real change-detection statement,
  // rather than just repeating today's snapshot every time.
  const { data: prevRun } = await admin
    .from("system_check_results")
    .select("run_id, checked_at")
    .eq("category", "launch_readiness")
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let changeDetail: string;
  if (!prevRun) {
    changeDetail = "First recorded run -- nothing to compare against yet.";
  } else {
    const { data: prevResult } = await admin
      .from("system_check_results")
      .select("status")
      .eq("run_id", prevRun.run_id)
      .eq("category", "launch_readiness")
      .eq("check_key", "overall")
      .maybeSingle();
    const prevStatus = prevResult?.status;
    changeDetail =
      prevStatus === launchStatusToDbStatus(launchStatus)
        ? `Unchanged since the last check (${new Date(prevRun.checked_at).toLocaleString()}).`
        : `Changed since the last check (${new Date(prevRun.checked_at).toLocaleString()}), which was ${prevStatus ?? "unknown"}.`;
  }

  const runId = crypto.randomUUID();
  const rows = results.map((r) => ({
    run_id: runId,
    category: r.category,
    check_key: r.checkKey,
    label: r.label,
    status: r.status,
    detail: r.detail,
  }));
  rows.push({
    run_id: runId,
    category: "launch_readiness",
    check_key: "overall",
    label: "Overall launch readiness",
    status: launchStatusToDbStatus(launchStatus),
    detail: changeDetail,
  });

  const { error: insertError } = await admin.from("system_check_results").insert(rows);
  if (insertError) console.error("System checks: failed to record results:", insertError.message);

  return { runId, results, launchReadiness: { status: launchStatus, detail: changeDetail } };
}

function launchStatusToDbStatus(s: "still_good" | "something_broke" | "needs_attention"): CheckStatus {
  return s === "still_good" ? "pass" : s === "something_broke" ? "problem" : "needs_dorian";
}

/** For the Founder Digest / command center: the most recent run's
 *  problem/needs_dorian items only, never the full pass list (keeping the
 *  digest from flooding with "everything is fine" noise). */
export async function getLatestCheckProblems(): Promise<CheckResult[]> {
  const admin = createAdminClient();
  const { data: latest } = await admin
    .from("system_check_results")
    .select("run_id")
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return [];

  const { data } = await admin
    .from("system_check_results")
    .select("category, check_key, label, status, detail")
    .eq("run_id", latest.run_id)
    .neq("status", "pass");

  return (data ?? []).map((r) => ({
    category: r.category as CheckCategory,
    checkKey: r.check_key,
    label: r.label,
    status: r.status as CheckStatus,
    detail: r.detail,
  }));
}
