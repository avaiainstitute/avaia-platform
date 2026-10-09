import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  DELEGATION_LABEL,
  STATUS_LABEL,
  isOverdue,
  isUuid,
  parseCoordinationInput,
  todayIso,
} from "@/lib/coordination";
import {
  getCoordinationItem,
  listCoordinationItems,
  listPointerChoices,
  requireCoordinationHost,
  setCoordinationStatus,
  updateCoordinationItem,
} from "@/lib/ops/coordination";
import CoordinationFields from "../CoordinationFields";
import {
  ENTRY_TYPE_LABEL,
  GOVERNING_STATEMENT,
  SOURCE_LABEL,
  buildTimeline,
  positionOverTime,
  sameMoment,
  type CoordinationEntry,
} from "@/lib/coordination-entries";
import { listEntriesForItem, setEntryWithdrawn } from "@/lib/ops/coordination-entries";
import HandoffView from "@/components/HandoffView";
import {
  EMAIL_STATUS_LABEL,
  SHARE_STATUS_LABEL,
  includesWithdrawnEntry,
  roleDisplay,
  shareStatus,
  type CoordinationShare,
} from "@/lib/coordination-shares";
import { isSharingEnabled, listSharesForItem, revokeShare } from "@/lib/ops/coordination-shares";
import {
  GUIDE_EVENT_LABEL_FOR_HOST,
  grantStatus,
  isGuideEventKind,
  type GuideEvent,
  type GuideGrant,
  type GuideScopeRow,
} from "@/lib/coordination-guide";
import {
  acknowledgeGuideFlag,
  guideNames,
  isGuideCoordinationEnabled,
  listGrants,
  listGuideEvents,
  listScope,
} from "@/lib/ops/coordination-guide";

export const metadata = { title: "Coordination item, AVAIA" };
export const dynamic = "force-dynamic";

// One coordination item. Every state here is the Host's own choice; nothing is inferred, scored or
// shared. There is no delete in this release: an item is closed, and can be reopened.

function back(itemId: string, message: string, kind: "saved" | "error" = "saved"): never {
  redirect(`/workbook/coordination/${itemId}?${kind}=${encodeURIComponent(message)}`);
}

async function updateAction(formData: FormData) {
  "use server";
  const itemId = String(formData.get("itemId") ?? "");
  const { supabase, hostId } = await requireCoordinationHost(`/workbook/coordination/${itemId}`);
  if (!isUuid(itemId)) redirect("/workbook/coordination");
  const parsed = parseCoordinationInput(Object.fromEntries(formData));
  if (!parsed.ok) back(itemId, parsed.error, "error");
  const conversationId = String(formData.get("related_conversation_id") ?? "") || null;
  const referralId = String(formData.get("related_referral_id") ?? "") || null;
  const result = await updateCoordinationItem(supabase, hostId, itemId, parsed.value, { conversationId, referralId });
  if (!result.ok) back(itemId, result.error, "error");
  back(itemId, "Saved.");
}

async function closeAction(formData: FormData) {
  "use server";
  const itemId = String(formData.get("itemId") ?? "");
  const { supabase, hostId } = await requireCoordinationHost(`/workbook/coordination/${itemId}`);
  const result = await setCoordinationStatus(supabase, hostId, itemId, "closed");
  if (!result.ok) back(itemId, result.error, "error");
  back(itemId, "Closed. You can reopen it any time.");
}

async function reopenAction(formData: FormData) {
  "use server";
  const itemId = String(formData.get("itemId") ?? "");
  const { supabase, hostId } = await requireCoordinationHost(`/workbook/coordination/${itemId}`);
  const result = await setCoordinationStatus(supabase, hostId, itemId, "open");
  if (!result.ok) back(itemId, result.error, "error");
  back(itemId, "Reopened.");
}

// Withdraw, never erase: an entry in the decision record is taken out of active use, and can be
// restored. It is never rewritten or deleted; the database stamps the time and refuses anything else.
async function withdrawAction(formData: FormData) {
  "use server";
  const itemId = String(formData.get("itemId") ?? "");
  const { supabase, hostId } = await requireCoordinationHost(`/workbook/coordination/${itemId}`);
  const result = await setEntryWithdrawn(supabase, hostId, String(formData.get("entryId") ?? ""), true);
  const message = result.ok ? "Withdrawn from active use. It stays in the record, and you can restore it." : result.error;
  redirect(`/workbook/coordination/${itemId}?${result.ok ? "saved" : "error"}=${encodeURIComponent(message)}#record`);
}

async function restoreAction(formData: FormData) {
  "use server";
  const itemId = String(formData.get("itemId") ?? "");
  const { supabase, hostId } = await requireCoordinationHost(`/workbook/coordination/${itemId}`);
  const result = await setEntryWithdrawn(supabase, hostId, String(formData.get("entryId") ?? ""), false);
  const message = result.ok ? "Restored to active use." : result.error;
  redirect(`/workbook/coordination/${itemId}?${result.ok ? "saved" : "error"}=${encodeURIComponent(message)}#record`);
}

// Revoke a share. This stops future access and cannot be undone; it does not recall anything the recipient
// already read, copied, saved or printed. The share and its frozen copy stay in the history, never deleted.
async function revokeAction(formData: FormData) {
  "use server";
  const itemId = String(formData.get("itemId") ?? "");
  const { supabase, hostId } = await requireCoordinationHost(`/workbook/coordination/${itemId}`);
  if (formData.get("confirm") !== "on") {
    redirect(`/workbook/coordination/${itemId}?error=${encodeURIComponent("Tick the box to confirm before revoking.")}#share`);
  }
  const result = await revokeShare(supabase, hostId, String(formData.get("shareId") ?? ""));
  const message = result.ok ? "Access revoked. The link no longer works." : result.error;
  redirect(`/workbook/coordination/${itemId}?${result.ok ? "saved" : "error"}=${encodeURIComponent(message)}#share`);
}

// The Host acknowledges a flag a Guide raised. This only marks that the Host has seen it; it changes nothing else.
async function acknowledgeAction(formData: FormData) {
  "use server";
  const itemId = String(formData.get("itemId") ?? "");
  const { supabase, hostId } = await requireCoordinationHost(`/workbook/coordination/${itemId}`);
  const result = await acknowledgeGuideFlag(supabase, hostId, String(formData.get("eventId") ?? ""));
  const message = result.ok ? "Marked as seen." : result.error;
  redirect(`/workbook/coordination/${itemId}?${result.ok ? "saved" : "error"}=${encodeURIComponent(message)}#guide`);
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const fmtTime =(iso: string) =>
  new Date(iso).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** One entry, shown as it was recorded: the Host's own words, how they were chosen, when they were
 *  said and when they were added. Nothing generated, nothing interpreted. */
function EntryBody({ entry }: { entry: CoordinationEntry }) {
  const written = entry.source_kind === "host_note";
  return (
    <div>
      <p className="label text-seal">{ENTRY_TYPE_LABEL[entry.entry_type]}</p>
      <p className="mt-1 text-xs text-muted">
        {SOURCE_LABEL[entry.source_kind]}
        {entry.source_kind === "room_message" && entry.room_label ? `: ${entry.room_label}` : ""}
      </p>
      <p className="mt-2 whitespace-pre-wrap border-l-2 border-seal/50 pl-4 font-serif italic leading-relaxed text-ink">{entry.excerpt}</p>
      {entry.host_note && (
        <p className="mt-2 text-sm text-ink">
          <span className="text-muted">Your note: </span>
          {entry.host_note}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        {written ? `Written ${fmtTime(entry.occurred_at)}` : `Said ${fmtTime(entry.occurred_at)}`}
        {!written && !sameMoment(entry.occurred_at, entry.created_at) ? ` · Added to your record ${fmt(entry.created_at)}` : ""}
        {entry.present_note ? ` · ${entry.present_note}` : ""}
      </p>
    </div>
  );
}

function EntryActions({ entry, itemId }: { entry: CoordinationEntry; itemId: string }) {
  return (
    <form action={entry.withdrawn_at ? restoreAction : withdrawAction} className="mt-2">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="entryId" value={entry.id} />
      <button type="submit" className="text-xs text-muted underline-offset-2 hover:text-seal hover:underline">
        {entry.withdrawn_at ? "Restore to active use" : "Withdraw from active use"}
      </button>
    </form>
  );
}

export default async function CoordinationItemPage({
  params,
  searchParams,
}: {
  params: { itemId: string };
  searchParams: { saved?: string; error?: string };
}) {
  const { supabase, hostId } = await requireCoordinationHost(`/workbook/coordination/${params.itemId}`);
  const item = await getCoordinationItem(supabase, hostId, params.itemId);
  if (!item) notFound();

  const [all, choices] = await Promise.all([listCoordinationItems(supabase, hostId), listPointerChoices(supabase, hostId)]);
  const decisions = all.filter((i) => i.kind === "decision" && i.id !== item.id).map((i) => ({ id: i.id, title: i.title }));
  const overdue = isOverdue(item, todayIso());

  // The decision record, only for a decision. Both the position view and the timeline are built from
  // the entries that really exist (and the item itself); nothing is generated or stored separately.
  let entries: CoordinationEntry[] = [];
  let entriesFailed = false;
  if (item.kind === "decision") {
    try {
      entries = await listEntriesForItem(supabase, hostId, item.id);
    } catch {
      // Say so plainly: an empty list here would wrongly read as an empty record.
      entriesFailed = true;
    }
  }
  const position = positionOverTime(entries);
  // Share history: the Host's own shares of this item. A failed read is said plainly, never shown as empty.
  let shares: CoordinationShare[] = [];
  let sharesFailed = false;
  try {
    shares = await listSharesForItem(supabase, hostId, item.id);
  } catch {
    sharesFailed = true;
  }
  const sharingOpen = isSharingEnabled();
  const now = new Date();

  // Guide access (Phase 4): the Host's own grants, what they chose to include, and every record a Guide made on
  // this item. The Host always sees all of it, in a lane marked as the Guide's. A failed read is said plainly.
  let guideGrants: GuideGrant[] = [];
  let guideScope: GuideScopeRow[] = [];
  let guideEvents: GuideEvent[] = [];
  let guideNameById = new Map<string, string>();
  let guideFailed = false;
  try {
    [guideGrants, guideScope, guideEvents] = await Promise.all([listGrants(supabase, hostId), listScope(supabase, hostId), listGuideEvents(supabase, hostId, item.id)]);
    guideNameById = await guideNames(supabase, guideGrants.map((g) => g.guide_id));
  } catch {
    guideFailed = true;
  }
  const guideOpen = isGuideCoordinationEnabled();
  const grantById = new Map(guideGrants.map((g) => [g.id, g]));
  const guideLabelFor = (grantId: string) => {
    const g = grantById.get(grantId);
    return g ? guideNameById.get(g.guide_id) ?? "Your Guide" : "Your Guide";
  };
  const itemScopeRows = guideScope.filter((s) => s.item_id === item.id && s.entry_id === null);
  const grantsForItem = guideGrants.filter((g) => itemScopeRows.some((s) => s.grant_id === g.id));
  const visibleNow = grantsForItem.filter((g) => grantStatus(g, now) === "active" && itemScopeRows.some((s) => s.grant_id === g.id && s.removed_at === null));

  const timeline =
    item.kind === "decision"
      ? buildTimeline(
          item,
          entries,
          shares.map((s) => ({
            id: s.id,
            recipientLabel: `${s.recipient_name} (${roleDisplay(s.recipient_role, s.recipient_role_label)})`,
            authorized_at: s.authorized_at,
            expires_at: s.expires_at,
            revoked_at: s.revoked_at,
            first_viewed_at: s.first_viewed_at,
          })),
          now,
          {
            grants: grantsForItem.map((g) => ({
              id: g.id,
              guideLabel: guideLabelFor(g.id),
              granted_at: g.granted_at,
              ends_at: g.ends_at,
              revoked_at: g.revoked_at,
            })),
            events: guideEvents.map((ev) => ({
              id: ev.id,
              guideLabel: guideLabelFor(ev.grant_id),
              kind: ev.kind,
              body: ev.body,
              created_at: ev.created_at,
              withdrawn_at: ev.withdrawn_at,
              acknowledged_at: ev.acknowledged_at,
            })),
          }
        )
      : [];

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="mb-6">
        <Link href="/workbook/coordination" className="label hover:text-seal">
          ← Back to Coordination
        </Link>
      </p>
      <p className="label mb-3">
        {STATUS_LABEL[item.status]}
        {item.kind === "decision" ? " · A decision you are working through" : ""}
        {overdue ? " · Past due" : ""}
      </p>
      <h1 className="font-serif text-4xl text-ink">{item.title}</h1>
      {item.delegation_state && <p className="mt-4 text-lg text-ink">{DELEGATION_LABEL[item.delegation_state]}</p>}

      {searchParams.saved && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">{searchParams.saved}</p>
      )}
      {searchParams.error && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">{searchParams.error}</p>
      )}

      <section id="share" className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <p className="label text-muted">Sharing</p>
        {shares.length === 0 && !sharesFailed && <p className="mt-1 text-sm text-ink">Not shared with anyone. Only you can see this.</p>}
        {shares.length > 0 && (
          <p className="mt-1 text-sm text-ink">
            Shared {shares.length === 1 ? "once" : `${shares.length} times`}. Each share is a frozen copy exactly as you approved it, and it stays here even after it ends.
          </p>
        )}
        {sharesFailed && (
          <p className="mt-3 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
            Your sharing history could not be loaded just now, so what you see here may be incomplete. Please try again.
          </p>
        )}
        {sharingOpen && (
          <p className="mt-4">
            <Link
              href={`/workbook/coordination/${item.id}/share`}
              className="inline-block rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:border-seal"
            >
              Share with someone
            </Link>
          </p>
        )}

        {shares.length > 0 && (
          <ul className="mt-5 space-y-4">
            {shares.map((s) => {
              const status = shareStatus(s, now);
              const role = roleDisplay(s.recipient_role, s.recipient_role_label);
              return (
                <li key={s.id} className="rounded-lg border border-rule bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-serif text-lg text-ink">
                      {s.recipient_name} <span className="text-muted">({role})</span>
                    </p>
                    <span className={`label ${status === "active" ? "text-seal" : "text-muted"}`}>{SHARE_STATUS_LABEL[status]}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {s.recipient_email} · Shared {fmt(s.authorized_at)} · Until {fmt(s.expires_at)}
                    {s.revoked_at ? ` · Revoked ${fmt(s.revoked_at)}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {EMAIL_STATUS_LABEL[s.email_status]} ·{" "}
                    {s.first_viewed_at && s.last_viewed_at
                      ? `Viewed: first ${fmtTime(s.first_viewed_at)}, last ${fmtTime(s.last_viewed_at)}, ${s.view_count} ${s.view_count === 1 ? "view" : "views"}`
                      : "Not viewed yet"}
                  </p>
                  {includesWithdrawnEntry(s, entries) && (
                    <p className="mt-2 text-sm text-ink">
                      This share includes an entry you have since withdrawn from your active record. What was sent is unchanged.
                    </p>
                  )}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-muted">What was shared (the frozen copy, exactly as sent)</summary>
                    <div className="mt-3">
                      <HandoffView payload={s.payload} sharedByName={s.shared_by_name} authorizedAt={s.authorized_at} expiresAt={s.expires_at} />
                      <p className="mt-3 text-xs text-muted">What you authorized: {s.authorization_statement}</p>
                    </div>
                  </details>
                  {status === "active" && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-muted">Revoke access</summary>
                      <form action={revokeAction} className="mt-3">
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="shareId" value={s.id} />
                        <label className="flex cursor-pointer items-start gap-3 text-sm">
                          <input type="checkbox" name="confirm" className="mt-1" />
                          <span className="text-ink">
                            I understand that revoking stops future access, and that it does not recall anything {s.recipient_name} has already read, copied, saved or printed.
                          </span>
                        </label>
                        <button type="submit" className="mt-3 rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:border-seal">
                          Revoke access
                        </button>
                      </form>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {(guideOpen || guideFailed || visibleNow.length > 0 || guideEvents.length > 0) && (
        <section id="guide" className="mt-6 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          <p className="label text-muted">Your Guide</p>
          {guideFailed && (
            <p className="mt-3 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
              Your Guide access could not be loaded just now, so what you see here may be incomplete. Please try again.
            </p>
          )}
          {visibleNow.length > 0 ? (
            <p className="mt-1 text-sm text-ink">
              {visibleNow.map((g) => `${guideLabelFor(g.id)} can see this item until ${fmt(g.ends_at)}`).join("; ")}.
            </p>
          ) : (
            !guideFailed && <p className="mt-1 text-sm text-ink">No Guide can see this item.</p>
          )}
          {guideOpen && (
            <p className="mt-3">
              <Link
                href="/workbook/coordination/guide"
                className="inline-block rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:border-seal"
              >
                Manage Guide access
              </Link>
            </p>
          )}

          {guideEvents.length > 0 && (
            <ul className="mt-5 space-y-3">
              {guideEvents.map((ev) => (
                <li key={ev.id} className={`rounded-md border p-3 ${ev.withdrawn_at ? "border-dashed border-rule opacity-70" : "border-rule bg-white/[0.03]"}`}>
                  <p className="label text-seal">
                    Guide-authored · {guideLabelFor(ev.grant_id)}
                    {ev.withdrawn_at ? " · withdrawn by the Guide" : ""}
                  </p>
                  <p className="mt-1 text-sm text-ink">{GUIDE_EVENT_LABEL_FOR_HOST[ev.kind]}</p>
                  {ev.body && <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{ev.body}</p>}
                  <p className="mt-1 text-xs text-muted">
                    {fmtTime(ev.created_at)}
                    {ev.kind === "flag_attention" && ev.acknowledged_at ? ` · you marked it seen ${fmt(ev.acknowledged_at)}` : ""}
                  </p>
                  {ev.kind === "flag_attention" && !ev.acknowledged_at && !ev.withdrawn_at && (
                    <form action={acknowledgeAction} className="mt-2">
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="eventId" value={ev.id} />
                      <button type="submit" className="rounded-md border border-rule px-3 py-1.5 text-xs text-ink transition-colors hover:border-seal">
                        Mark as seen
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {guideEvents.length > 0 && (
            <p className="mt-3 text-xs text-muted">
              These are your Guide&rsquo;s records, not your words. They never change your item, your entries or anything you share.
            </p>
          )}
        </section>
      )}

      {item.kind === "decision" && (
        <section id="record" className="mt-10">
          <p className="label text-seal">Decision &amp; Capacity Continuity Record</p>
          <blockquote className="mt-3 border-l-2 border-seal/50 pl-4 font-serif italic leading-relaxed text-ink">{GOVERNING_STATEMENT}</blockquote>
          <p className="mt-4 text-sm text-muted">
            What you said and chose about this decision, in your own words, with the date. You choose what goes in. Nothing is written,
            compared or judged for you, and only you can see it.
          </p>
          <p className="mt-4">
            <Link
              href={`/workbook/coordination/${item.id}/entries/new`}
              className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
            >
              Add to the record
            </Link>
          </p>

          {entriesFailed && (
            <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
              The record could not be loaded just now, so what you see below may be incomplete. Please try again.
            </p>
          )}

          {position.length > 0 && (
            <div className="mt-8">
              <h2 className="font-serif text-2xl text-ink">Your stated position over time</h2>
              <p className="mt-1 text-sm text-muted">Only the entries you marked as what you wanted, or whether your position stayed the same or changed. Shown in the order they happened.</p>
              <ol className="mt-4 space-y-4">
                {position.map((e) => (
                  <li key={e.id} className="rounded-lg border border-rule bg-white/[0.04] p-4 backdrop-blur-sm">
                    <EntryBody entry={e} />
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-8">
            <h2 className="font-serif text-2xl text-ink">Timeline</h2>
            <p className="mt-1 text-sm text-muted">Built from what is actually recorded, in the order it happened. A withdrawn entry stays here, marked as withdrawn.</p>
            <ol className="mt-4 space-y-4">
              {timeline.map((ev, i) => {
                if (ev.kind === "item_added") {
                  return (
                    <li key={`added-${i}`} className="border-l-2 border-rule pl-4 text-sm text-muted">
                      <span className="text-ink">Added to your Coordination</span> · {fmt(ev.at)}
                    </li>
                  );
                }
                if (ev.kind === "item_closed") {
                  return (
                    <li key={`closed-${i}`} className="border-l-2 border-rule pl-4 text-sm text-muted">
                      <span className="text-ink">Closed</span> · {fmt(ev.at)}
                    </li>
                  );
                }
                if (ev.kind === "share_sent" || ev.kind === "share_viewed" || ev.kind === "share_revoked" || ev.kind === "share_expired") {
                  const text =
                    ev.kind === "share_sent"
                      ? `Shared with ${ev.recipientLabel}`
                      : ev.kind === "share_viewed"
                        ? `First viewed by ${ev.recipientLabel}`
                        : ev.kind === "share_revoked"
                          ? `Access revoked for ${ev.recipientLabel}`
                          : `Access expired for ${ev.recipientLabel}`;
                  return (
                    <li key={`${ev.kind}-${ev.shareId}`} className="border-l-2 border-seal/50 pl-4 text-sm text-muted">
                      <span className="text-ink">{text}</span> · {fmt(ev.at)}
                    </li>
                  );
                }
                if (ev.kind === "guide_granted" || ev.kind === "guide_revoked" || ev.kind === "guide_expired") {
                  const text =
                    ev.kind === "guide_granted"
                      ? `Guide access given to ${ev.guideLabel}`
                      : ev.kind === "guide_revoked"
                        ? `Guide access ended by you for ${ev.guideLabel}`
                        : `Guide access ended (time ran out) for ${ev.guideLabel}`;
                  return (
                    <li key={`${ev.kind}-${ev.grantId}`} className="border-l-2 border-[#8fb8e0]/60 pl-4 text-sm text-muted">
                      <span className="text-ink">{text}</span> · {fmt(ev.at)}
                    </li>
                  );
                }
                if (ev.kind === "guide_event") {
                  const g = ev.event;
                  const label = isGuideEventKind(g.kind) ? GUIDE_EVENT_LABEL_FOR_HOST[g.kind] : g.kind;
                  return (
                    <li key={`guide-event-${g.id}`} className="border-l-2 border-[#8fb8e0]/60 pl-4 text-sm text-muted">
                      <span className="text-ink">Guide-authored · {g.guideLabel}: {label}</span> · {fmt(ev.at)}
                      {g.withdrawn_at ? " · withdrawn by the Guide" : ""}
                    </li>
                  );
                }
                const e = ev.entry;
                return e.withdrawn_at ? (
                  <li key={e.id} className="rounded-lg border border-dashed border-rule p-4 opacity-70">
                    <p className="label text-muted">
                      {ENTRY_TYPE_LABEL[e.entry_type]} · withdrawn {e.withdrawn_at ? fmt(e.withdrawn_at) : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted">From {fmt(e.occurred_at)}. Not part of the active record.</p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted">Show what was recorded</summary>
                      <div className="mt-2">
                        <EntryBody entry={e} />
                      </div>
                    </details>
                    <EntryActions entry={e} itemId={item.id} />
                  </li>
                ) : (
                  <li key={e.id} className="rounded-lg border border-rule bg-white/[0.04] p-4 backdrop-blur-sm">
                    <EntryBody entry={e} />
                    <EntryActions entry={e} itemId={item.id} />
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}

      <form action={updateAction} className="mt-8">
        <input type="hidden" name="itemId" value={item.id} />
        <CoordinationFields defaults={item} choices={choices} decisions={decisions} idPrefix="edit" />
        <button
          type="submit"
          className="mt-6 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Save
        </button>
      </form>

      <section className="mt-10 border-t border-rule pt-6">
        {item.status === "closed" ? (
          <form action={reopenAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <p className="text-sm text-muted">Closed {item.closed_at ? fmt(item.closed_at) : ""}. Nothing is deleted.</p>
            <button type="submit" className="mt-3 rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:border-seal">
              Reopen
            </button>
          </form>
        ) : (
          <form action={closeAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <p className="text-sm text-muted">Closing keeps this in your Workbook and takes it off your open list.</p>
            <button type="submit" className="mt-3 rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:border-seal">
              Close this
            </button>
          </form>
        )}
        <p className="mt-6 text-xs text-muted">
          Added {fmt(item.created_at)} · Last changed {fmt(item.updated_at)}
        </p>
      </section>
    </div>
  );
}
