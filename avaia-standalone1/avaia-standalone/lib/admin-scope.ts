// AVAIA and Pink Shoelace Foundation are separate organizations. Their admin
// areas share the same page code during Stage 1 of the separation (before Pink
// moves to its own project), but never the same screen: each page is rendered
// for exactly one scope, and every link, redirect and heading follows it.
//
// Stage 2 (separate Supabase / Vercel / email) lifts the Pink scope out whole;
// nothing here ties the two together beyond running in the same deployment.

export type AdminScope = "avaia" | "pink";

export const SCOPE_BASE: Record<AdminScope, string> = {
  avaia: "/admin",
  pink: "/pink-admin",
};

export const SCOPE_TITLE: Record<AdminScope, string> = {
  avaia: "AVAIA Admin",
  pink: "Pink Shoelace Foundation Admin",
};

/** Form posts carry the scope as a hidden field; anything unrecognised is AVAIA. */
export function parseScope(value: unknown): AdminScope {
  return value === "pink" ? "pink" : "avaia";
}
