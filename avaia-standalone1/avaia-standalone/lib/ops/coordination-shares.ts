import "server-only";
import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { handoffInvitationEmailHtml, handoffInvitationSubject, sendEmail } from "@/lib/resend";
import { WAITING_ON_LABEL, isUuid, type WaitingOn } from "@/lib/coordination";
import { getCoordinationItem, isAdultHost } from "@/lib/ops/coordination";
import { listEntriesForItem } from "@/lib/ops/coordination-entries";
import {
  authorizationStatement,
  buildHandoffPayload,
  canonicalJson,
  expiryDateFor,
  formatLongDate,
  parseSharingFlag,
  parseShareInput,
  roleDisplay,
  waitingOnForRole,
  type CoordinationShare,
  type HandoffPayload,
  type ShareInput,
} from "@/lib/coordination-shares";

// SHARE WITH + PROFESSIONAL HANDOFF (the I/O side), Workbook Phase 3. See lib/coordination-shares.ts for
// the rules and supabase/migrations/0122_coordination_shares.sql for the database's own protections.
// Decisions 0008 and 0010.
//
// Privacy and integrity posture of this file:
//  * The Host sees the EXACT handoff before authorizing. The preview and the final share are built by the
//    same function from the same records, and authorization is refused if anything differs from what the
//    Host previewed (the preview hash).
//  * The browser sends only the Host's choices and their own typed words. Anything that has a source (an
//    entry, an item fact) is read here from the real record, never accepted from the browser.
//  * A Host cannot create a share directly (the table has no insert privilege for them). The share is
//    inserted here, by the server, after the Host's identity, adult status and ownership are re-checked,
//    and the database trigger verifies the content against the real entries a second time.
//  * The link token is 192 bits and is never stored: only its SHA-256 is. It is shown to the Host ONLY if
//    the email could not be sent, and never again.
//  * Recipients never touch a table. peek_handoff and open_handoff are narrow database functions.
//  * Nothing here is chosen by AI, and nothing is pre-selected on the Host's behalf.
//  * Outward sending is gated by COORDINATION_SHARING_ENABLED until the end-to-end flow is exercised.

type Result<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string };

type DbError = { code?: string; message?: string } | null | undefined;

/** The database's own plain-language refusals are safe to show; anything else gets a generic message. */
function friendly(error: DbError): string {
  if (error?.code === "P0001" && error.message) return error.message;
  if (error?.code === "23505") return "That could not be created. Please try again.";
  if (error?.code === "23514") return "One of those entries is not allowed.";
  return "That could not be saved. Please try again.";
}

/** The launch gate. Closed unless the environment switch is exactly "true". */
export function isSharingEnabled(): boolean {
  return parseSharingFlag(process.env.COORDINATION_SHARING_ENABLED);
}

/** A 192-bit link token, in the same form every existing AVAIA link uses. */
export function newShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://avaiainstitute.com";

const SHARE_COLUMNS =
  "id, host_id, item_id, title, shared_by_name, recipient_name, recipient_email, recipient_role, recipient_role_label, purpose, payload, payload_hash, entry_ids, authorization_statement, authorized_at, valid_days, expires_at, email_status, revoked_at, first_viewed_at, last_viewed_at, view_count";

/** The Host's own shares of one item, newest first. Never includes the token hash. */
export async function listSharesForItem(supabase: SupabaseClient, hostId: string, itemId: string): Promise<CoordinationShare[]> {
  if (!isUuid(itemId)) return [];
  const { data, error } = await supabase
    .from("coordination_shares")
    .select(SHARE_COLUMNS)
    .eq("host_id", hostId)
    .eq("item_id", itemId)
    .order("authorized_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CoordinationShare[];
}

export type SharePreview = {
  payload: HandoffPayload;
  statement: string;
  /** SHA-256 of the payload plus the statement. Authorization must present the same hash. */
  hash: string;
  expiresOn: string;
  recipientEmail: string;
  recipientRoleLabel: string;
  validDays: number;
  /** What "Waiting" would say, if the Host chooses to mark the item as waiting. */
  waitingLabel: string;
  waitingPossible: boolean;
};

type Prepared = {
  input: ShareInput;
  payload: HandoffPayload;
  statement: string;
  hash: string;
  expiresOn: string;
  itemStatus: string;
};

/** Builds the exact handoff from the real records and the Host's choices. Used by BOTH the preview and
 *  the authorization, so what is authorized is what was previewed. */
async function prepare(supabase: SupabaseClient, hostId: string, itemId: string, raw: unknown): Promise<Result<{ prepared: Prepared }>> {
  if (!isSharingEnabled()) return { ok: false, error: "Sharing isn't open yet." };
  if (!isUuid(itemId)) return { ok: false, error: "That item could not be found." };
  if (!(await isAdultHost(supabase, hostId))) return { ok: false, error: "Sharing is available to adult accounts in this release." };
  const item = await getCoordinationItem(supabase, hostId, itemId);
  if (!item) return { ok: false, error: "That item could not be found." };

  const parsed = parseShareInput(raw);
  if (!parsed.ok) return parsed;

  let entries: Awaited<ReturnType<typeof listEntriesForItem>> = [];
  if (item.kind === "decision" && parsed.value.entry_ids.length > 0) {
    try {
      entries = await listEntriesForItem(supabase, hostId, item.id);
    } catch {
      return { ok: false, error: "Your record could not be read just now. Please try again." };
    }
  }
  const built = buildHandoffPayload({ item, entries, input: parsed.value });
  if (!built.ok) return built;

  const expiresOn = expiryDateFor(parsed.value.valid_days);
  const statement = authorizationStatement({
    recipientName: parsed.value.recipient_name,
    role: roleDisplay(parsed.value.recipient_role, parsed.value.recipient_role_label),
    email: parsed.value.recipient_email,
    expiresOn,
  });
  const hash = sha256Hex(canonicalJson({ payload: built.payload, statement }));
  return { ok: true, prepared: { input: parsed.value, payload: built.payload, statement, hash, expiresOn, itemStatus: item.status } };
}

/** The preview: the exact recipient page, the statement, and a hash. Saves nothing and sends nothing. */
export async function previewShare(supabase: SupabaseClient, hostId: string, itemId: string, raw: unknown): Promise<Result<{ preview: SharePreview }>> {
  const r = await prepare(supabase, hostId, itemId, raw);
  if (!r.ok) return r;
  const { input, payload, statement, hash, expiresOn, itemStatus } = r.prepared;
  return {
    ok: true,
    preview: {
      payload,
      statement,
      hash,
      expiresOn,
      recipientEmail: input.recipient_email,
      recipientRoleLabel: roleDisplay(input.recipient_role, input.recipient_role_label),
      validDays: input.valid_days,
      waitingLabel: WAITING_ON_LABEL[waitingOnForRole(input.recipient_role)],
      waitingPossible: itemStatus !== "closed",
    },
  };
}

export type AuthorizeResult = {
  shareId: string;
  emailStatus: "sent" | "failed";
  expiresOn: string;
  recipientEmail: string;
  /** Only present when the email could not be sent: the one time the Host is shown the link. */
  link: string | null;
  waitingMarked: boolean;
};

/** The Host authorizes. Refused unless the content is exactly what they previewed. */
export async function authorizeShare(
  supabase: SupabaseClient,
  hostId: string,
  itemId: string,
  raw: unknown,
  expectedHash: string
): Promise<Result<{ result: AuthorizeResult }>> {
  const r = await prepare(supabase, hostId, itemId, raw);
  if (!r.ok) return r;
  const { input, payload, statement, hash, itemStatus } = r.prepared;
  if (typeof expectedHash !== "string" || hash !== expectedHash) {
    return { ok: false, error: "Something changed since your preview, so nothing was sent. Please review the preview again." };
  }

  const token = newShareToken();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coordination_shares")
    .insert({
      host_id: hostId,
      item_id: itemId,
      title: input.title,
      shared_by_name: input.shared_by_name,
      recipient_name: input.recipient_name,
      recipient_email: input.recipient_email,
      recipient_role: input.recipient_role,
      recipient_role_label: input.recipient_role_label || null,
      purpose: input.purpose,
      payload,
      payload_hash: sha256Hex(canonicalJson(payload)),
      payload_version: 1,
      entry_ids: payload.entries.map((e) => e.entry_id),
      authorization_statement: statement,
      valid_days: input.valid_days,
      // The database sets the real expiry from its own clock; this is only a placeholder it overwrites.
      expires_at: new Date().toISOString(),
      token_hash: sha256Hex(token),
    })
    .select("id, expires_at")
    .single();
  if (error || !data) return { ok: false, error: friendly(error) };
  const row = data as { id: string; expires_at: string };

  const url = `${siteUrl()}/handoff/${token}`;
  let emailStatus: "sent" | "failed" = "sent";
  try {
    await sendEmail({
      to: input.recipient_email,
      subject: handoffInvitationSubject(input.shared_by_name),
      html: handoffInvitationEmailHtml({ sharedByName: input.shared_by_name, url, expiresOn: formatLongDate(row.expires_at) }),
      context: "coordination_handoff",
    });
  } catch {
    // sendEmail has already recorded the failure centrally. The share exists; the Host is told.
    emailStatus = "failed";
  }
  await admin.from("coordination_shares").update({ email_status: emailStatus }).eq("id", row.id);

  // The Host's own choice, made in the authorization step: mark the item as waiting on the recipient.
  let waitingMarked = false;
  if (input.mark_waiting && itemStatus !== "closed") {
    const waitingOn: WaitingOn = waitingOnForRole(input.recipient_role);
    const { data: updated } = await supabase
      .from("coordination_items")
      .update({
        status: "waiting",
        waiting_on: waitingOn,
        waiting_on_note: `${input.recipient_name} (${roleDisplay(input.recipient_role, input.recipient_role_label)})`.slice(0, 500),
      })
      .eq("id", itemId)
      .eq("host_id", hostId)
      .select("id");
    waitingMarked = !!updated && updated.length > 0;
  }

  return {
    ok: true,
    result: {
      shareId: row.id,
      emailStatus,
      expiresOn: formatLongDate(row.expires_at),
      recipientEmail: input.recipient_email,
      link: emailStatus === "failed" ? url : null,
      waitingMarked,
    },
  };
}

/** Revoke a share. The database stamps the time, once, and it can never be undone. Revoking is never
 *  blocked by anything but ownership. */
export async function revokeShare(supabase: SupabaseClient, hostId: string, shareId: string): Promise<Result> {
  if (!isUuid(shareId)) return { ok: false, error: "That share could not be found." };
  const { data, error } = await supabase
    .from("coordination_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId)
    .eq("host_id", hostId)
    .select("id");
  if (error) return { ok: false, error: "That could not be revoked. Please try again." };
  if (!data || data.length === 0) return { ok: false, error: "That share could not be found." };
  return { ok: true };
}

// ---- Recipient access: narrow database functions only (the guardian-consent pattern) ---------------

/** The landing page: who shared it and when it ends. Records nothing. Null for any link that is
 *  unknown, expired or revoked (all identical). */
export async function peekHandoff(token: string): Promise<{ shared_by_name: string; expires_at: string } | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("peek_handoff", { p_token: token });
  if (error || !data) return null;
  return data as { shared_by_name: string; expires_at: string };
}

export type OpenedHandoff = { payload: HandoffPayload; shared_by_name: string; authorized_at: string; expires_at: string };

/** The View step: records the first actual view and returns the frozen copy. Null if unavailable. */
export async function openHandoff(token: string): Promise<OpenedHandoff | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("open_handoff", { p_token: token });
  if (error || !data) return null;
  return data as OpenedHandoff;
}
