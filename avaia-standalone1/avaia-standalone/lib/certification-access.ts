import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCandidateAccess } from "@/lib/certification";

/** Gate for every candidate-facing certification page and action. Having an
 *  AVAIA account is not enough: the signed-in Host must hold an open,
 *  active certification candidacy (created only by a human admin). Every
 *  page and server action calls this itself rather than trusting the layout,
 *  because a server action is its own reachable endpoint. Anyone who is not
 *  an active candidate is sent to /certification, which shows only a plain
 *  "not available" notice and reveals nothing about the course. */
export async function requireClassroomCandidate(fromPath: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=${fromPath}`);

  const { data: profile } = await supabase.from("profiles").select("consent_at").eq("id", user.id).maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");

  const access = await getCandidateAccess(supabase, user.id);
  if (access.kind !== "active") redirect("/certification");

  return { supabase, user, candidate: access.candidate };
}
