// What AVAIA's admin prospect research may list and run. AVAIA's own business development only:
// the Foundation is a separate organization with its own application and database, and nothing
// here refers to its tables (scripts/pink-isolation.sh fails the build if that changes).

export type ProspectVerticalKey = "program" | "speaking";

/** The table each prospect list lives in. */
export const PROSPECT_TABLE_BY_VERTICAL: Record<ProspectVerticalKey, "avaia_experience_prospects" | "avaia_speaking_opportunities"> = {
  program: "avaia_experience_prospects",
  speaking: "avaia_speaking_opportunities",
};

/** Research the scheduled weekly job runs. */
export const SCHEDULED_RESEARCH_VERTICALS: ProspectVerticalKey[] = ["program", "speaking"];
