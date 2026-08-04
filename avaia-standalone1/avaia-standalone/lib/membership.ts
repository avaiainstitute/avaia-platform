import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function isMember(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("membership_status")
    .eq("id", userId)
    .maybeSingle();
  return data?.membership_status === "member";
}
