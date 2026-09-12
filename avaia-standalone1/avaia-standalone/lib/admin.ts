import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Every admin page/server-action in this app repeats the same two
 *  checks (signed in, profiles.role='admin') before touching anything.
 *  Library administration (Phase 4 of the Library completion work) adds
 *  enough new admin surfaces that duplicating this inline everywhere
 *  would be its own source of drift; this is the one shared version.
 *  Mirrors app/admin/library/page.tsx's own inline check exactly, same
 *  redirect targets, same profiles.role source of truth (the same one
 *  the "library concepts admin all" RLS policy itself checks). */
export async function requireAdmin(supabase: SupabaseClient, from: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=${from}`);

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  return user.id;
}
