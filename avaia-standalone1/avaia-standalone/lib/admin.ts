import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Mirrors isGuide() (lib/guide.ts) exactly -- same one-column-lookup shape.
 *  profiles.role === 'admin' is already the live gate every admin-only RLS
 *  policy in this schema checks (guide_candidates, guide_certifications,
 *  guide_certification_decisions, guide_candidate_reminders,
 *  certification_companion_escalations, and now
 *  certification_operations_exceptions all use this exact expression in
 *  their own policies) -- this helper just gives application code the same
 *  check, for gating a page/route rather than a row. No `app/admin/` area
 *  and no isAdmin() helper existed anywhere in the codebase before this
 *  file (confirmed by a full repo audit); this is the first one. */
export async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "admin";
}
