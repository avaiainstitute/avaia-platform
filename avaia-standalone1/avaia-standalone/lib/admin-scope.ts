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

// ---------------------------------------------------------------------------
// What each organization's admin may read and run. These are the boundary, kept
// in one plain module so a self-test (lib/ops/pink-separation-selftests.ts) can
// prove it: AVAIA's admin never touches a pink_* table, and Pink's never touches
// an AVAIA table of research or participants.
// ---------------------------------------------------------------------------

export type InquirySourceKey = "contact_submissions" | "pink_contact_submissions" | "pink_participation_interest";

export const INQUIRY_SOURCES_BY_SCOPE: Record<AdminScope, InquirySourceKey[]> = {
  avaia: ["contact_submissions"],
  pink: ["pink_contact_submissions", "pink_participation_interest"],
};

export type ProspectVerticalKey = "partnership" | "donor" | "program" | "speaking";

/** The prospect lists each organization's admin SHOWS. Pink's "partnership" list is the
 *  preserved output of the mixed-organization research that was stopped on 2026-10-05
 *  (read and status-update only; nothing new is added to it). AVAIA shows none of it. */
export const PROSPECT_LISTS_BY_SCOPE: Record<AdminScope, ProspectVerticalKey[]> = {
  avaia: ["program", "speaking"],
  pink: ["partnership", "donor"],
};

/** The prospect research each organization's admin may RUN. "partnership" research mixed
 *  both organizations in one prompt and one table; it is stopped for both. */
export const RESEARCH_RUNNABLE_BY_SCOPE: Record<AdminScope, ProspectVerticalKey[]> = {
  avaia: ["program", "speaking"],
  pink: ["donor"],
};

/** The table each prospect list lives in. The first two are Pink's; the last two are AVAIA's. */
export const PROSPECT_TABLE_BY_VERTICAL: Record<ProspectVerticalKey, string> = {
  partnership: "pink_partnership_prospects",
  donor: "pink_donor_prospects",
  program: "avaia_experience_prospects",
  speaking: "avaia_speaking_opportunities",
};

/** Research the scheduled weekly job runs. AVAIA's own business development only. */
export const SCHEDULED_RESEARCH_VERTICALS: ProspectVerticalKey[] = RESEARCH_RUNNABLE_BY_SCOPE.avaia;
