// Which pages a Host or Guide may be sent to right after signing in. Pure and shared (no browser access), so the same rule
// is used by the sign-in page, the email-link landing, the consent form, and the System Checks self-test.
//
// Two ways a destination is accepted:
//  1. an exact entry in ALLOWED (the original fixed list), or
//  2. a page inside a Coordination area (Workbook Coordination, or a Guide's Guided Coordination), including its own sub-pages
//     such as /guided-coordination/<grant> and /workbook/coordination/<item>/share. These are accepted only when the path is a plain
//     same-site path: it starts with a single slash and contains only letters, digits, hyphens, underscores and slashes. No
//     query, no fragment, no colon, no backslash, no "//", no ".." and no other site can ever be a destination.
// Anything else falls back to /journey, as before.

export const DEFAULT_POST_SIGNIN = "/journey";

export const ALLOWED_POST_SIGNIN = [
  "/journey",
  "/defying-grief",
  "/unsung-heroes?path=i_saw_someone",
  "/toolkit",
  "/library",
  "/workbook",
  "/shared-with-me",
  "/youth",
  "/certified-guide/apply",
  "/certification",
];

const COORDINATION_AREAS = ["/workbook/coordination", "/guided-coordination"];
const PLAIN_PATH = /^\/[A-Za-z0-9_\-/]*$/;

export function isAllowedPostSignInPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0 || path.length > 200) return false;
  if (ALLOWED_POST_SIGNIN.includes(path)) return true;
  if (!PLAIN_PATH.test(path) || path.includes("//") || path.includes("..")) return false;
  return COORDINATION_AREAS.some((area) => path === area || path.startsWith(`${area}/`));
}
