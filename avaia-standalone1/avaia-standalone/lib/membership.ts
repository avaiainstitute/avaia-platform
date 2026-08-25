import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** True if this Host currently holds any active entitlement, regardless of
 *  which funding arrangement granted it -- Individual is the only source
 *  any code path grants today (see migration 0019), but this resolves
 *  generally so it doesn't need to change again when Family/Gift/Sponsored/
 *  Organization are built. An entitlement with expires_at in the past no
 *  longer counts; null means open-ended (the only shape granted today). */
export async function isMember(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("entitlements")
    .select("id")
    .eq("host_id", userId)
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .limit(1)
    .maybeSingle();
  return data !== null;
}
