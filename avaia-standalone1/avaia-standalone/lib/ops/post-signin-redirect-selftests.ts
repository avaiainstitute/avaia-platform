import "server-only";
import { ALLOWED_POST_SIGNIN, isAllowedPostSignInPath } from "@/lib/post-signin-redirect-rules";
import type { CheckResult } from "@/lib/ops/system-checks";

// SELF-TEST FOR WHERE SOMEONE LANDS AFTER SIGNING IN. Simulated paths only: nothing is read from or written to the database.
//
//   * every page on the original fixed list is still accepted;
//   * the Coordination pages (a Host's Coordination and share pages, a Guide's Guided Coordination and a grant) are accepted, so a
//     Host or Guide who is sent to sign in lands back where they were going, not on the Journey page;
//   * nothing outside AVAIA, and nothing that is not a plain site path, is ever accepted: other sites, "//", backslashes, "..",
//     query strings, fragments, look-alike prefixes, the admin area, scripts, empty and over-long values.

type Case = { name: string; ok: boolean };

function postSignInCheck(): CheckResult {
  const key = "pipeline_post_signin_redirect";
  const label = "Sign-in lands on the right page and never off-site";
  try {
    const cases: Case[] = [];
    const grant = "/guided-coordination/3f2b8c1e-4d5a-4b6c-9d7e-0123456789ab";
    const share = "/workbook/coordination/3f2b8c1e-4d5a-4b6c-9d7e-0123456789ab/share";

    cases.push({ name: "an original approved page was no longer accepted", ok: ALLOWED_POST_SIGNIN.every((p) => isAllowedPostSignInPath(p)) });
    cases.push({
      name: "a Coordination or Guide Coordination page was not accepted",
      ok: ["/workbook/coordination", "/workbook/coordination/guide", share, "/guided-coordination", grant].every((p) => isAllowedPostSignInPath(p)),
    });

    const refused = [
      "https://example.com",
      "//example.com",
      "/\\example.com",
      "/guided-coordination/../admin",
      "/workbook/coordination/../../admin",
      "/guided-coordination?next=/admin",
      "/guided-coordination#x",
      "/guided-coordinationx",
      "/workbook/coordinationx",
      "/guided-coordination//x",
      "/admin",
      "/admin/system-checks",
      "javascript:alert(1)",
      "/workbook/coordination/%2e%2e",
      "",
      "/" + "a".repeat(250),
    ];
    const accepted = refused.filter((p) => isAllowedPostSignInPath(p));
    cases.push({ name: `these were accepted and must not be: ${accepted.join(" | ")}`, ok: accepted.length === 0 });
    cases.push({ name: "a non-text value was accepted", ok: !isAllowedPostSignInPath(undefined) && !isAllowedPostSignInPath(null) && !isAllowedPostSignInPath(42) });

    const failed = cases.filter((c) => !c.ok).map((c) => c.name);
    return failed.length === 0
      ? {
          category: "quality",
          checkKey: key,
          label,
          status: "pass",
          detail:
            "Simulated paths confirm: every original approved page is still accepted; a Host's Coordination and share pages and a Guide's Guided Coordination and grant pages are accepted, so signing in returns the person to where they were going; and other sites, double slashes, backslashes, parent folders, query strings, fragments, look-alike prefixes, the admin area, scripts, empty and over-long values are never accepted.",
        }
      : { category: "quality", checkKey: key, label, status: "problem", detail: `${failed.length} case(s) broke: ${failed.join("; ")}.` };
  } catch (e) {
    return { category: "quality", checkKey: key, label, status: "problem", detail: `The self-test could not run: ${e instanceof Error ? e.message : String(e)}.` };
  }
}

export function postSignInRedirectChecks(): CheckResult[] {
  return [postSignInCheck()];
}
