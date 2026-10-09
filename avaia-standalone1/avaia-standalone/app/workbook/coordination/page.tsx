import Link from "next/link";
import { redirect } from "next/navigation";
import {
  COORDINATE_FROM_LABEL,
  DELEGATION_LABEL,
  LIMITS,
  STATUS_LABEL,
  WAITING_ON_LABEL,
  isCoordinateFromField,
  isOverdue,
  parseCoordinationInput,
  sortForDisplay,
  summarizeItems,
  todayIso,
  type CoordinationItem,
} from "@/lib/coordination";
import {
  createCoordinationItem,
  listCoordinationItems,
  listPointerChoices,
  requireCoordinationHost,
  resolveSeedFromReferral,
} from "@/lib/ops/coordination";
import { isGuideCoordinationEnabled } from "@/lib/ops/coordination-guide";
import CoordinationFields from "./CoordinationFields";

export const metadata = { title: "Coordination, AVAIA" };
export const dynamic = "force-dynamic";

// COORDINATION (Workbook, Phase 1). Who is doing what, and what is waiting on whom. Every state on
// this page is the Host's own choice: AVAIA does not fill it in, score it, infer anyone's capacity,
// or share it. Nothing here is visible to anyone but the Host in this release.

function done(message: string, kind: "saved" | "error" = "saved"): never {
  redirect(`/workbook/coordination?${kind}=${encodeURIComponent(message)}`);
}

async function createAction(formData: FormData) {
  "use server";
  const { supabase, hostId } = await requireCoordinationHost("/workbook/coordination");
  const parsed = parseCoordinationInput(Object.fromEntries(formData));
  if (!parsed.ok) done(parsed.error, "error");
  const conversationId = String(formData.get("related_conversation_id") ?? "") || null;
  const referralId = String(formData.get("related_referral_id") ?? "") || null;
  const result = await createCoordinationItem(supabase, hostId, parsed.value, { conversationId, referralId });
  if (!result.ok) done(result.error, "error");
  redirect(`/workbook/coordination/${result.id}?saved=${encodeURIComponent("Added to your Coordination.")}`);
}

function ItemCard({ item, today }: { item: CoordinationItem; today: string }) {
  const overdue = isOverdue(item, today);
  const helper = [item.assigned_to_name, item.assigned_to_role].filter(Boolean).join(", ");
  const pro = [item.professional_name, item.professional_role].filter(Boolean).join(", ");
  return (
    <li className="rounded-lg border border-rule bg-white/[0.04] p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link href={`/workbook/coordination/${item.id}`} className="font-serif text-lg text-ink hover:text-seal">
          {item.title}
        </Link>
        <span className="flex flex-wrap gap-2">
          {item.kind === "decision" && <span className="label text-seal">Decision</span>}
          {item.category && <span className="label text-muted">{item.category}</span>}
        </span>
      </div>
      {item.delegation_state && <p className="mt-2 text-sm text-ink">{DELEGATION_LABEL[item.delegation_state]}</p>}
      {item.status === "waiting" && item.waiting_on && (
        <p className="mt-1 text-sm text-muted">
          Waiting on {WAITING_ON_LABEL[item.waiting_on].toLowerCase()}
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
      {item.due_date && (
        <p className={`mt-1 text-sm ${overdue ? "text-[#e0857d]" : "text-muted"}`}>
          {overdue ? "Past due " : "Due "}
          {new Date(`${item.due_date}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
        </p>
      )}
    </li>
  );
}

export default async function CoordinationPage({
  searchParams,
}: {
  searchParams: { saved?: string; error?: string; add?: string; field?: string; index?: string };
}) {
  const { supabase, hostId } = await requireCoordinationHost("/workbook/coordination");

  const [items, choices] = await Promise.all([listCoordinationItems(supabase, hostId), listPointerChoices(supabase, hostId)]);

  // "Add to Coordination" on one of the Host's own decisions or commitments: the text is read from
  // the stored referral on the server and only prefills a title the Host can change before saving.
  let seedNotice: string | null = null;
  let seedDefaults: Parameters<typeof CoordinationFields>[0]["defaults"] | undefined;
  let seedError: string | null = null;
  if (searchParams.add) {
    const seed = await resolveSeedFromReferral(supabase, hostId, searchParams.add, String(searchParams.field ?? ""), Number(searchParams.index));
    if (seed.ok) {
      seedDefaults = {
        kind: seed.seed.kind,
        title: seed.seed.text.slice(0, LIMITS.title),
        seedReferralId: seed.seed.referralId,
        seedConversationId: seed.seed.conversationId,
      };
      seedNotice = isCoordinateFromField(seed.seed.field) ? `${COORDINATE_FROM_LABEL[seed.seed.field]}: “${seed.seed.text}”` : null;
    } else {
      seedError = seed.error;
    }
  }

  const today = todayIso();
  const summary = summarizeItems(items, today);
  const open = sortForDisplay(items.filter((i) => i.status === "open"));
  const waiting = sortForDisplay(items.filter((i) => i.status === "waiting"));
  const closed = items.filter((i) => i.status === "closed").sort((a, b) => ((a.closed_at ?? "") < (b.closed_at ?? "") ? 1 : -1));
  const decisions = items.filter((i) => i.kind === "decision").map((i) => ({ id: i.id, title: i.title }));

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="mb-6">
        <Link href="/workbook" className="label hover:text-seal">
          ← Back to your Workbook
        </Link>
      </p>
      <p className="label mb-3">Your Workbook</p>
      <h1 className="font-serif text-4xl text-ink">Coordination</h1>
      <p className="mt-4 text-lg text-muted">
        Who is doing what, and what is waiting on whom. Every choice on this page is yours. AVAIA doesn&rsquo;t fill it in, judge it,
        or share it. {isGuideCoordinationEnabled() ? "Only you can see it unless you choose to give a Guide access." : "Right now, only you can see it."}
      </p>
      {isGuideCoordinationEnabled() && (
        <p className="mt-3">
          <Link href="/workbook/coordination/guide" className="text-sm text-muted underline-offset-2 hover:text-seal hover:underline">
            Guide access
          </Link>
        </p>
      )}

      {searchParams.saved && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">{searchParams.saved}</p>
      )}
      {(searchParams.error || seedError) && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          {searchParams.error ?? seedError}
        </p>
      )}

      <details id="new" open={!!seedDefaults || items.length === 0} className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <summary className="cursor-pointer font-serif text-xl text-ink">Add something</summary>
        {seedNotice && (
          <p className="mt-4 border-l-2 border-seal/50 pl-4 font-serif italic leading-relaxed text-ink">{seedNotice}</p>
        )}
        <form action={createAction} className="mt-5">
          <CoordinationFields defaults={seedDefaults} choices={choices} decisions={decisions} idPrefix="new" />
          <button
            type="submit"
            className="mt-6 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Add
          </button>
        </form>
      </details>

      {items.length === 0 ? (
        <p className="mt-10 text-muted">Nothing here yet. Add the first thing you&rsquo;re carrying or deciding.</p>
      ) : (
        <>
          <p className="label mt-10 text-muted">
            {summary.open} {STATUS_LABEL.open.toLowerCase()} · {summary.waiting} {STATUS_LABEL.waiting.toLowerCase()} · {summary.closed}{" "}
            {STATUS_LABEL.closed.toLowerCase()}
            {summary.overdue > 0 ? ` · ${summary.overdue} past due` : ""}
          </p>

          {open.length > 0 && (
            <section className="mt-6">
              <h2 className="font-serif text-2xl text-ink">Open</h2>
              <ul className="mt-3 space-y-3">
                {open.map((i) => (
                  <ItemCard key={i.id} item={i} today={today} />
                ))}
              </ul>
            </section>
          )}

          {waiting.length > 0 && (
            <section className="mt-8">
              <h2 className="font-serif text-2xl text-ink">Waiting</h2>
              <ul className="mt-3 space-y-3">
                {waiting.map((i) => (
                  <ItemCard key={i.id} item={i} today={today} />
                ))}
              </ul>
            </section>
          )}

          {closed.length > 0 && (
            <details className="mt-8">
              <summary className="cursor-pointer font-serif text-2xl text-ink">Closed ({closed.length})</summary>
              <ul className="mt-3 space-y-3">
                {closed.map((i) => (
                  <ItemCard key={i.id} item={i} today={today} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
