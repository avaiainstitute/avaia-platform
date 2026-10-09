import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { EXPECTED_COLUMNS, EXPECTED_RPCS, EXPECTED_TABLES } from "@/lib/ops/expected-schema.generated";
import { RECORDED_CRON_NAMES, getCronHealth } from "@/lib/ops/cron-runs";
import type { CheckResult, CheckStatus } from "@/lib/ops/system-checks";

// "AVAIA tells the truth about itself." A group of checks inside the EXISTING
// system-check runner (lib/ops/system-checks.ts, its cron, its results table,
// its Founder Digest and /admin/today surfacing) that compares what the
// application believes exists with what production actually contains:
//
//   * schema_*  -- every table, column and database function the code needs
//                  is really in the database; row-level security is on;
//                  a few rules that protect privacy and scheduling are in place.
//   * schedule_* -- every job scheduled in vercel.json has recorded a recent run.
//   * deploy_*   -- production is running the latest commit of the production
//                  branch, from the right branch, with the environment it needs.
//
// Metadata-only by construction: this reads table and column NAMES, policy
// and trigger names, timestamps and statuses. It never selects a row's
// content from any table (every probe below uses limit(0)).
//
// Rows use the existing "quality" category (the Testing/QC group) so they can
// be recorded before any new migration is applied; a new category would have
// required a database change just to store the result.

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://avaiainstitute.com";

/** The branch Vercel is expected to build production from. If this ever
 *  stops being true the check below says so (the 2026-08-17 incident). */
const PRODUCTION_BRANCH = "defying-grief-v2";
const GITHUB_REPO = "avaiainstitute/avaia-platform";

// ---------------------------------------------------------------------------
// Safeguards against "built but not operating" (the 1-2 October 2026 failure:
// seven automation systems were written to `main`, which is not the production
// branch, and nothing noticed for days).
// ---------------------------------------------------------------------------

/** Branches whose unreleased work was reviewed and deliberately superseded.
 *  A branch is ignored ONLY while its tip is exactly the recorded commit, so any
 *  new commit written to it is reported again. `main`'s seven agents were
 *  completed on production's own architecture and archived as the Git tag
 *  archive/main-2026-10-03. */
const ARCHIVED_BRANCH_TIPS: Record<string, string> = {
  main: "ad9710d58eda5ce552c5d7bbfd8ea1c164fd87c9",
};

/** A branch with unreleased work is only "stray" while it is recent; older
 *  branches are long-paused feature work that is tracked elsewhere. */
const STRAY_BRANCH_RECENT_DAYS = 30;

/** Tables that exist in the database but are deliberately not used by the
 *  application's code today. Every one is preserved (nothing is ever dropped to
 *  tidy up). A table that is in the database, not used by code, and NOT listed
 *  here is reported: that is exactly what a migration applied without its
 *  application code looks like. */
const PRESERVED_UNUSED_TABLES: Record<string, string> = {
  certification_content_version: "Version marker for the seeded certification curriculum; kept as history.",
  certification_operations_exceptions: "History from the retired certification-operations emails; kept.",
  community_contacts: "Older contact table that predates the current forms; kept.",
  gpt_handoff_sessions: "GPT-to-AVAIA handoff history from the resolved OAuth architecture; kept.",
  guide_access_exceptions: "Cooldown ledger of the retired per-agent email; Needs Dorian replaced the email, the table is kept.",
  guide_candidate_reminders: "History of the retired candidate reminder rules; kept.",
  host_participant_operations_exceptions: "Cooldown ledger of the retired per-agent email; kept.",
  conversation_integrity_reminders: "Cooldown ledger of the retired per-agent email; kept.",
  conversation_integrity_scans: "Scan ledger from the original design; flags are recorded in-request instead; kept.",
  program_authorization_reminders: "Cooldown ledger of the retired per-agent email; kept.",
  toolkit_support_reminders: "Cooldown ledger of the retired per-agent email; kept.",
  pink_foundation_reminders: "Foundation record; the Foundation now has its own database, this copy is kept as history and never read.",
  pink_legacy_review_items: "Foundation record; the Foundation now has its own database, this copy is kept as history and never read.",
  pink_sponsored_access_requests: "Foundation record; the Foundation now has its own database, this copy is kept as history and never read.",
  pink_campaign_items: "Foundation record; the Foundation now has its own database, this copy is kept as history and never read.",
  pink_commercial_co_ventures: "Foundation record; the Foundation now has its own database, this copy is kept as history and never read.",
  pink_volunteers: "Foundation record; the Foundation now has its own database, this copy is kept as history and never read.",
  pink_contact_submissions: "Foundation record; the Foundation now has its own database, this copy is kept as history and never read.",
  pink_participation_interest: "Foundation record; the Foundation now has its own database, this copy is kept as history and never read.",
  pink_partnerships: "Foundation record; the Foundation now has its own database, this copy is kept as history and never read.",
  pink_donor_sponsor_records: "Foundation record; the Foundation now has its own database, this copy is kept as history and never read.",
  pink_partnership_prospects: "AI-found research kept as an archive (docs/pink/); the Foundation now has its own database, this copy is never read.",
  pink_donor_prospects: "AI-found research kept as an archive (docs/pink/); the Foundation now has its own database, this copy is never read.",
};

function row(checkKey: string, label: string, status: CheckStatus, detail: string | null): CheckResult {
  return { category: "quality", checkKey, label, status, detail };
}

function list(names: string[], max = 25): string {
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown}, and ${names.length - max} more` : shown;
}

type DbError = { code?: string; message?: string } | null;

function isMissingTable(error: DbError): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|could not find the table/i.test(error.message ?? "")
  );
}

function isMissingColumn(error: DbError): boolean {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /column .* does not exist|could not find the .* column/i.test(error.message ?? "");
}

async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Database truth
// ---------------------------------------------------------------------------

type SnapshotPolicy = { name: string; cmd: string; qual: string | null; with_check: string | null };
type SnapshotTable = {
  name: string;
  rls: boolean;
  policies: SnapshotPolicy[];
  triggers: string[];
  checks: Record<string, string>;
};
type SchemaSnapshot = { tables: SnapshotTable[]; functions: string[] };

export async function schemaChecks(): Promise<CheckResult[]> {
  const admin = createAdminClient();
  const results: CheckResult[] = [];

  // 1. Tables the code uses. A head-less select with limit(0) returns no rows,
  //    so nothing stored in any table is ever read.
  const tableProbe = await inBatches(EXPECTED_TABLES, 20, async (table) => {
    const { error } = await admin.from(table).select("*").limit(0);
    return { table, missing: isMissingTable(error as DbError), otherError: error && !isMissingTable(error as DbError) ? (error as DbError)?.message : null };
  });
  const missingTables = tableProbe.filter((t) => t.missing).map((t) => t.table);
  results.push(
    missingTables.length === 0
      ? row("schema_tables", "Database tables the app uses all exist", "pass", `All ${EXPECTED_TABLES.length} tables the application code uses are present.`)
      : row(
          "schema_tables",
          "Database tables the app uses all exist",
          "problem",
          `${missingTables.length} table(s) the code depends on are NOT in the database: ${list(missingTables)}. A migration has probably not been applied. (If it was applied moments ago, Supabase may need a moment to refresh its schema.)`
        )
  );

  // 2. Columns the migrations add to existing tables.
  const presentTables = new Set(tableProbe.filter((t) => !t.missing).map((t) => t.table));
  const columnTables = Object.keys(EXPECTED_COLUMNS).filter((t) => presentTables.has(t));
  const missingColumns: string[] = [];
  await inBatches(columnTables, 10, async (table) => {
    const cols = EXPECTED_COLUMNS[table];
    const { error } = await admin.from(table).select(cols.join(",")).limit(0);
    if (!error) return;
    if (isMissingColumn(error as DbError)) {
      for (const col of cols) {
        const { error: one } = await admin.from(table).select(col).limit(0);
        if (one && isMissingColumn(one as DbError)) missingColumns.push(`${table}.${col}`);
      }
    }
  });
  results.push(
    missingColumns.length === 0
      ? row("schema_columns", "Database columns the app relies on all exist", "pass", `All ${Object.values(EXPECTED_COLUMNS).flat().length} columns added by migrations are present.`)
      : row(
          "schema_columns",
          "Database columns the app relies on all exist",
          "problem",
          `${missingColumns.length} column(s) added by a migration are missing: ${list(missingColumns)}. That migration has probably not been applied.`
        )
  );

  // 3. The deeper catalog check (security rules, triggers, constraints,
  //    functions). Needs one read-only database function from migration
  //    0111; if it is not installed yet this says so plainly instead of failing.
  const { data: snapRaw, error: snapError } = await admin.rpc("avaia_schema_snapshot");
  if (snapError || !snapRaw) {
    const notInstalled = /could not find the function|does not exist|PGRST202/i.test(`${(snapError as DbError)?.code ?? ""} ${(snapError as DbError)?.message ?? ""}`);
    results.push(
      row(
        "schema_catalog",
        "Deeper database check (security rules, triggers, functions)",
        "needs_dorian",
        notInstalled
          ? "Not installed yet. Run migration 0111_system_truth.sql (one read-only function, no data touched) to turn on checks for row-level security, protective rules and database functions."
          : `Could not run: ${(snapError as DbError)?.message ?? "no result"}.`
      )
    );
    return results;
  }
  const snapshot = snapRaw as SchemaSnapshot;
  const byName = new Map(snapshot.tables.map((t) => [t.name, t]));

  // 3a. Row-level security must be ON for every table the app uses. This is
  //     what keeps one person's records from being readable by another.
  const noRls = EXPECTED_TABLES.filter((t) => byName.has(t) && byName.get(t)!.rls === false);
  results.push(
    noRls.length === 0
      ? row("schema_rls", "Row-level security is on for every table", "pass", "Every table the app uses has row-level security enabled.")
      : row("schema_rls", "Row-level security is on for every table", "problem", `Row-level security is OFF on: ${list(noRls)}. Without it, the database's own privacy protection does not apply to these tables.`)
  );

  // 3b. Database functions the code calls.
  const have = new Set(snapshot.functions);
  const missingFns = EXPECTED_RPCS.filter((f) => !have.has(f));
  results.push(
    missingFns.length === 0
      ? row("schema_functions", "Database functions the app calls all exist", "pass", `All ${EXPECTED_RPCS.length} database functions the code calls are present.`)
      : row("schema_functions", "Database functions the app calls all exist", "problem", `Missing database function(s): ${list(missingFns)}.`)
  );

  // 3b-2. Tables that exist but no code uses. A table with no application code
  //       is what a migration applied without its code looks like; the only ones
  //       allowed are those deliberately preserved and documented above.
  const used = new Set<string>(EXPECTED_TABLES);
  const orphans = snapshot.tables.map((t) => t.name).filter((n) => !used.has(n) && !PRESERVED_UNUSED_TABLES[n]);
  const preservedPresent = snapshot.tables.map((t) => t.name).filter((n) => !used.has(n) && PRESERVED_UNUSED_TABLES[n]);
  results.push(
    orphans.length === 0
      ? row(
          "schema_orphan_tables",
          "Every database table is either used by the app or deliberately preserved",
          "pass",
          `No unexplained tables. ${preservedPresent.length} table(s) are intentionally kept without application code (history and the Foundation's old records); none are ever dropped.`
        )
      : row(
          "schema_orphan_tables",
          "Every database table is either used by the app or deliberately preserved",
          "problem",
          `${orphans.length} table(s) exist in the database but no application code uses them and they are not on the preserved list: ${list(orphans)}. A migration was probably applied without its application code.`
        )
  );

  // 3c. A short list of rules that must hold, each one something a past or
  //     present AVAIA decision depends on.
  const failures: string[] = [];
  const need = (table: string): SnapshotTable | null => {
    const t = byName.get(table);
    if (!t) {
      failures.push(`${table} is missing`);
      return null;
    }
    return t;
  };

  const certs = need("guide_certifications");
  if (certs) {
    for (const trg of ["guide_certifications_guard_reactivation", "guide_certifications_set_cycle"]) {
      if (!certs.triggers.includes(trg)) failures.push(`guide_certifications is missing the protective rule "${trg}" (the 60-month and renewal-cycle rules)`);
    }
    if (!(certs.checks["guide_certifications_standing_check"] ?? "").includes("inactive")) {
      failures.push(`guide_certifications does not accept the "inactive" standing`);
    }
  }

  const cronRuns = need("cron_runs");
  if (cronRuns) {
    const def = cronRuns.checks["cron_runs_cron_name_check"] ?? "";
    const notAllowed = RECORDED_CRON_NAMES.filter((n) => !def.includes(`'${n}'`));
    if (notAllowed.length > 0) failures.push(`cron_runs does not yet accept: ${notAllowed.join(", ")} (their runs cannot be recorded)`);
  }

  const reflections = need("certification_candidate_reflections");
  if (reflections) {
    if (reflections.policies.length === 0) failures.push(`certification_candidate_reflections has no access policy`);
    const adminPolicy = reflections.policies.find((p) => /admin/i.test(`${p.name} ${p.qual ?? ""} ${p.with_check ?? ""}`));
    if (adminPolicy) failures.push(`certification_candidate_reflections has an admin-access policy ("${adminPolicy.name}"); candidate reflections are meant to be private to the candidate`);
  }

  // Guide certification (migration 0116). Practice with an AI Host belongs to the candidate (no
  // admin policy, like reflections). The human evaluation records are admin-only: no policy may
  // let anyone but an admin read them (a candidate hears outcomes from a person). The evidence
  // vocabulary and the entitlement sources accept what the certification path writes.
  for (const table of ["certification_practice_sessions", "certification_practice_messages"]) {
    const t = need(table);
    if (!t) continue;
    if (t.policies.length === 0) failures.push(`${table} has no access policy`);
    const adminPolicy = t.policies.find((p) => /admin/i.test(`${p.name} ${p.qual ?? ""} ${p.with_check ?? ""}`));
    if (adminPolicy) failures.push(`${table} has an admin-access policy ("${adminPolicy.name}"); AI Host practice is meant to be private to the candidate`);
  }
  for (const table of ["certification_gate_evaluations", "certification_lab_evaluations", "certification_practicum_evaluations"]) {
    const t = need(table);
    if (!t) continue;
    if (t.policies.length === 0) failures.push(`${table} has no access policy`);
    const open = t.policies.find((p) => !/admin/i.test(`${p.name} ${p.qual ?? ""} ${p.with_check ?? ""}`) || /host_id\s*=\s*auth\.uid\(\)/.test(`${p.qual ?? ""}`));
    if (open) failures.push(`${table} has a policy ("${open.name}") that is not admin-only; human evaluation records must not be readable by candidates`);
  }
  const evidenceTable = need("guide_candidate_evidence");
  if (evidenceTable && !(evidenceTable.checks["guide_candidate_evidence_evidence_type_check"] ?? "").includes("host_seat_experience")) {
    failures.push(`guide_candidate_evidence does not accept 'host_seat_experience' (migration 0116): the Host-seat experience cannot be recorded`);
  }
  const entitlementsTable = need("entitlements");
  if (entitlementsTable && !(entitlementsTable.checks["entitlements_source_check"] ?? "").includes("candidacy")) {
    failures.push(`entitlements does not accept the 'candidacy' source (migration 0116): admitting a candidate cannot open their access`);
  }
  const applicationsTable = need("certification_applications");
  if (applicationsTable) {
    const hasAdmin = applicationsTable.policies.some((p) => /admin/i.test(`${p.name} ${p.qual ?? ""}`));
    if (!hasAdmin) failures.push(`certification_applications has no admin policy: admission decisions cannot be recorded`);
  }

  // Keep this (migration 0117). Kept items belong to the Host alone: every policy on them is the
  // Host's own (no Guide, admin or operational policy may exist), a Host cannot forge a
  // "from a Guide" item from a browser, and what was kept cannot be rewritten. A Guide's offer is a
  // pointer a Guide can create and withdraw but never update, and the Guide can see it only while it
  // is waiting. A Guide must have no write policy on a participant's Virtue Signature.
  const kept = need("kept_items");
  if (kept) {
    if (kept.policies.length === 0) failures.push(`kept_items has no access policy`);
    const reachable = kept.policies.find((p) => /admin|guide|participant|profiles/i.test(`${p.name} ${p.qual ?? ""}`));
    if (reachable) failures.push(`kept_items has a policy ("${reachable.name}") that reaches beyond the Host; kept items belong to the Host alone`);
    const notOwn = kept.policies.find((p) => !/host_id\s*=\s*auth\.uid\(\)/.test(`${p.qual ?? ""} ${p.with_check ?? ""}`));
    if (notOwn) failures.push(`kept_items has a policy ("${notOwn.name}") that is not the Host's own`);
    const insert = kept.policies.find((p) => p.name === "kept items own insert");
    if (!insert || !/guide_offer/.test(`${insert.with_check ?? ""}`)) failures.push(`kept_items lets a Host insert a row claiming to have come through a Guide, so provenance could be forged`);
    if (!kept.triggers.includes("kept_items_protect_content")) failures.push(`kept_items is missing the protective rule "kept_items_protect_content": what was kept could be rewritten`);
  }
  // Coordination (migration 0120, Decision 0008). Coordination items belong to the Host alone:
  // every policy is the Host's own, there is no delete policy (a Host closes an item), writes are
  // limited to adult accounts, and the guard trigger keeps the owner and identity fixed. polcmd:
  // 'r' read, 'a' insert, 'w' update, 'd' delete, '*' all.
  const coordination = need("coordination_items");
  if (coordination) {
    if (coordination.policies.length === 0) failures.push(`coordination_items has no access policy`);
    const wide = coordination.policies.find((p) => p.cmd === "d" || p.cmd === "*");
    if (wide) failures.push(`coordination_items has a delete or all-commands policy ("${wide.name}"); Phase 1 has no Host delete`);
    const notOwn = coordination.policies.find((p) => !/host_id\s*=\s*auth\.uid\(\)/.test(`${p.qual ?? ""} ${p.with_check ?? ""}`));
    if (notOwn) failures.push(`coordination_items has a policy ("${notOwn.name}") that is not the Host's own`);
    const reachable = coordination.policies.find((p) => /admin|guide/i.test(`${p.name} ${p.qual ?? ""}`));
    if (reachable) failures.push(`coordination_items has a policy ("${reachable.name}") that reaches beyond the Host; coordination items belong to the Host alone`);
    const writes = coordination.policies.filter((p) => p.cmd === "a" || p.cmd === "w");
    if (writes.length !== 2 || writes.some((p) => !/developmental_band/.test(`${p.with_check ?? ""}`))) {
      failures.push(`coordination_items does not limit writes to adult accounts, so a Youth profile could create or change one`);
    }
    if (!coordination.triggers.includes("coordination_items_guard")) failures.push(`coordination_items is missing the protective rule "coordination_items_guard": an item's owner could be changed`);
  }
  // The Decision & Capacity Continuity Record (migration 0121, Decision 0008). Entries belong to the
  // Host alone. Withdraw, never erase: no delete policy. A Host's browser may insert only a Host
  // note; every copied source is written by the server and re-verified by the database, so verbatim
  // text cannot be forged from a browser. An entry is never rewritten (only withdrawn or restored),
  // and writes are limited to adult accounts.
  const continuity = need("coordination_entries");
  if (continuity) {
    if (continuity.policies.length === 0) failures.push(`coordination_entries has no access policy`);
    const wide = continuity.policies.find((p) => p.cmd === "d" || p.cmd === "*");
    if (wide) failures.push(`coordination_entries has a delete or all-commands policy ("${wide.name}"); the record is withdraw, never erase`);
    const notOwn = continuity.policies.find((p) => !/host_id\s*=\s*auth\.uid\(\)/.test(`${p.qual ?? ""} ${p.with_check ?? ""}`));
    if (notOwn) failures.push(`coordination_entries has a policy ("${notOwn.name}") that is not the Host's own`);
    const reachable = continuity.policies.find((p) => /admin|guide/i.test(`${p.name} ${p.qual ?? ""}`));
    if (reachable) failures.push(`coordination_entries has a policy ("${reachable.name}") that reaches beyond the Host; the record belongs to the Host alone`);
    const insert = continuity.policies.find((p) => p.cmd === "a");
    if (!insert || !/source_kind\s*=\s*'host_note'/.test(`${insert.with_check ?? ""}`)) {
      failures.push(`coordination_entries lets a Host's browser insert a copied source, so verbatim text could be forged`);
    }
    const continuityWrites = continuity.policies.filter((p) => p.cmd === "a" || p.cmd === "w");
    if (continuityWrites.length !== 2 || continuityWrites.some((p) => !/developmental_band/.test(`${p.with_check ?? ""}`))) {
      failures.push(`coordination_entries does not limit writes to adult accounts`);
    }
    for (const trigger of ["coordination_entries_check_insert", "coordination_entries_guard"]) {
      if (!continuity.triggers.includes(trigger)) failures.push(`coordination_entries is missing the protective rule "${trigger}": entries could be forged or rewritten`);
    }
  }
  // Share With + professional handoff (migration 0122, Decision 0010). A share is a frozen, Host-authorized
  // copy. The Host can read their own and revoke them; they can never create one directly (so verbatim
  // content cannot be forged from a browser), and no one can delete one. Recipients have no table access at
  // all: they reach data only through the two narrow token functions. The trigger that verifies content
  // against the real entries, and the guard that keeps a sent copy unchanged, must both be present.
  // polcmd: 'r' read, 'a' insert, 'w' update, 'd' delete, '*' all.
  const sharesTable = need("coordination_shares");
  if (sharesTable) {
    if (sharesTable.policies.length === 0) failures.push(`coordination_shares has no access policy`);
    const sharesBad = sharesTable.policies.find((p) => p.cmd === "a" || p.cmd === "d" || p.cmd === "*");
    if (sharesBad) failures.push(`coordination_shares has an insert, delete or all-commands policy ("${sharesBad.name}"); only the server may create a share and none may be deleted`);
    const sharesNotOwn = sharesTable.policies.find((p) => !/host_id\s*=\s*auth\.uid\(\)/.test(`${p.qual ?? ""} ${p.with_check ?? ""}`));
    if (sharesNotOwn) failures.push(`coordination_shares has a policy ("${sharesNotOwn.name}") that is not the Host's own`);
    const sharesReach = sharesTable.policies.find((p) => /admin|guide|anon|public/i.test(`${p.name} ${p.qual ?? ""}`));
    if (sharesReach) failures.push(`coordination_shares has a policy ("${sharesReach.name}") that reaches beyond the Host; recipients must use only the token functions`);
    for (const trigger of ["coordination_shares_check_insert", "coordination_shares_guard"]) {
      if (!sharesTable.triggers.includes(trigger)) failures.push(`coordination_shares is missing the protective rule "${trigger}": a share could be forged or changed after it was sent`);
    }
  }
  for (const fn of ["peek_handoff", "open_handoff"]) {
    if (!have.has(fn)) failures.push(`the recipient function ${fn} is missing (migration 0122): a shared link cannot be opened`);
  }
  // Guide Coordination (migrations 0123 and 0124, Decision 0011). A Host gives one eligible Guide a time-limited,
  // revocable window onto what the Host ticks. The three tables have no delete policy and no admin path of any
  // kind; every policy is tied to the signed-in Host or Guide; the Guide has NO policy on the Host's items,
  // entries or shares (covered by the three rules above) and no policy at all on the scope table, reading only
  // through the narrow functions; and each table's guard keeps a record from being edited. polcmd: 'r' read,
  // 'a' insert, 'w' update, 'd' delete, '*' all.
  const guideTables: { table: string; triggers: string[]; noGuidePolicy?: boolean }[] = [
    { table: "coordination_guide_grants", triggers: ["coordination_guide_grants_check_insert", "coordination_guide_grants_guard"] },
    {
      table: "coordination_guide_scope",
      triggers: ["coordination_guide_scope_check_insert", "coordination_guide_scope_guard", "coordination_guide_scope_after_remove"],
      noGuidePolicy: true,
    },
    { table: "coordination_guide_events", triggers: ["coordination_guide_events_check_insert", "coordination_guide_events_guard"] },
  ];
  for (const g of guideTables) {
    const t = need(g.table);
    if (!t) continue;
    if (t.policies.length === 0) failures.push(`${g.table} has no access policy`);
    const wide = t.policies.find((p) => p.cmd === "d" || p.cmd === "*");
    if (wide) failures.push(`${g.table} has a delete or all-commands policy ("${wide.name}"); nothing is ever deleted`);
    const admin = t.policies.find((p) => /admin/i.test(`${p.name} ${p.qual ?? ""} ${p.with_check ?? ""}`));
    if (admin) failures.push(`${g.table} has an administrator policy ("${admin.name}"); admins have no path to a Host's Guide access, scope or records`);
    const notSignedIn = t.policies.find((p) => !/auth\.uid\(\)/.test(`${p.qual ?? ""} ${p.with_check ?? ""}`));
    if (notSignedIn) failures.push(`${g.table} has a policy ("${notSignedIn.name}") that is not tied to the signed-in user`);
    if (g.noGuidePolicy) {
      const guideRead = t.policies.find((p) => !/host_id\s*=\s*auth\.uid\(\)/.test(`${p.qual ?? ""} ${p.with_check ?? ""}`));
      if (guideRead) failures.push(`${g.table} has a policy ("${guideRead.name}") that is not the Host's own; a Guide must learn their scope only through the view function`);
    }
    for (const trigger of g.triggers) {
      if (!t.triggers.includes(trigger)) failures.push(`${g.table} is missing the protective rule "${trigger}": a grant, a choice or a Guide's record could be forged or edited`);
    }
  }
  for (const fn of [
    "coordination_guide_is_eligible",
    "coordination_guide_grant_active",
    "coordination_guide_item_in_scope",
    "list_eligible_coordination_guides",
    "guide_coordination_hosts",
    "guide_coordination_host_view",
  ]) {
    if (!have.has(fn)) failures.push(`the Guide coordination function ${fn} is missing (migration 0123): a Guide's view or a Host's choice of Guide cannot work`);
  }
  // The contact form's reasons (migration 0125): the check on contact_submissions.reason must accept the two
  // professional-referral and organization reasons, or those submissions are refused by the database.
  const contactTable = need("contact_submissions");
  if (contactTable) {
    const reasonCheck = contactTable.checks["contact_submissions_reason_check"] ?? "";
    const missingReasons = ["professional_referral", "organization"].filter((v) => !reasonCheck.includes(`'${v}'`));
    if (missingReasons.length > 0) {
      failures.push(`contact_submissions does not yet accept the contact reason(s) ${missingReasons.join(", ")} (migration 0125): those submissions would be refused`);
    }
  }
  const offers = need("guide_item_offers");
  if (offers) {
    // polcmd: 'w' is update and '*' is all; neither may exist for a Guide on an offer.
    if (offers.policies.some((p) => p.cmd === "w" || p.cmd === "*")) failures.push(`guide_item_offers has an update policy; only the Host's verified action may move an offer on`);
    const read = offers.policies.find((p) => p.cmd === "r");
    const readText = `${read?.qual ?? ""}`;
    if (!read || !readText.includes("offered") || !readText.includes("confirmed") || readText.includes("kept") || readText.includes("declined")) {
      failures.push(`guide_item_offers' Guide read rule does not limit a Guide to offers that are still waiting, so a Guide could learn what a Host decided`);
    }
    const notGuideOwned = offers.policies.find((p) => !/guide_id\s*=\s*auth\.uid\(\)/.test(`${p.qual ?? ""} ${p.with_check ?? ""}`));
    if (notGuideOwned) failures.push(`guide_item_offers has a policy ("${notGuideOwned.name}") that is not the offering Guide's own`);
  }
  const signatureTable = need("virtue_signature_entries");
  if (signatureTable && signatureTable.policies.some((p) => p.name === "virtue signature guide write")) {
    failures.push(`virtue_signature_entries still lets a Guide write into a participant's Virtue Signature (migration 0117 removes it)`);
  }

  // A person must not be able to grant themselves authority by editing their own
  // profile (migration 0112). The rule that stops it is a trigger on profiles.
  // Guide access to the Library follows certification and Toolkit authorization (migration
  // 0115), never the profile role label: a 'guide' role without certification must not read
  // it, and a certified Guide must not need the label.
  const libraryEntries = need("library_entries");
  if (libraryEntries) {
    const guideRead = libraryEntries.policies.find((p) => p.name === "library entries guide read");
    const text = `${guideRead?.qual ?? ""}`;
    if (!guideRead) failures.push(`library_entries has no Guide read rule, so certified Guides cannot read the Library`);
    else if (/role\s*=\s*'guide'/.test(text) || !text.includes("guide_certifications")) {
      failures.push(`library_entries' Guide read rule depends on the profile role label instead of certification and Toolkit authorization (migration 0115)`);
    }
  }

  const profilesTable = need("profiles");
  if (profilesTable && !profilesTable.triggers.includes("profiles_protect_authority")) {
    failures.push(`profiles is missing the protective rule "profiles_protect_authority" (migration 0112): without it a signed-in person can change their own role`);
  }

  results.push(
    failures.length === 0
      ? row("schema_rules", "Protective database rules are in place", "pass", "Renewal and 60-month rules, the scheduled-job-name rule, candidate-reflection and AI-practice privacy, the Host-only privacy of kept items and the Guide-offer rules, admin-only human evaluation records, the certification evidence and candidacy-access rules, the rule that stops anyone from editing their own role, and Guide access to the Library by certification are all as designed.")
      : row("schema_rules", "Protective database rules are in place", "problem", failures.join("; ") + ".")
  );

  return results;
}

// ---------------------------------------------------------------------------
// Scheduled jobs
// ---------------------------------------------------------------------------

export async function scheduleChecks(): Promise<CheckResult[]> {
  const items = await getCronHealth();
  const bad = items.filter((i) => i.state !== "ok" && i.state !== "not_recorded_yet");
  const waiting = items.filter((i) => i.state === "not_recorded_yet").map((i) => i.name);
  const ok = items.filter((i) => i.state === "ok").length;

  if (bad.length === 0) {
    return [
      row(
        "schedule_jobs",
        "Scheduled jobs are running",
        "pass",
        `${ok} job(s) have run on schedule${waiting.length ? `; ${waiting.length} waiting for their first recorded run (${list(waiting)})` : ""}.`
      ),
    ];
  }
  const worst: CheckStatus = bad.every((b) => b.state === "partial") ? "needs_dorian" : "problem";
  return [row("schedule_jobs", "Scheduled jobs are running", worst, bad.map((b) => b.detail).join(" "))];
}

// ---------------------------------------------------------------------------
// Deployment truth
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Unreleased work on other branches
// ---------------------------------------------------------------------------

type GithubBranch = { name: string; commit: { sha: string } };
type GithubCompare = { ahead_by?: number; commits?: { commit?: { committer?: { date?: string } } }[] };

async function githubJson<T>(path: string): Promise<{ ok: true; body: T } | { ok: false; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}${path}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "avaia-system-checks" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, body: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

/** Two safeguards in one: (1) GitHub's default branch must be the production
 *  branch, because tools that write to "the default branch" would otherwise
 *  write work that never goes live; (2) no other branch may be sitting on recent
 *  work production does not have. */
export async function branchChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const defaultLabel = "GitHub's default branch is the production branch";
  const strayLabel = "No unreleased work is sitting on another branch";

  const repo = await githubJson<{ default_branch?: string }>("");
  if (!repo.ok) {
    results.push(row("deploy_default_branch", defaultLabel, "pass", `Could not read GitHub (HTTP ${repo.status || "no response"}); this comparison is skipped, not failed.`));
  } else if (repo.body.default_branch && repo.body.default_branch !== PRODUCTION_BRANCH) {
    results.push(
      row(
        "deploy_default_branch",
        defaultLabel,
        "needs_dorian",
        `GitHub's default branch is "${repo.body.default_branch}", but production is built from "${PRODUCTION_BRANCH}". Any tool or person that writes to the default branch writes work that will never go live. In GitHub: Settings, Branches, Default branch, switch to ${PRODUCTION_BRANCH}.`
      )
    );
  } else {
    results.push(row("deploy_default_branch", defaultLabel, "pass", `The default branch is ${PRODUCTION_BRANCH}, the same branch production is built from.`));
  }

  const branches = await githubJson<GithubBranch[]>("/branches?per_page=100");
  if (!branches.ok) {
    results.push(row("deploy_stray_work", strayLabel, "pass", `Could not read GitHub (HTTP ${branches.status || "no response"}); this comparison is skipped, not failed.`));
    return results;
  }

  const others = branches.body.filter((b) => b.name !== PRODUCTION_BRANCH && ARCHIVED_BRANCH_TIPS[b.name] !== b.commit.sha).slice(0, 40);
  const stray: string[] = [];
  let unreadable = 0;
  await inBatches(others, 5, async (b) => {
    const cmp = await githubJson<GithubCompare>(`/compare/${encodeURIComponent(PRODUCTION_BRANCH)}...${encodeURIComponent(b.name)}`);
    if (!cmp.ok) {
      unreadable += 1;
      return;
    }
    const ahead = cmp.body.ahead_by ?? 0;
    if (ahead === 0) return;
    const commits = cmp.body.commits ?? [];
    const last = commits[commits.length - 1]?.commit?.committer?.date;
    const ageMs = last ? Date.now() - new Date(last).getTime() : 0;
    // Pushed minutes ago: probably a preview build in flight, not stray work.
    if (ageMs < 20 * 60_000) return;
    if (ageMs > STRAY_BRANCH_RECENT_DAYS * 86_400_000) return;
    stray.push(`${b.name} (${ahead} commit(s) production does not have, newest ${Math.round(ageMs / 86_400_000)} day(s) ago)`);
  });

  if (stray.length > 0) {
    results.push(
      row(
        "deploy_stray_work",
        strayLabel,
        "problem",
        `Recent work exists on a branch that is not production, so it is not live: ${list(stray)}. Port it into ${PRODUCTION_BRANCH} (or archive the branch) so it cannot be mistaken for finished work.`
      )
    );
  } else {
    results.push(
      row(
        "deploy_stray_work",
        strayLabel,
        "pass",
        `${others.length - unreadable} other branch(es) checked; none has recent work that production lacks${unreadable ? ` (${unreadable} could not be read)` : ""}.`
      )
    );
  }
  return results;
}

export async function deploymentChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Is production serving the latest commit of the production branch?
  const env = process.env.VERCEL_ENV;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const ref = process.env.VERCEL_GIT_COMMIT_REF;
  const label = "Production is running the latest pushed version";

  if (env && env !== "production") {
    results.push(row("deploy_matches_branch", label, "pass", `This is a ${env} deployment, so the production comparison was skipped.`));
  } else if (!sha || !ref) {
    results.push(
      row("deploy_matches_branch", label, "needs_dorian", "This deployment does not report which commit it was built from, so it cannot be compared to GitHub. (In Vercel: Project Settings, Environment Variables, enable \"Automatically expose System Environment Variables\".)")
    );
  } else if (ref !== PRODUCTION_BRANCH) {
    results.push(
      row("deploy_matches_branch", label, "problem", `Production was built from the branch "${ref}", but AVAIA's production branch is "${PRODUCTION_BRANCH}". Work pushed to ${PRODUCTION_BRANCH} will not go live. Check Vercel, Project Settings, Git, Production Branch.`)
    );
  } else {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits/${PRODUCTION_BRANCH}`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "avaia-system-checks" },
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      if (!res.ok) {
        results.push(row("deploy_matches_branch", label, "pass", `Could not read GitHub (HTTP ${res.status}); this comparison is skipped, not failed.`));
      } else {
        const body = (await res.json()) as { sha?: string; commit?: { committer?: { date?: string } } };
        const head = body.sha ?? "";
        const pushedAt = body.commit?.committer?.date ? new Date(body.commit.committer.date).getTime() : null;
        if (head && head === sha) {
          results.push(row("deploy_matches_branch", label, "pass", `Running ${sha.slice(0, 7)}, the latest commit of ${PRODUCTION_BRANCH}.`));
        } else if (pushedAt !== null && Date.now() - pushedAt < 20 * 60_000) {
          results.push(row("deploy_matches_branch", label, "pass", `A newer commit (${head.slice(0, 7)}) was pushed minutes ago; its deployment is probably still building.`));
        } else {
          const hours = pushedAt ? Math.round((Date.now() - pushedAt) / 3_600_000) : null;
          results.push(
            row(
              "deploy_matches_branch",
              label,
              "problem",
              `Production is running ${sha.slice(0, 7)} but ${PRODUCTION_BRANCH} is at ${head.slice(0, 7)}${hours !== null ? ` (pushed about ${hours} hour(s) ago)` : ""}. The latest push did not go live. Look for a failed build in Vercel.`
            )
          );
        }
      }
    } catch (e) {
      results.push(row("deploy_matches_branch", label, "pass", `Could not reach GitHub (${e instanceof Error ? e.message : "error"}); this comparison is skipped, not failed.`));
    }
  }

  // Is the deployment configured: database reachable, required settings present?
  try {
    const res = await fetch(`${SITE}/api/health`, { cache: "no-store" });
    const body = (await res.json()) as { ok?: boolean; database?: string; databaseError?: string | null; missingEnvVars?: string[] };
    if (body.ok) {
      results.push(row("deploy_health", "Production is configured and the database is reachable", "pass", "Required settings are present and the database responds."));
    } else {
      const parts: string[] = [];
      if (body.database && body.database !== "reachable") parts.push(`the database is ${body.database}${body.databaseError ? ` (${body.databaseError})` : ""}`);
      if (body.missingEnvVars?.length) parts.push(`required setting(s) missing: ${body.missingEnvVars.join(", ")}`);
      results.push(row("deploy_health", "Production is configured and the database is reachable", "problem", parts.join("; ") || `The health endpoint reported a problem (HTTP ${res.status}).`));
    }
  } catch (e) {
    results.push(row("deploy_health", "Production is configured and the database is reachable", "needs_dorian", `The health endpoint could not be read (${e instanceof Error ? e.message : "error"}).`));
  }

  results.push(...(await branchChecks()));
  return results;
}
