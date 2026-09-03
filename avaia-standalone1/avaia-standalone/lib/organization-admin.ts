import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// AVAIA Organization Administrator V1. Governing principle: "The
// Organization Administrator administers access, participation, people,
// and programs -- but never administers the Host's story." See migration
// 0047's own header for the full authorization-model reasoning (why this
// reads through the service-role admin client with an explicit re-check
// here, rather than new RLS on guide_participants/youth_programs/
// guardian_consents).

export type OrganizationAdminRow = {
  id: string;
  organization_id: string;
  host_id: string;
  status: "authorized" | "revoked";
  granted_by: string | null;
  granted_at: string;
  status_changed_by: string | null;
  status_changed_at: string;
  notes: string | null;
};

/** Re-verifies a caller is a currently-active Organization Administrator
 *  for one specific organization. Callers must call this themselves at
 *  the top of every Org Admin server action/page -- never trust a route
 *  param or a prior page's own gate. `supabase` should be the caller's
 *  own RLS-scoped client (the self-read policy on organization_admins is
 *  sufficient for this one check; no admin client needed here). */
export async function isOrganizationAdmin(
  supabase: SupabaseClient,
  hostId: string,
  organizationId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("organization_admins")
    .select("id")
    .eq("host_id", hostId)
    .eq("organization_id", organizationId)
    .eq("status", "authorized")
    .maybeSingle();
  return !!data;
}

/** Every organization this Host currently, actively administers -- the
 *  self-read policy on organization_admins already scopes this to their
 *  own rows, so the caller's own RLS-scoped client is sufficient. */
export async function listAdministeredOrganizationIds(
  supabase: SupabaseClient,
  hostId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("organization_admins")
    .select("organization_id")
    .eq("host_id", hostId)
    .eq("status", "authorized");
  return (data ?? []).map((r) => r.organization_id as string);
}

/** Every Guide "connected" to an organization -- defined, for V1, as any
 *  Guide who has created at least one youth_programs row under this
 *  organization_id. There is no separate Guide-to-organization membership
 *  table (a deliberate V1 scope choice, not an oversight -- see the final
 *  report): a Guide becomes visible to an organization's admin by having
 *  actually run a program there, not through a separate invitation step.
 *  `supabase` must be the service-role admin client -- this crosses
 *  Guide-ownership boundaries by design, the same as
 *  deleteYouthParticipantData and the Platform Admin reassignment tool. */
export async function listGuidesConnectedToOrganization(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("youth_programs")
    .select("guide_id")
    .eq("organization_id", organizationId);
  return Array.from(new Set((data ?? []).map((r) => r.guide_id as string)));
}

export type OrgActionType =
  | "program_status_changed"
  | "guide_assigned"
  | "participant_removed"
  | "org_admin_granted"
  | "org_admin_revoked";

/** Records one Organization Administrator action for the audit trail --
 *  action/detail are short operational labels only (see migration 0047's
 *  own comment for why), never conversation content. `supabase` must be
 *  the service-role admin client, matching the table's write posture
 *  (no direct-insert client policy exists). */
export async function logOrganizationAdminAction(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    actorId: string;
    action: OrgActionType;
    programId?: string | null;
    participantId?: string | null;
    guideId?: string | null;
    detail?: string | null;
  }
): Promise<void> {
  await supabase.from("organization_admin_actions").insert({
    organization_id: params.organizationId,
    actor_id: params.actorId,
    action: params.action,
    program_id: params.programId ?? null,
    participant_id: params.participantId ?? null,
    guide_id: params.guideId ?? null,
    detail: params.detail ?? null,
  });
}
