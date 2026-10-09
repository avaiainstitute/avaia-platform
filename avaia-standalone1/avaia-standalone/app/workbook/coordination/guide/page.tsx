import Link from "next/link";
import { redirect } from "next/navigation";
import { STATUS_LABEL, type CoordinationItem } from "@/lib/coordination";
import { ENTRY_TYPE_LABEL } from "@/lib/coordination-entries";
import {
  GRANT_DAYS,
  GRANT_STATUS_LABEL,
  GUIDE_LIMITS,
  currentScope,
  grantStatus,
  guideGrantStatement,
  type GuideGrant,
  type GuideScopeRow,
} from "@/lib/coordination-guide";
import { listCoordinationItems, requireCoordinationHost } from "@/lib/ops/coordination";
import { listEntriesForItem } from "@/lib/ops/coordination-entries";
import {
  createGuideGrant,
  guideNames,
  isGuideCoordinationEnabled,
  listEligibleGuides,
  listGrants,
  listScope,
  revokeGuideGrant,
  updateGuideScope,
  type EligibleGuide,
} from "@/lib/ops/coordination-guide";

export const metadata = { title: "Guide access, AVAIA" };
export const dynamic = "force-dynamic";

// GUIDE ACCESS (Workbook, Phase 4). The Host gives one eligible Guide a time-limited, revocable window onto
// the items and entries they tick. Nothing is ticked for them, nothing is chosen by AI, and a Guide never
// sees the rest of the Workbook, the Journal or the Journey. Opening stays closed until
// COORDINATION_GUIDE_ENABLED is "true". Ending access is never closed.

const HERE = "/workbook/coordination/guide";

function done(message: string, kind: "saved" | "error" = "saved"): never {
  redirect(`${HERE}?${kind}=${encodeURIComponent(message)}`);
}

async function grantAction(formData: FormData) {
  "use server";
  const { supabase, hostId } = await requireCoordinationHost(HERE);
  if (formData.get("confirm") !== "on") done("Tick the box to authorize before continuing.", "error");
  const result = await createGuideGrant(supabase, hostId, {
    guide_id: String(formData.get("guide_id") ?? ""),
    host_label: String(formData.get("host_label") ?? ""),
    valid_days: String(formData.get("valid_days") ?? ""),
    item_ids: formData.getAll("item_ids").map(String),
    entry_ids: formData.getAll("entry_ids").map(String),
  });
  if (!result.ok) done(result.error, "error");
  done(
    `${result.result.guideName} has access until ${result.result.endsOn}.${
      result.result.emailSent ? " They were sent one email to tell them." : " The email to tell them could not be sent, so please let them know yourself."
    }`
  );
}

async function scopeAction(formData: FormData) {
  "use server";
  const { supabase, hostId } = await requireCoordinationHost(HERE);
  const result = await updateGuideScope(supabase, hostId, String(formData.get("grantId") ?? ""), {
    item_ids: formData.getAll("item_ids").map(String),
    entry_ids: formData.getAll("entry_ids").map(String),
  });
  if (!result.ok) done(result.error, "error");
  done("Updated what your Guide can see.");
}

// Ending access stops it at once and cannot be undone. It does not erase notes the Guide already recorded
// and does not recall anything they already read.
async function revokeAction(formData: FormData) {
  "use server";
  const { supabase, hostId } = await requireCoordinationHost(HERE);
  if (formData.get("confirm") !== "on") done("Tick the box to confirm before ending access.", "error");
  const result = await revokeGuideGrant(supabase, hostId, String(formData.get("grantId") ?? ""));
  if (!result.ok) done(result.error, "error");
  done("Access ended. Your Guide can no longer see anything.");
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

type EntryOption = { id: string; label: string };

/** The Host's choices: every item, and under a decision its active, non-Room entries. Nothing is ticked unless
 *  it is already part of this grant. */
function ScopeFields({
  items,
  entryOptions,
  scope,
}: {
  items: CoordinationItem[];
  entryOptions: Record<string, EntryOption[]>;
  scope?: { itemIds: Set<string>; entryIds: Set<string> };
}) {
  return (
    <ul className="mt-3 space-y-3">
      {items.map((i) => (
        <li key={i.id} className="rounded-md border border-rule bg-white/[0.03] p-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" name="item_ids" value={i.id} defaultChecked={scope?.itemIds.has(i.id) ?? false} className="mt-1" />
            <span className="text-ink">
              {i.title}
              <span className="text-muted">
                {" "}
                · {i.kind === "decision" ? "Decision · " : ""}
                {STATUS_LABEL[i.status]}
              </span>
            </span>
          </label>
          {(entryOptions[i.id] ?? []).length > 0 && (
            <div className="mt-2 border-l border-rule pl-6">
              <p className="text-xs text-muted">Entries from this decision (tick only the ones you want your Guide to read):</p>
              <ul className="mt-1 space-y-1">
                {(entryOptions[i.id] ?? []).map((e) => (
                  <li key={e.id}>
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <input type="checkbox" name="entry_ids" value={e.id} defaultChecked={scope?.entryIds.has(e.id) ?? false} className="mt-1" />
                      <span className="text-ink">{e.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function GuideAccessPage({ searchParams }: { searchParams: { saved?: string; error?: string } }) {
  const { supabase, hostId } = await requireCoordinationHost(HERE);
  const enabled = isGuideCoordinationEnabled();

  let grants: GuideGrant[] = [];
  let scopeRows: GuideScopeRow[] = [];
  let loadFailed = false;
  try {
    [grants, scopeRows] = await Promise.all([listGrants(supabase, hostId), listScope(supabase, hostId)]);
  } catch {
    loadFailed = true;
  }

  const items = await listCoordinationItems(supabase, hostId);
  const entryOptions: Record<string, EntryOption[]> = {};
  for (const decision of items.filter((i) => i.kind === "decision")) {
    try {
      const entries = await listEntriesForItem(supabase, hostId, decision.id);
      entryOptions[decision.id] = entries
        .filter((e) => e.withdrawn_at === null && e.source_kind !== "room_message")
        .map((e) => ({ id: e.id, label: `${ENTRY_TYPE_LABEL[e.entry_type]}: ${e.excerpt.length > 90 ? `${e.excerpt.slice(0, 90)}…` : e.excerpt}` }));
    } catch {
      entryOptions[decision.id] = [];
    }
  }

  let guides: EligibleGuide[] = [];
  let guidesFailed = false;
  if (enabled) {
    try {
      guides = await listEligibleGuides(supabase);
    } catch {
      guidesFailed = true;
    }
  }
  const names = await guideNames(supabase, grants.map((g) => g.guide_id));
  const now = new Date();

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="mb-6">
        <Link href="/workbook/coordination" className="label hover:text-seal">
          ← Back to Coordination
        </Link>
      </p>
      <p className="label mb-3">Your Workbook</p>
      <h1 className="font-serif text-4xl text-ink">Guide access</h1>
      <p className="mt-4 text-lg text-muted">
        You can let one Guide see the coordination items and entries you choose, for a time you choose, and end it whenever you want. They never see the
        rest of your Workbook, your Journal or your Journey, and they cannot change anything of yours. They can record their own notes and follow-ups,
        always labelled as theirs.
      </p>

      {searchParams.saved && <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">{searchParams.saved}</p>}
      {searchParams.error && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">{searchParams.error}</p>
      )}
      {loadFailed && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          Your Guide access could not be loaded just now, so what you see may be incomplete. Please try again.
        </p>
      )}

      {!enabled && grants.length === 0 && !loadFailed && (
        <div className="mt-8">
          <h2 className="font-serif text-2xl text-ink">Guide access isn&rsquo;t open yet</h2>
          <p className="mt-2 text-muted">Giving a Guide access to your coordination items is not available yet. Nothing has been shared.</p>
        </div>
      )}

      {grants.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-2xl text-ink">Your Guide access</h2>
          <ul className="mt-4 space-y-4">
            {grants.map((g) => {
              const status = grantStatus(g, now);
              const scope = currentScope(scopeRows, g.id);
              return (
                <li key={g.id} className="rounded-lg border border-rule bg-white/[0.04] p-4 backdrop-blur-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-serif text-lg text-ink">{names.get(g.guide_id) ?? "Your Guide"}</p>
                    <span className={`label ${status === "active" ? "text-seal" : "text-muted"}`}>{GRANT_STATUS_LABEL[status]}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Seen as &ldquo;{g.host_label}&rdquo; · From {fmt(g.granted_at)} · Until {fmt(g.ends_at)}
                    {g.revoked_at ? ` · Ended by you ${fmt(g.revoked_at)}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {status === "active"
                      ? `Can see ${scope.itemIds.size} ${scope.itemIds.size === 1 ? "item" : "items"} and ${scope.entryIds.size} ${scope.entryIds.size === 1 ? "entry" : "entries"}.`
                      : "Cannot see anything now."}
                  </p>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-muted">What you authorized</summary>
                    <p className="mt-2 text-xs text-muted">{g.authorization_statement}</p>
                  </details>

                  {status === "active" && enabled && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-muted">Change what they can see</summary>
                      <form action={scopeAction} className="mt-3">
                        <input type="hidden" name="grantId" value={g.id} />
                        <ScopeFields items={items} entryOptions={entryOptions} scope={scope} />
                        <button type="submit" className="mt-3 rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:border-seal">
                          Update
                        </button>
                      </form>
                    </details>
                  )}
                  {status === "active" && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-muted">End their access</summary>
                      <form action={revokeAction} className="mt-3">
                        <input type="hidden" name="grantId" value={g.id} />
                        <label className="flex cursor-pointer items-start gap-3 text-sm">
                          <input type="checkbox" name="confirm" className="mt-1" />
                          <span className="text-ink">
                            I understand that ending access stops it at once, and that it does not erase notes they have already recorded or recall anything they have already read.
                          </span>
                        </label>
                        <button type="submit" className="mt-3 rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:border-seal">
                          End access
                        </button>
                      </form>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {enabled && (
        <section className="mt-10">
          <h2 className="font-serif text-2xl text-ink">Give a Guide access</h2>
          {guidesFailed ? (
            <p className="mt-3 text-muted">The list of Guides could not be loaded just now. Please try again in a moment.</p>
          ) : guides.length === 0 ? (
            <p className="mt-3 text-muted">No Guide is available for coordination support yet.</p>
          ) : items.length === 0 ? (
            <p className="mt-3 text-muted">Add something to Coordination first. Then you can choose what a Guide may see.</p>
          ) : (
            <form action={grantAction} className="mt-4">
              <label className="label mb-2 block" htmlFor="guide_id">
                Which Guide
              </label>
              <select
                id="guide_id"
                name="guide_id"
                required
                defaultValue=""
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              >
                <option value="" disabled>
                  Choose a Guide
                </option>
                {guides.map((g) => (
                  <option key={g.guide_id} value={g.guide_id}>
                    {g.guide_display_name}
                  </option>
                ))}
              </select>

              <label className="label mb-2 mt-5 block" htmlFor="host_label">
                The name you want your Guide to see for you
              </label>
              <input
                id="host_label"
                name="host_label"
                type="text"
                required
                maxLength={GUIDE_LIMITS.hostLabel}
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />

              <label className="label mb-2 mt-5 block" htmlFor="valid_days">
                How long (days, {GRANT_DAYS.min} to {GRANT_DAYS.max})
              </label>
              <input
                id="valid_days"
                name="valid_days"
                type="number"
                min={GRANT_DAYS.min}
                max={GRANT_DAYS.max}
                defaultValue={GRANT_DAYS.default}
                required
                className="w-32 rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
              <p className="mt-2 text-xs text-muted">Access ends on its own at the end of this time. To continue, you give access again.</p>

              <p className="label mb-1 mt-6 text-muted">What your Guide may see</p>
              <p className="text-sm text-muted">Nothing is ticked for you. They see only what you tick, including the people you have named on those items.</p>
              <ScopeFields items={items} entryOptions={entryOptions} />

              <label className="mt-6 flex cursor-pointer items-start gap-3 border-t border-rule pt-5">
                <input type="checkbox" name="confirm" className="mt-1" required />
                <span className="text-sm text-ink">
                  {guideGrantStatement({ guideName: "[the Guide you chose]", endsOn: "[the end date]" })}
                </span>
              </label>
              <button
                type="submit"
                className="mt-4 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
              >
                Authorize
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
