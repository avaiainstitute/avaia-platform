import "server-only";
import {
  INQUIRY_SOURCES_BY_SCOPE,
  PROSPECT_LISTS_BY_SCOPE,
  PROSPECT_TABLE_BY_VERTICAL,
  RESEARCH_RUNNABLE_BY_SCOPE,
  SCHEDULED_RESEARCH_VERTICALS,
} from "@/lib/admin-scope";
import { STOPPED_VERTICALS, runProspectResearch } from "@/lib/research/prospect-research";
import {
  pinkContactAcknowledgmentEmailHtml,
  pinkContactNotificationEmailHtml,
  pinkDailySummaryEmailHtml,
  pinkParticipationAcknowledgmentEmailHtml,
  pinkParticipationNotificationEmailHtml,
} from "@/lib/pink/emails";
import { pinkEmailIdentityIsIndependent, pinkFromHeader } from "@/lib/pink/mail";
import { honeypotTripped, overLimit } from "@/lib/pink/abuse";
import type { CheckResult } from "@/lib/ops/system-checks";

// SELF-TESTS FOR THE PINK SHOELACE FOUNDATION / AVAIA BOUNDARY (Founder directive, 2026-10-05).
// Simulated inputs only: nothing is read from or written to the database, and nothing is sent.
// They protect what was decided so that a later change cannot quietly cross the line again:
//
//   * AVAIA's admin lists and research touch no Foundation (pink_*) table;
//   * the Foundation's admin touches no AVAIA research or participant table;
//   * the scheduled research job runs AVAIA's own business development only, into AVAIA's tables;
//   * the mixed-organization "partnership" research cannot run;
//   * a Foundation email never goes out under AVAIA's name and makes no promise of a person or a time;
//   * the spam protection behaves.
//
// The other half of the proof is a build-time guard (scripts/pink-isolation.sh), which fails the
// build if any AVAIA file reads a Foundation table or imports Foundation code. This file's check
// covers behavior; that guard covers the source.
//
// What these checks do NOT prove: that the two organizations have independent databases,
// credentials, deployments, admin logins or backups. They do not yet; the Pink system check
// "pink_separation_status" states the remaining shared infrastructure plainly.

type Case = { name: string; ok: boolean };

function result(key: string, label: string, passDetail: string, cases: Case[]): CheckResult {
  const failed = cases.filter((c) => !c.ok).map((c) => c.name);
  return failed.length === 0
    ? { category: "quality", checkKey: key, label, status: "pass", detail: passDetail }
    : { category: "quality", checkKey: key, label, status: "problem", detail: `${failed.length} case(s) broke: ${failed.join("; ")}.` };
}

const isPinkTable = (t: string) => t.startsWith("pink_");

async function pinkBoundaryCheck(): Promise<CheckResult> {
  const key = "pipeline_pink_separation";
  const label = "Pink Shoelace Foundation and AVAIA stay on their own sides";
  try {
    const cases: Case[] = [];

    // AVAIA's admin touches no Foundation table.
    cases.push({ name: "AVAIA's admin reads a Foundation inquiry table", ok: !INQUIRY_SOURCES_BY_SCOPE.avaia.some(isPinkTable) });
    cases.push({ name: "AVAIA's admin lists a Foundation prospect table", ok: !PROSPECT_LISTS_BY_SCOPE.avaia.some((v) => isPinkTable(PROSPECT_TABLE_BY_VERTICAL[v])) });
    cases.push({ name: "AVAIA's admin can run research into a Foundation table", ok: !RESEARCH_RUNNABLE_BY_SCOPE.avaia.some((v) => isPinkTable(PROSPECT_TABLE_BY_VERTICAL[v])) });

    // The Foundation's admin touches no AVAIA research or participant table.
    cases.push({ name: "the Foundation's admin reads an AVAIA inquiry table", ok: INQUIRY_SOURCES_BY_SCOPE.pink.every(isPinkTable) });
    cases.push({ name: "the Foundation's admin lists an AVAIA prospect table", ok: PROSPECT_LISTS_BY_SCOPE.pink.every((v) => isPinkTable(PROSPECT_TABLE_BY_VERTICAL[v])) });

    // The scheduled research job is AVAIA's own, into AVAIA's tables, and the mixed one cannot run.
    cases.push({ name: "the scheduled research writes into a Foundation table", ok: SCHEDULED_RESEARCH_VERTICALS.every((v) => !isPinkTable(PROSPECT_TABLE_BY_VERTICAL[v])) });
    cases.push({ name: "the scheduled research includes the stopped mixed research", ok: !SCHEDULED_RESEARCH_VERTICALS.some((v) => STOPPED_VERTICALS.includes(v)) });
    cases.push({ name: "the mixed 'partnership' research is not marked stopped", ok: STOPPED_VERTICALS.includes("partnership") });
    let refused = false;
    try {
      await runProspectResearch("partnership", 1);
    } catch {
      refused = true;
    }
    cases.push({ name: "the mixed 'partnership' research could still be run", ok: refused });

    // Foundation email: its own name, and no promise of a person or a time.
    cases.push({ name: "a Foundation email goes out under AVAIA's name", ok: !/avaia/i.test(pinkFromHeader({}).split("<")[0]) && pinkFromHeader({}).startsWith("The Pink Shoelace Foundation <") });
    cases.push({ name: "the configured Foundation sender was ignored", ok: pinkFromHeader({ PINK_FROM_EMAIL: "hello@thepinkshoelace.org" }) === "The Pink Shoelace Foundation <hello@thepinkshoelace.org>" });
    cases.push({ name: "AVAIA's domain counted as the Foundation's own sender", ok: !pinkEmailIdentityIsIndependent({}) && !pinkEmailIdentityIsIndependent({ PINK_FROM_EMAIL: "x@avaiainstitute.com" }) && pinkEmailIdentityIsIndependent({ PINK_FROM_EMAIL: "hello@thepinkshoelace.org" }) });
    const bodies = [
      pinkContactAcknowledgmentEmailHtml({ name: "Dana" }),
      ...["wear_shoelace", "walk_alongside", "honor_someone", "foundation_participation", "other"].map((t) => pinkParticipationAcknowledgmentEmailHtml({ name: "Dana", interestType: t })),
      pinkContactNotificationEmailHtml({ name: "Dana", email: "d@example.com", category: "general", message: "hello" }),
      pinkParticipationNotificationEmailHtml({ name: "Dana", email: "d@example.com", interestType: "other", note: null, honoreeName: null }),
      pinkDailySummaryEmailHtml({ dateLabel: "today", whatHappened: [], needs: [], opportunities: [] }),
    ];
    cases.push({ name: "a Foundation email names AVAIA", ok: bodies.every((b) => !/avaia/i.test(b)) });
    const acks = [pinkContactAcknowledgmentEmailHtml({ name: "Dana" }), pinkParticipationAcknowledgmentEmailHtml({ name: "Dana", interestType: "other" })];
    cases.push({ name: "an acknowledgment promises a person, a follow-up or a time", ok: acks.every((b) => !/follow\s*up|personally|dorian|as soon as|within|will be in touch|will respond|will reply/i.test(b)) });

    // Spam protection.
    cases.push({ name: "the hidden spam-trap field was ignored", ok: honeypotTripped({ website: "http://spam" }) && !honeypotTripped({ website: "" }) && !honeypotTripped({}) });
    cases.push({ name: "the hourly limits do not hold", ok: overLimit(3, 0) && overLimit(0, 60) && !overLimit(2, 59) });

    return result(
      key,
      label,
      "Simulated inputs confirm: AVAIA's admin touches no Foundation table and the Foundation's touches no AVAIA research or participant table; the scheduled research is AVAIA's own and writes only into AVAIA's tables; the mixed-organization research cannot run; Foundation emails go out under the Foundation's name, name no AVAIA and promise no person or time; and the spam protection behaves. (A build-time guard separately fails any build in which an AVAIA file reads a Foundation table.)",
      cases
    );
  } catch (e) {
    return { category: "quality", checkKey: key, label, status: "problem", detail: `The self-test could not run: ${e instanceof Error ? e.message : String(e)}.` };
  }
}

/** The Foundation's email identity, from the deployment's real settings. */
function emailIdentityCheck(): CheckResult {
  const independent = pinkEmailIdentityIsIndependent();
  return independent
    ? { category: "quality", checkKey: "pink_email_identity", label: "Foundation email goes out from the Foundation's own address", status: "pass", detail: "PINK_FROM_EMAIL is set to an address that is not on AVAIA's domain." }
    : {
        category: "quality",
        checkKey: "pink_email_identity",
        label: "Foundation email goes out from the Foundation's own address",
        status: "needs_dorian",
        detail:
          "Foundation emails say \"The Pink Shoelace Foundation\" but are still sent from AVAIA's domain (noreply@avaiainstitute.com) through AVAIA's email account. Not yet separate: the Foundation's own sending address (PINK_FROM_EMAIL) and, ideally, its own email account (PINK_RESEND_API_KEY) have not been set up.",
      };
}

/** What is still shared, stated from the deployment's real settings so it cannot drift. */
function separationStatusCheck(): CheckResult {
  const own = {
    database: !!process.env.PINK_SUPABASE_URL,
    email: pinkEmailIdentityIsIndependent(),
  };
  const remaining: string[] = [];
  if (!own.database) remaining.push("the database (same Supabase project and service key as AVAIA)");
  remaining.push("the hosting project and its secrets (inside AVAIA's Vercel project)");
  remaining.push("the admin login (AVAIA's admin account)");
  if (!own.email) remaining.push("the email sender and account");
  remaining.push("backups");
  return {
    category: "quality",
    checkKey: "pink_separation_status",
    label: "Pink Shoelace Foundation technical separation",
    status: "needs_dorian",
    detail: `NOT FULLY SEPARATE. Still shared with AVAIA: ${remaining.join("; ")}. See docs/pink/SEPARATION.md for what is required and which steps only the owner can take.`,
  };
}

export async function pinkSeparationChecks(): Promise<CheckResult[]> {
  return [await pinkBoundaryCheck(), emailIdentityCheck(), separationStatusCheck()];
}
