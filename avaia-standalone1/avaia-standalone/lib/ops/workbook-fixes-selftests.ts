import "server-only";
import { listFromField } from "@/lib/referral-fields";
import { shareConversationId } from "@/lib/share-scope";
import type { CheckResult } from "@/lib/ops/system-checks";

// SELF-TESTS FOR TWO WORKBOOK FIXES. Simulated values only: nothing is read from or written to the database.
//
//   * The Workbook's roll-ups ("Next right steps", Lessons) read referral fields that are sometimes a list and
//     sometimes a single string (InnerCompass `nextStep` and `whatToPreserve`; older records may hold
//     `whatToPreserve` as a list). A string must count as a one-item list, never be silently dropped.
//   * A share or invite tied to a conversation (scopes 'conversation' and 'referral') must carry that
//     conversation's id for someone with no account yet, exactly as it does for someone who has one. The
//     database refuses a null id for those scopes, which is how 'referral' invites used to fail.
//
// The database half (the invite constraint, signup conversion, and referral-only access that never reaches the
// transcript) was proven with a rolled-back test and is guarded by the existing shared_access policies.

type Case = { name: string; ok: boolean };

function workbookFixesCheck(): CheckResult {
  const key = "pipeline_workbook_fixes";
  const label = "Workbook string fields and referral invites behave as designed";
  try {
    const cases: Case[] = [];

    // Referral fields as lists.
    cases.push({ name: "an array of strings was not returned as it is", ok: JSON.stringify(listFromField(["a", "b"])) === '["a","b"]' });
    cases.push({ name: "a non-string item inside an array was kept", ok: JSON.stringify(listFromField(["a", 3, null, { x: 1 }, "b"])) === '["a","b"]' });
    cases.push({ name: "a single string (InnerCompass nextStep) was dropped instead of counted as one item", ok: JSON.stringify(listFromField("Call my sister on Friday")) === '["Call my sister on Friday"]' });
    cases.push({ name: "an empty or blank string produced an item", ok: listFromField("").length === 0 && listFromField("   ").length === 0 });
    cases.push({
      name: "a missing, numeric, boolean or object value was not ignored",
      ok: [undefined, null, 0, 7, true, false, {}, { a: 1 }].every((v) => listFromField(v).length === 0),
    });
    // The same helper serves a whole roll-up: a string field, a list field and a legacy list field together.
    const content: Record<string, unknown> = {
      nextStep: "Talk to Sam",
      restorationTargets: ["Sleep", "Walks"],
      whatToPreserve: "The garden",
    };
    const legacy: Record<string, unknown> = { whatToPreserve: ["The garden", "My letters"] };
    const roll = (c: Record<string, unknown>, keys: string[]) => keys.flatMap((k) => listFromField(c[k]));
    cases.push({
      name: "Next right steps did not include both the string nextStep and the list restorationTargets",
      ok: JSON.stringify(roll(content, ["nextStep", "restorationTargets"])) === '["Talk to Sam","Sleep","Walks"]',
    });
    cases.push({
      name: "Lessons did not read whatToPreserve as a string, or as a list in an older record",
      ok: JSON.stringify(roll(content, ["whatToPreserve"])) === '["The garden"]' && JSON.stringify(roll(legacy, ["whatToPreserve"])) === '["The garden","My letters"]',
    });

    // Which conversation a share or invite carries.
    const id = "00000000-0000-4000-8000-000000000001";
    cases.push({ name: "a conversation share did not carry its conversation id", ok: shareConversationId("conversation", id) === id });
    cases.push({ name: "a referral share did not carry its conversation id (the invite bug)", ok: shareConversationId("referral", id) === id });
    cases.push({ name: "a whole-Workbook share carried a conversation id", ok: shareConversationId("workbook", id) === null && shareConversationId("workbook", undefined) === null });
    cases.push({ name: "a missing conversation id was invented", ok: shareConversationId("referral", undefined) === null });

    const failed = cases.filter((c) => !c.ok).map((c) => c.name);
    return failed.length === 0
      ? {
          category: "quality",
          checkKey: key,
          label,
          status: "pass",
          detail:
            "Simulated values confirm: a single string field counts as a one-item list while arrays (including older stored lists) and blanks behave as before, so InnerCompass next steps and what-to-preserve reach the Workbook roll-ups; and a conversation or referral share carries its conversation id for someone without an account, as it does for someone with one, while a whole-Workbook share carries none.",
        }
      : { category: "quality", checkKey: key, label, status: "problem", detail: `${failed.length} case(s) broke: ${failed.join("; ")}.` };
  } catch (e) {
    return { category: "quality", checkKey: key, label, status: "problem", detail: `The self-test could not run: ${e instanceof Error ? e.message : String(e)}.` };
  }
}

export function workbookFixesChecks(): CheckResult[] {
  return [workbookFixesCheck()];
}
