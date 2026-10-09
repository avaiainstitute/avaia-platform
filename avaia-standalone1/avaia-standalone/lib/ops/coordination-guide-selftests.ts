import "server-only";
import { buildTimeline } from "@/lib/coordination-entries";
import {
  GRANT_DAYS,
  GUIDE_EVENT_KINDS,
  GUIDE_EVENT_LABEL_FOR_GUIDE,
  GUIDE_EVENT_LABEL_FOR_HOST,
  GUIDE_LIMITS,
  currentScope,
  diffScope,
  grantStatus,
  guideEventNeedsBody,
  guideGrantStatement,
  handoffRoleLabel,
  isGuideEventKind,
  parseGuideEventInput,
  parseGuideFlag,
  parseGuideGrantInput,
  type GuideScopeRow,
} from "@/lib/coordination-guide";
import { guideCoordinationEmailHtml, guideCoordinationSubject } from "@/lib/resend";
import type { CheckResult } from "@/lib/ops/system-checks";

// SELF-TESTS FOR GUIDE COORDINATION (Workbook, Phase 4). Simulated records only: nothing is read from or written
// to the database, and nothing is sent. They run the very same rules production runs, so if a future change
// quietly breaks one of these promises the next System Check reports it:
//
//   * nothing is chosen for the Host: a grant needs a Guide, a name, a length of 1 to 90 days, and at least one
//     item the Host ticked; every choice is validated, never coerced; entries only ever come with their item;
//   * a Guide can record only the six approved kinds, a note or a flag must say something, and no kind is, or
//     can imply, a capacity or legal conclusion;
//   * Guide-authored records appear in the timeline as their own kind and never as a Host entry;
//   * the Host's authorization says what the Guide can and cannot do, and ends on a stated date;
//   * a handoff is described to a Guide by role only (never a name or an email);
//   * the single email carries only who gave the access, until when, and where to sign in;
//   * the launch gate opens only for the exact value "true".
//
// The database half of the promise (the Guide has no table access, one live grant per Guide, a grant can't be edited,
// a Room entry can't be included, removing an item removes its entries, cascades on account removal, no admin path)
// is proven against the live catalog by schema_rules in lib/ops/system-truth.ts and by the rolled-back behavior test
// that accompanied migrations 0123 and 0124.

type Case = { name: string; ok: boolean };

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const baseGrant = (over: Record<string, unknown> = {}) => ({
  guide_id: ID(1),
  host_label: "Dana",
  valid_days: "30",
  item_ids: [ID(10)],
  entry_ids: [] as string[],
  ...over,
});

const scopeRow = (over: Partial<GuideScopeRow>): GuideScopeRow => ({
  id: ID(900),
  grant_id: ID(500),
  host_id: ID(2),
  item_id: ID(10),
  entry_id: null,
  added_at: "2026-10-01T00:00:00Z",
  removed_at: null,
  ...over,
});

function guideCheck(): CheckResult {
  const key = "pipeline_guide_coordination";
  const label = "Guide Coordination behaves as designed";
  try {
    const cases: Case[] = [];

    // Nothing is chosen for the Host.
    const ok = parseGuideGrantInput(baseGrant());
    cases.push({ name: "a complete choice was refused", ok: ok.ok && ok.value.valid_days === 30 && ok.value.item_ids.length === 1 });
    cases.push({ name: "a grant with no Guide was accepted", ok: !parseGuideGrantInput(baseGrant({ guide_id: "" })).ok && !parseGuideGrantInput(baseGrant({ guide_id: "not-an-id" })).ok });
    cases.push({ name: "a grant with no name was accepted", ok: !parseGuideGrantInput(baseGrant({ host_label: "   " })).ok });
    cases.push({
      name: "a name over the limit was accepted",
      ok: !parseGuideGrantInput(baseGrant({ host_label: "x".repeat(GUIDE_LIMITS.hostLabel + 1) })).ok,
    });
    cases.push({ name: "a grant with nothing included was accepted", ok: !parseGuideGrantInput(baseGrant({ item_ids: [] })).ok && !parseGuideGrantInput(baseGrant({ item_ids: undefined })).ok });
    cases.push({ name: "an invalid item id was accepted", ok: !parseGuideGrantInput(baseGrant({ item_ids: ["nope"] })).ok });
    cases.push({
      name: "a duplicate item was not collapsed",
      ok: (() => {
        const r = parseGuideGrantInput(baseGrant({ item_ids: [ID(10), ID(10), ID(11)] }));
        return r.ok && r.value.item_ids.length === 2;
      })(),
    });

    // Duration: 1 to 90, default 30, never coerced.
    cases.push({
      name: "the grant lengths are not exactly 1 to 90 with a default of 30",
      ok:
        GRANT_DAYS.min === 1 &&
        GRANT_DAYS.max === 90 &&
        GRANT_DAYS.default === 30 &&
        (() => {
          const blank = parseGuideGrantInput(baseGrant({ valid_days: "" }));
          const one = parseGuideGrantInput(baseGrant({ valid_days: "1" }));
          const ninety = parseGuideGrantInput(baseGrant({ valid_days: "90" }));
          return blank.ok && blank.value.valid_days === 30 && one.ok && one.value.valid_days === 1 && ninety.ok && ninety.value.valid_days === 90;
        })(),
    });
    cases.push({
      name: "a length outside 1 to 90, or not a whole number, was accepted",
      ok: ["0", "91", "-3", "1.5", "abc", "1e2"].every((d) => !parseGuideGrantInput(baseGrant({ valid_days: d })).ok),
    });

    // What a Guide may record.
    cases.push({
      name: "the Guide's record kinds are not exactly the six approved",
      ok:
        GUIDE_EVENT_KINDS.length === 6 &&
        ["note", "followup_done", "contacted_professional", "reviewed_with_host", "waiting_on_host", "flag_attention"].every((k) => isGuideEventKind(k)) &&
        !isGuideEventKind("change_status") &&
        !isGuideEventKind("capacity") &&
        !isGuideEventKind(undefined),
    });
    cases.push({
      name: "no record kind or label implies a capacity or legal conclusion",
      ok: GUIDE_EVENT_KINDS.every((k) => !/capacity|incapac|legal|compet|verdict|diagnos/i.test(`${k} ${GUIDE_EVENT_LABEL_FOR_GUIDE[k]} ${GUIDE_EVENT_LABEL_FOR_HOST[k]}`)),
    });
    cases.push({
      name: "a note or flag without words was accepted, or a follow-up mark needed words",
      ok:
        guideEventNeedsBody("note") &&
        guideEventNeedsBody("flag_attention") &&
        !guideEventNeedsBody("followup_done") &&
        !guideEventNeedsBody("contacted_professional") &&
        !guideEventNeedsBody("reviewed_with_host") &&
        !guideEventNeedsBody("waiting_on_host") &&
        !parseGuideEventInput({ kind: "note", body: "   " }).ok &&
        !parseGuideEventInput({ kind: "flag_attention", body: "" }).ok &&
        parseGuideEventInput({ kind: "followup_done", body: "" }).ok,
    });
    cases.push({
      name: "an unknown kind or an over-long note was accepted",
      ok: !parseGuideEventInput({ kind: "decide_for_host", body: "x" }).ok && !parseGuideEventInput({ kind: "note", body: "x".repeat(GUIDE_LIMITS.body + 1) }).ok,
    });
    cases.push({
      name: "a Guide's words were changed on the way in",
      ok: (() => {
        const r = parseGuideEventInput({ kind: "note", body: "  Called Sam; waiting for the deed.  " });
        return r.ok && r.value.body === "Called Sam; waiting for the deed.";
      })(),
    });

    // The Host's authorization.
    const statement = guideGrantStatement({ guideName: "Pat", endsOn: "November 9, 2026" });
    cases.push({
      name: "the authorization does not name the Guide and the end date",
      ok: statement.includes("Pat") && statement.includes("November 9, 2026"),
    });
    cases.push({
      name: "the authorization lacks what a Guide can and cannot do, or what revoking does not do",
      ok:
        statement.includes("including the people I have named on those items") &&
        statement.includes("They can record notes and follow-up marks") &&
        statement.includes("They cannot change my decisions, my entries, who carries what, or anything I share") &&
        statement.includes("does not erase notes") &&
        statement.includes("does not recall anything they have already read"),
    });

    // Grant status: revoked wins, otherwise by time.
    const now = new Date("2026-10-10T00:00:00Z");
    cases.push({
      name: "grant status is wrong",
      ok:
        grantStatus({ revoked_at: null, ends_at: "2026-11-01T00:00:00Z" }, now) === "active" &&
        grantStatus({ revoked_at: null, ends_at: "2026-10-01T00:00:00Z" }, now) === "expired" &&
        grantStatus({ revoked_at: "2026-10-05T00:00:00Z", ends_at: "2026-11-01T00:00:00Z" }, now) === "revoked" &&
        grantStatus({ revoked_at: "2026-10-05T00:00:00Z", ends_at: "2026-10-01T00:00:00Z" }, now) === "revoked",
    });

    // Scope: only live rows, only this grant; an entry never outlives its item.
    const rows: GuideScopeRow[] = [
      scopeRow({ id: ID(901), item_id: ID(10) }),
      scopeRow({ id: ID(902), item_id: ID(11), removed_at: "2026-10-02T00:00:00Z" }),
      scopeRow({ id: ID(903), item_id: ID(10), entry_id: ID(20) }),
      scopeRow({ id: ID(904), grant_id: ID(501), item_id: ID(12) }),
    ];
    const cur = currentScope(rows, ID(500));
    cases.push({
      name: "the current scope counts a removed row, or another grant's row",
      ok: cur.itemIds.size === 1 && cur.itemIds.has(ID(10)) && cur.entryIds.size === 1 && cur.entryIds.has(ID(20)),
    });
    const diff = diffScope(cur, {
      itemIds: [ID(10), ID(13)],
      entryIds: [ID(21), ID(22)],
      entryItem: (e) => (e === ID(21) ? ID(10) : e === ID(22) ? ID(99) : null),
    });
    cases.push({
      name: "the scope change is wrong (adds, removals, or an entry kept without its item)",
      ok:
        diff.addItems.length === 1 &&
        diff.addItems[0] === ID(13) &&
        diff.removeItems.length === 0 &&
        diff.addEntries.length === 1 &&
        diff.addEntries[0] === ID(21) &&
        diff.removeEntries.length === 1 &&
        diff.removeEntries[0] === ID(20),
    });
    cases.push({
      name: "choosing nothing changed the scope",
      ok: (() => {
        const same = diffScope(cur, { itemIds: [ID(10)], entryIds: [ID(20)], entryItem: () => ID(10) });
        return same.addItems.length + same.removeItems.length + same.addEntries.length + same.removeEntries.length === 0;
      })(),
    });

    // Timeline: Guide-authored records are their own kind, never a Host entry.
    const tl = buildTimeline(
      { created_at: "2026-10-01T00:00:00Z", status: "open", closed_at: null },
      [],
      [],
      new Date("2026-12-01T00:00:00Z"),
      {
        grants: [{ id: ID(500), guideLabel: "Pat", granted_at: "2026-10-02T00:00:00Z", ends_at: "2026-11-01T00:00:00Z", revoked_at: null }],
        events: [{ id: ID(700), guideLabel: "Pat", kind: "note", body: "A note", created_at: "2026-10-03T00:00:00Z", withdrawn_at: null, acknowledged_at: null }],
      }
    );
    cases.push({
      name: "the timeline is not built from the Guide's grant and records, or shows a Guide record as a Host entry",
      ok:
        tl.map((e) => e.kind).join(",") === "item_added,guide_granted,guide_event,guide_expired" &&
        !tl.some((e) => e.kind === "entry"),
    });
    const tlRevoked = buildTimeline(
      { created_at: "2026-10-01T00:00:00Z", status: "open", closed_at: null },
      [],
      [],
      new Date("2026-12-01T00:00:00Z"),
      { grants: [{ id: ID(500), guideLabel: "Pat", granted_at: "2026-10-02T00:00:00Z", ends_at: "2026-11-01T00:00:00Z", revoked_at: "2026-10-10T00:00:00Z" }], events: [] }
    );
    cases.push({
      name: "a revoked grant shows as revoked and not also as expired",
      ok: tlRevoked.map((e) => e.kind).join(",") === "item_added,guide_granted,guide_revoked",
    });
    cases.push({
      name: "a grant adds an event the grant's own dates do not support",
      ok: buildTimeline({ created_at: "2026-10-01T00:00:00Z", status: "open", closed_at: null }, [], [], new Date("2026-12-01T00:00:00Z")).map((e) => e.kind).join(",") === "item_added",
    });

    // A handoff is described by role only.
    cases.push({
      name: "a handoff is not described by role only",
      ok:
        handoffRoleLabel({ recipient_role: "attorney", recipient_role_label: null }) === "Attorney" &&
        handoffRoleLabel({ recipient_role: "attorney", recipient_role_label: "estate attorney" }) === "estate attorney" &&
        handoffRoleLabel({ recipient_role: "something-else", recipient_role_label: null }) === "A professional",
    });

    // The one email.
    const html = guideCoordinationEmailHtml({ hostLabel: "Dana <b>Smith</b>", url: "https://example.org/guided-coordination", endsOn: "November 9, 2026" });
    cases.push({ name: "the subject does not say who gave the access", ok: guideCoordinationSubject("Dana") === "Dana has given you access to coordination in AVAIA." });
    cases.push({ name: "a name was allowed to add a line to the subject", ok: !guideCoordinationSubject("Dana\r\nBcc: x@y.z").includes("\n") });
    cases.push({
      name: "the email lacks who gave the access, the end date or the link",
      ok: html.includes("has given you access to coordination items in AVAIA") && html.includes("November 9, 2026") && html.includes("https://example.org/guided-coordination"),
    });
    cases.push({ name: "the email did not tell the Guide to ignore it if unexpected", ok: html.includes("you can ignore this email") });
    cases.push({ name: "a typed name was not escaped in the email", ok: !html.includes("<b>Smith</b>") && html.includes("&lt;b&gt;Smith&lt;/b&gt;") });
    cases.push({ name: "the email carries a title, entry, purpose or other content", ok: !/title|purpose|excerpt|summary|decision|entry|entries|note/i.test(html) });

    // The launch gate.
    cases.push({
      name: "the launch gate opens for something other than exactly 'true'",
      ok: parseGuideFlag("true") && !parseGuideFlag("TRUE") && !parseGuideFlag("True") && !parseGuideFlag("1") && !parseGuideFlag("yes") && !parseGuideFlag("") && !parseGuideFlag(undefined),
    });

    const failed = cases.filter((c) => !c.ok).map((c) => c.name);
    return failed.length === 0
      ? {
          category: "quality",
          checkKey: key,
          label,
          status: "pass",
          detail:
            "Simulated records confirm: nothing is chosen for the Host (a Guide, a name, 1 to 90 days and at least one ticked item are required, and entries only come with their item); a Guide can record only the six approved kinds, with no kind implying a capacity or legal conclusion, and a note or flag must say something; Guide-authored records stay a separate kind in the timeline and are never a Host entry; the Host's authorization states what the Guide can and cannot do; a handoff is described to a Guide by role only; the one email carries only who gave the access, until when and where to sign in; and the launch gate opens only for exactly 'true'.",
        }
      : { category: "quality", checkKey: key, label, status: "problem", detail: `${failed.length} case(s) broke: ${failed.join("; ")}.` };
  } catch (e) {
    return { category: "quality", checkKey: key, label, status: "problem", detail: `The self-test could not run: ${e instanceof Error ? e.message : String(e)}.` };
  }
}

export function guideCoordinationChecks(): CheckResult[] {
  return [guideCheck()];
}
