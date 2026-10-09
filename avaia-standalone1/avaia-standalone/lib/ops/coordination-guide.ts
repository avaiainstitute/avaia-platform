import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { guideCoordinationEmailHtml, guideCoordinationSubject, sendEmail } from "@/lib/resend";
import { isUuid } from "@/lib/coordination";
import { formatLongDate } from "@/lib/coordination-shares";
import { isAdultHost } from "@/lib/ops/coordination";
import {
  currentScope,
  diffScope,
  grantEndsOn,
  grantStatus,
  guideGrantStatement,
  parseGuideEventInput,
  parseGuideFlag,
  parseGuideGrantInput,
  type GuideEvent,
  type GuideGrant,
  type GuideHostSummary,
  type GuideScopeRow,
  type GuideView,
} from "@/lib/coordination-guide";

// GUIDE COORDINATION (the I/O side), Workbook Phase 4. See lib/coordination-guide.ts for the rules and
// supabase/migrations/0123 and 0124 for the database's own protections. Decision 0011.
//
// Posture of this file:
//  * Nothing is chosen for the Host. The Host picks the Guide, the length, each item and each entry; nothing
//    is pre-selected, and nothing is inferred or chosen by AI.
//  * The Guide never reads a Host table. A Guide's pages call two narrow database functions that return only
//    permitted fields, and re-check certification, the coordination_support capability, an active unexpired
//    Host grant and the Host's chosen scope on every call.
//  * A Guide can only add their own notes and follow-up marks. Nothing here lets a Guide change a Host's item,
//    entry, delegation, status, waiting-on, next action, due date, scope or any Phase 3 share.
//  * Guide-authored records are never written to coordination_entries and are never part of a share.
//  * Outward behavior is gated by COORDINATION_GUIDE_ENABLED until the end-to-end flow is exercised. Revoking
//    is never gated.

type Result<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string };
type DbError = { code?: string; message?: string } | null | undefined;

/** The database's own plain-language refusals are safe to show; anything else gets a generic message. */
function friendly(error: DbError): string {
  if (error?.code === "P0001" && error.message) return error.message;
  if (error?.code === "23505") return "That is already included.";
  if (error?.code === "23514") return "One of those entries is not allowed.";
  return "That could not be saved. Please try again.";
}

/** The launch gate. Closed unless the environment switch is exactly "true". */
export function isGuideCoordinationEnabled(): boolean {
  return parseGuideFlag(process.env.COORDINATION_GUIDE_ENABLED);
}

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://avaiainstitute.com";

const GRANT_COLUMNS = "id, host_id, guide_id, host_label, authorization_statement, granted_at, valid_days, ends_at, revoked_at";
const SCOPE_COLUMNS = "id, grant_id, host_id, item_id, entry_id, added_at, removed_at";
const EVENT_COLUMNS = "id, grant_id, host_id, guide_id, item_id, kind, body, created_at, withdrawn_at, acknowledged_at";

// ---- The Host's side ---------------------------------------------------------------------------------

export type EligibleGuide = { guide_id: string; guide_display_name: string };

/** The Guides a Host can choose from: display names only, never an email. */
export async function listEligibleGuides(supabase: SupabaseClient): Promise<EligibleGuide[]> {
  const { data, error } = await supabase.rpc("list_eligible_coordination_guides");
  if (error) throw new Error(error.message);
  return (data ?? []) as EligibleGuide[];
}

/** A Guide's display name, by id. Falls back to a plain phrase, never to an email. */
export async function guideNames(supabase: SupabaseClient, guideIds: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(guideIds.filter((g) => isUuid(g))));
  const entries = await Promise.all(
    unique.map(async (id): Promise<[string, string]> => {
      const { data } = await supabase.rpc("get_guide_display_name", { p_guide_id: id });
      const name = typeof data === "string" ? data.trim() : "";
      return [id, name.length > 0 ? name : "Your Guide"];
    })
  );
  return new Map(entries);
}

export async function listGrants(supabase: SupabaseClient, hostId: string): Promise<GuideGrant[]> {
  const { data, error } = await supabase
    .from("coordination_guide_grants")
    .select(GRANT_COLUMNS)
    .eq("host_id", hostId)
    .order("granted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as GuideGrant[];
}

export async function listScope(supabase: SupabaseClient, hostId: string): Promise<GuideScopeRow[]> {
  const { data, error } = await supabase.from("coordination_guide_scope").select(SCOPE_COLUMNS).eq("host_id", hostId);
  if (error) throw new Error(error.message);
  return (data ?? []) as GuideScopeRow[];
}

/** Every Guide-authored record on the Host's items (or on one item), oldest first. The Host always sees them. */
export async function listGuideEvents(supabase: SupabaseClient, hostId: string, itemId?: string): Promise<GuideEvent[]> {
  let q = supabase.from("coordination_guide_events").select(EVENT_COLUMNS).eq("host_id", hostId);
  if (itemId) {
    if (!isUuid(itemId)) return [];
    q = q.eq("item_id", itemId);
  }
  const { data, error } = await q.order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as GuideEvent[];
}

export type CreateGrantResult = { grantId: string; guideName: string; endsOn: string; emailSent: boolean };

/** The Host authorizes one Guide, with the items and entries they chose. The database verifies the Guide and
 *  stamps the dates. If the scope cannot be saved, the grant is ended again so nothing half-made stays open. */
export async function createGuideGrant(
  supabase: SupabaseClient,
  hostId: string,
  raw: { guide_id?: unknown; host_label?: unknown; valid_days?: unknown; item_ids?: unknown; entry_ids?: unknown }
): Promise<Result<{ result: CreateGrantResult }>> {
  if (!isGuideCoordinationEnabled()) return { ok: false, error: "Guide coordination isn't open yet." };
  if (!(await isAdultHost(supabase, hostId))) return { ok: false, error: "Guide coordination is available to adult accounts in this release." };
  const parsed = parseGuideGrantInput(raw);
  if (!parsed.ok) return parsed;
  const input = parsed.value;

  // The Host's own items and entries only. The database re-checks every one of these.
  const { data: ownItems } = await supabase.from("coordination_items").select("id").eq("host_id", hostId).in("id", input.item_ids);
  if ((ownItems ?? []).length !== input.item_ids.length) return { ok: false, error: "One of those items could not be found." };
  let entryRows: { id: string; item_id: string; withdrawn_at: string | null; source_kind: string }[] = [];
  if (input.entry_ids.length > 0) {
    const { data } = await supabase
      .from("coordination_entries")
      .select("id, item_id, withdrawn_at, source_kind")
      .eq("host_id", hostId)
      .in("id", input.entry_ids);
    entryRows = (data ?? []) as typeof entryRows;
    if (entryRows.length !== input.entry_ids.length) return { ok: false, error: "One of those entries could not be found." };
    for (const e of entryRows) {
      if (!input.item_ids.includes(e.item_id)) return { ok: false, error: "Include a decision before choosing its entries." };
      if (e.withdrawn_at !== null) return { ok: false, error: "A withdrawn entry cannot be shown to a Guide." };
      if (e.source_kind === "room_message") return { ok: false, error: "Words from a Shared Room are not shown to a Guide." };
    }
  }

  const names = await guideNames(supabase, [input.guide_id]);
  const guideName = names.get(input.guide_id) ?? "Your Guide";
  const statement = guideGrantStatement({ guideName, endsOn: grantEndsOn(input.valid_days) });

  const { data: grant, error } = await supabase
    .from("coordination_guide_grants")
    .insert({
      host_id: hostId,
      guide_id: input.guide_id,
      host_label: input.host_label,
      authorization_statement: statement,
      valid_days: input.valid_days,
    })
    .select("id, ends_at")
    .single();
  if (error || !grant) return { ok: false, error: friendly(error) };
  const row = grant as { id: string; ends_at: string };

  const itemRows = input.item_ids.map((item_id) => ({ grant_id: row.id, host_id: hostId, item_id }));
  const { error: itemError } = await supabase.from("coordination_guide_scope").insert(itemRows);
  let scopeError = itemError;
  if (!scopeError && input.entry_ids.length > 0) {
    const byId = new Map(entryRows.map((e) => [e.id, e.item_id]));
    const entryScope = input.entry_ids.map((entry_id) => ({ grant_id: row.id, host_id: hostId, item_id: byId.get(entry_id) as string, entry_id }));
    const { error: entryError } = await supabase.from("coordination_guide_scope").insert(entryScope);
    scopeError = entryError;
  }
  if (scopeError) {
    await supabase.from("coordination_guide_grants").update({ revoked_at: new Date().toISOString() }).eq("id", row.id).eq("host_id", hostId);
    return { ok: false, error: `${friendly(scopeError)} Nothing was shared with your Guide.` };
  }

  // The one email (Decision 0011): access was granted. No private content in it.
  let emailSent = false;
  try {
    const admin = createAdminClient();
    const { data: guideUser } = await admin.auth.admin.getUserById(input.guide_id);
    const to = guideUser?.user?.email;
    if (to) {
      await sendEmail({
        to,
        subject: guideCoordinationSubject(input.host_label),
        html: guideCoordinationEmailHtml({ hostLabel: input.host_label, url: `${siteUrl()}/guided-coordination`, endsOn: formatLongDate(row.ends_at) }),
        context: "guide_coordination_grant",
      });
      emailSent = true;
    }
  } catch {
    // sendEmail has already recorded the failure centrally. The access exists; the Host is told.
    emailSent = false;
  }
  return { ok: true, result: { grantId: row.id, guideName, endsOn: formatLongDate(row.ends_at), emailSent } };
}

/** Change what an active grant includes. Adds and removals only; the database re-verifies every row. */
export async function updateGuideScope(
  supabase: SupabaseClient,
  hostId: string,
  grantId: string,
  raw: { item_ids: string[]; entry_ids: string[] }
): Promise<Result> {
  if (!isGuideCoordinationEnabled()) return { ok: false, error: "Guide coordination isn't open yet." };
  if (!isUuid(grantId)) return { ok: false, error: "That access could not be found." };
  const { data: grantRow } = await supabase.from("coordination_guide_grants").select(GRANT_COLUMNS).eq("id", grantId).eq("host_id", hostId).maybeSingle();
  const grant = grantRow as GuideGrant | null;
  if (!grant) return { ok: false, error: "That access could not be found." };
  if (grantStatus(grant) !== "active") return { ok: false, error: "That access has ended. Authorize a new one to continue." };

  const itemIds = Array.from(new Set(raw.item_ids.filter(isUuid)));
  const entryIds = Array.from(new Set(raw.entry_ids.filter(isUuid)));
  if (itemIds.length === 0) return { ok: false, error: "Keep at least one item, or revoke the access." };

  const { data: ownItems } = await supabase.from("coordination_items").select("id").eq("host_id", hostId).in("id", itemIds);
  if ((ownItems ?? []).length !== itemIds.length) return { ok: false, error: "One of those items could not be found." };
  const entryItem = new Map<string, string>();
  if (entryIds.length > 0) {
    const { data } = await supabase.from("coordination_entries").select("id, item_id").eq("host_id", hostId).in("id", entryIds);
    for (const e of (data ?? []) as { id: string; item_id: string }[]) entryItem.set(e.id, e.item_id);
    if (entryItem.size !== entryIds.length) return { ok: false, error: "One of those entries could not be found." };
  }

  const scopeRows = await listScope(supabase, hostId);
  const diff = diffScope(currentScope(scopeRows, grantId), { itemIds, entryIds, entryItem: (e) => entryItem.get(e) ?? null });
  const now = new Date().toISOString();

  // Removals first (removing an item also removes its chosen entries, in the database), then additions.
  for (const e of diff.removeEntries) {
    const { error } = await supabase.from("coordination_guide_scope").update({ removed_at: now }).eq("grant_id", grantId).eq("host_id", hostId).eq("entry_id", e).is("removed_at", null);
    if (error) return { ok: false, error: friendly(error) };
  }
  for (const i of diff.removeItems) {
    const { error } = await supabase.from("coordination_guide_scope").update({ removed_at: now }).eq("grant_id", grantId).eq("host_id", hostId).eq("item_id", i).is("entry_id", null).is("removed_at", null);
    if (error) return { ok: false, error: friendly(error) };
  }
  if (diff.addItems.length > 0) {
    const { error } = await supabase.from("coordination_guide_scope").insert(diff.addItems.map((item_id) => ({ grant_id: grantId, host_id: hostId, item_id })));
    if (error) return { ok: false, error: friendly(error) };
  }
  if (diff.addEntries.length > 0) {
    const { error } = await supabase
      .from("coordination_guide_scope")
      .insert(diff.addEntries.map((entry_id) => ({ grant_id: grantId, host_id: hostId, item_id: entryItem.get(entry_id) as string, entry_id })));
    if (error) return { ok: false, error: friendly(error) };
  }
  return { ok: true };
}

/** End a Guide's access now. The database stamps the time, once, and it can never be undone. Never gated. */
export async function revokeGuideGrant(supabase: SupabaseClient, hostId: string, grantId: string): Promise<Result> {
  if (!isUuid(grantId)) return { ok: false, error: "That access could not be found." };
  const { data, error } = await supabase
    .from("coordination_guide_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", grantId)
    .eq("host_id", hostId)
    .select("id");
  if (error) return { ok: false, error: "That could not be revoked. Please try again." };
  if (!data || data.length === 0) return { ok: false, error: "That access could not be found." };
  return { ok: true };
}

/** The Host acknowledges a Guide's flag. The database stamps the time. */
export async function acknowledgeGuideFlag(supabase: SupabaseClient, hostId: string, eventId: string): Promise<Result> {
  if (!isUuid(eventId)) return { ok: false, error: "That could not be found." };
  const { data, error } = await supabase
    .from("coordination_guide_events")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("host_id", hostId)
    .select("id");
  if (error) return { ok: false, error: friendly(error) };
  if (!data || data.length === 0) return { ok: false, error: "That could not be found." };
  return { ok: true };
}

// ---- The Guide's side --------------------------------------------------------------------------------

/** The Hosts with a live grant for the signed-in Guide. Counts only. Empty for anyone not currently eligible. */
export async function listGuideHosts(supabase: SupabaseClient): Promise<GuideHostSummary[]> {
  const { data, error } = await supabase.rpc("guide_coordination_hosts");
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []) as GuideHostSummary[];
}

/** One Host's chosen items and entries, through the database function. Null for anything not currently allowed. */
export async function getGuideView(supabase: SupabaseClient, grantId: string): Promise<GuideView | null> {
  if (!isUuid(grantId)) return null;
  const { data, error } = await supabase.rpc("guide_coordination_host_view", { p_grant_id: grantId });
  if (error || !data) return null;
  return data as GuideView;
}

/** The Guide records a note or a follow-up mark on an item the Host included. The database re-verifies the
 *  grant, the Guide's eligibility and the item's place in scope, and stamps the time. */
export async function recordGuideEvent(
  supabase: SupabaseClient,
  guideId: string,
  grantId: string,
  itemId: string,
  raw: Record<string, FormDataEntryValue | null | undefined>
): Promise<Result> {
  if (!isGuideCoordinationEnabled()) return { ok: false, error: "Guide coordination isn't open yet." };
  if (!isUuid(grantId) || !isUuid(itemId)) return { ok: false, error: "That could not be found." };
  const parsed = parseGuideEventInput(raw);
  if (!parsed.ok) return parsed;
  // The Host's id is read from the Guide's own grant row (the Guide may read their own grants).
  const { data: grant } = await supabase.from("coordination_guide_grants").select("host_id").eq("id", grantId).eq("guide_id", guideId).maybeSingle();
  const hostId = (grant as { host_id: string } | null)?.host_id;
  if (!hostId) return { ok: false, error: "That access could not be found." };
  const { error } = await supabase.from("coordination_guide_events").insert({
    grant_id: grantId,
    host_id: hostId,
    guide_id: guideId,
    item_id: itemId,
    kind: parsed.value.kind,
    body: parsed.value.body,
  });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true };
}

/** The author Guide withdraws one of their own records. It is stamped and stays; it is never erased. */
export async function withdrawGuideEvent(supabase: SupabaseClient, guideId: string, eventId: string): Promise<Result> {
  if (!isUuid(eventId)) return { ok: false, error: "That could not be found." };
  const { data, error } = await supabase
    .from("coordination_guide_events")
    .update({ withdrawn_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("guide_id", guideId)
    .select("id");
  if (error) return { ok: false, error: friendly(error) };
  if (!data || data.length === 0) return { ok: false, error: "That could not be found." };
  return { ok: true };
}
