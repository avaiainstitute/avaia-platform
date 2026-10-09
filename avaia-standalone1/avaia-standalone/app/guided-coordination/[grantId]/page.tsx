import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  DELEGATION_LABEL,
  STATUS_LABEL,
  WAITING_ON_LABEL,
  isDelegationState,
  isWaitingOn,
  isUuid,
} from "@/lib/coordination";
import { ENTRY_TYPE_LABEL, GOVERNING_STATEMENT, SOURCE_LABEL, isEntryType } from "@/lib/coordination-entries";
import {
  GUIDE_EVENT_KINDS,
  GUIDE_EVENT_LABEL_FOR_GUIDE,
  GUIDE_LIMITS,
  HANDOFF_STATUS_LABEL,
  handoffRoleLabel,
  type GuideView,
  type GuideViewItem,
} from "@/lib/coordination-guide";
import { getGuideView, recordGuideEvent, withdrawGuideEvent } from "@/lib/ops/coordination-guide";

export const metadata = { title: "Guide coordination, AVAIA" };
export const dynamic = "force-dynamic";

// ONE HOST'S CHOSEN ITEMS (Guide coordination, Phase 4). Everything here comes from one database function that
// returns only what the Host ticked, and only while the Host's grant is live and this Guide is currently
// eligible. The Guide can record their own notes and follow-up marks; nothing here changes anything the Host
// owns. Everything the Guide records is labelled as the Guide's, and is never the Host's words.

async function recordAction(formData: FormData) {
  "use server";
  const grantId = String(formData.get("grantId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=/guided-coordination/${grantId}`);
  const result = await recordGuideEvent(supabase, user.id, grantId, itemId, Object.fromEntries(formData));
  redirect(`/guided-coordination/${grantId}?${result.ok ? "saved" : "error"}=${encodeURIComponent(result.ok ? "Recorded." : result.error)}#item-${itemId}`);
}

async function withdrawAction(formData: FormData) {
  "use server";
  const grantId = String(formData.get("grantId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=/guided-coordination/${grantId}`);
  const result = await withdrawGuideEvent(supabase, user.id, String(formData.get("eventId") ?? ""));
  redirect(`/guided-coordination/${grantId}?${result.ok ? "saved" : "error"}=${encodeURIComponent(result.ok ? "Withdrawn. It stays on record." : result.error)}#item-${itemId}`);
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtDue = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const SOURCE_TEXT = SOURCE_LABEL as Record<string, string>;

function ItemCard({ item, grantId }: { item: GuideViewItem; grantId: string }) {
  const helper = [item.assigned_to_name, item.assigned_to_role].filter(Boolean).join(", ");
  const pro = [item.professional_name, item.professional_role].filter(Boolean).join(", ");
  return (
    <li id={`item-${item.id}`} className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-serif text-xl text-ink">{item.title}</p>
        <span className="flex flex-wrap gap-2">
          {item.kind === "decision" && <span className="label text-seal">Decision</span>}
          <span className="label text-muted">{STATUS_LABEL[item.status]}</span>
          {item.category && <span className="label text-muted">{item.category}</span>}
        </span>
      </div>
      {item.delegation_state && <p className="mt-2 text-sm text-ink">{isDelegationState(item.delegation_state) ? DELEGATION_LABEL[item.delegation_state] : item.delegation_state}</p>}
      {item.status === "waiting" && item.waiting_on && (
        <p className="mt-1 text-sm text-muted">
          Waiting on {(isWaitingOn(item.waiting_on) ? WAITING_ON_LABEL[item.waiting_on] : item.waiting_on).toLowerCase()}
          {item.waiting_on_note ? `: ${item.waiting_on_note}` : ""}
        </p>
      )}
      {(helper || pro) && (
        <p className="mt-1 text-sm text-muted">
          {helper && <span>Helping: {helper}</span>}
          {helper && pro && <span> · </span>}
          {pro && <span>Professional: {pro}</span>}
        </p>
      )}
      {item.next_action && <p className="mt-1 text-sm text-ink">Next: {item.next_action}</p>}
      {item.due_date && <p className="mt-1 text-sm text-muted">Due {fmtDue(item.due_date)}</p>}
      {item.related_decision_title && <p className="mt-1 text-sm text-muted">Serves the decision: {item.related_decision_title}</p>}

      {item.entries.length > 0 && (
        <div className="mt-5">
          <p className="label text-muted">What the Host chose to show you from the record</p>
          <p className="mt-1 text-xs text-muted">The Host&rsquo;s own words, as they recorded them.</p>
          <ul className="mt-3 space-y-3">
            {item.entries.map((e) => (
              <li key={e.id} className="rounded-md border border-rule bg-white/[0.03] p-3">
                <p className="label text-seal">{isEntryType(e.entry_type) ? ENTRY_TYPE_LABEL[e.entry_type] : e.entry_type}</p>
                <p className="mt-1 text-xs text-muted">{SOURCE_TEXT[e.source_kind] ?? e.source_kind}</p>
                {e.withdrawn ? (
                  <p className="mt-2 text-sm text-muted">The Host withdrew this entry{e.withdrawn_at ? ` on ${fmt(e.withdrawn_at)}` : ""}. It is no longer shown.</p>
                ) : (
                  <>
                    <p className="mt-2 whitespace-pre-wrap border-l-2 border-seal/50 pl-4 font-serif italic leading-relaxed text-ink">{e.excerpt}</p>
                    {e.host_note && (
                      <p className="mt-2 text-sm text-ink">
                        <span className="text-muted">The Host&rsquo;s note: </span>
                        {e.host_note}
                      </p>
                    )}
                  </>
                )}
                <p className="mt-2 text-xs text-muted">Recorded {fmtTime(e.occurred_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.handoffs.length > 0 && (
        <div className="mt-5">
          <p className="label text-muted">Handed off</p>
          <ul className="mt-2 space-y-1">
            {item.handoffs.map((h, i) => (
              <li key={`${h.authorized_at}-${i}`} className="text-sm text-muted">
                A handoff to {handoffRoleLabel(h)} was shared {fmt(h.authorized_at)} · {HANDOFF_STATUS_LABEL[h.status]}
                {h.status === "active" ? ` until ${fmt(h.expires_at)}` : ""} · {h.viewed ? "viewed" : "not viewed yet"}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">This is only the fact that a handoff happened. You do not see what was in it.</p>
        </div>
      )}

      <div className="mt-6 border-t border-rule pt-5">
        <p className="label text-muted">What you have recorded here</p>
        {item.events.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {item.events.map((ev) => (
              <li key={ev.id} className={`rounded-md border p-3 ${ev.withdrawn_at ? "border-dashed border-rule opacity-70" : "border-rule bg-white/[0.03]"}`}>
                <p className="label text-seal">
                  {GUIDE_EVENT_LABEL_FOR_GUIDE[ev.kind]}
                  {ev.withdrawn_at ? " · withdrawn" : ""}
                </p>
                {ev.body && <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{ev.body}</p>}
                <p className="mt-1 text-xs text-muted">
                  {fmtTime(ev.created_at)}
                  {ev.kind === "flag_attention" ? (ev.acknowledged_at ? ` · the Host has seen it (${fmt(ev.acknowledged_at)})` : " · the Host has not seen it yet") : ""}
                </p>
                {!ev.withdrawn_at && (
                  <form action={withdrawAction} className="mt-2">
                    <input type="hidden" name="grantId" value={grantId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="eventId" value={ev.id} />
                    <button type="submit" className="text-xs text-muted underline-offset-2 hover:text-seal hover:underline">
                      Withdraw (it stays on record)
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        <form action={recordAction} className="mt-4">
          <input type="hidden" name="grantId" value={grantId} />
          <input type="hidden" name="itemId" value={item.id} />
          <label className="label mb-2 block" htmlFor={`kind-${item.id}`}>
            Record
          </label>
          <select
            id={`kind-${item.id}`}
            name="kind"
            required
            defaultValue=""
            className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          >
            <option value="" disabled>
              Choose what you are recording
            </option>
            {GUIDE_EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {GUIDE_EVENT_LABEL_FOR_GUIDE[k]}
              </option>
            ))}
          </select>
          <label className="label mb-2 mt-4 block" htmlFor={`body-${item.id}`}>
            Your words (needed for a note or a flag)
          </label>
          <textarea
            id={`body-${item.id}`}
            name="body"
            rows={3}
            maxLength={GUIDE_LIMITS.body}
            className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          />
          <p className="mt-2 text-xs text-muted">
            This is recorded as yours, with the date. It does not change the Host&rsquo;s status, waiting-on, next action, due date or anything else of theirs.
          </p>
          <button
            type="submit"
            className="mt-3 rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:border-seal"
          >
            Save
          </button>
        </form>
      </div>
    </li>
  );
}

export default async function GuidedCoordinationHostPage({
  params,
  searchParams,
}: {
  params: { grantId: string };
  searchParams: { saved?: string; error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=/guided-coordination/${params.grantId}`);

  const view: GuideView | null = isUuid(params.grantId) ? await getGuideView(supabase, params.grantId) : null;

  if (!view) {
    return (
      <div>
        <p className="mb-6">
          <Link href="/guided-coordination" className="label hover:text-seal">
            ← Back to Guide coordination
          </Link>
        </p>
        <h1 className="font-serif text-4xl text-ink">This isn&rsquo;t available</h1>
        <p className="mt-4 text-lg text-muted">This access has ended, or is not one you currently hold.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-6">
        <Link href="/guided-coordination" className="label hover:text-seal">
          ← Back to Guide coordination
        </Link>
      </p>
      <p className="label mb-3">Coordination for</p>
      <h1 className="font-serif text-4xl text-ink">{view.grant.host_label}</h1>
      <p className="mt-3 text-sm text-muted">You can see this until {fmt(view.grant.ends_at)}. The Host can end it sooner.</p>

      {searchParams.saved && <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">{searchParams.saved}</p>}
      {searchParams.error && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">{searchParams.error}</p>
      )}

      {view.items.length === 0 ? (
        <p className="mt-10 text-muted">The Host has not chosen anything for you to see yet.</p>
      ) : (
        <ul className="mt-8 space-y-6">
          {view.items.map((item) => (
            <ItemCard key={item.id} item={item} grantId={view.grant.id} />
          ))}
        </ul>
      )}

      <p className="mt-10 border-t border-rule pt-5 text-xs text-muted">{GOVERNING_STATEMENT}</p>
    </div>
  );
}
