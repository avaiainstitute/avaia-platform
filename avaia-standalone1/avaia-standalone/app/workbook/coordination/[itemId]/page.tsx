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

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

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

      <section className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <p className="label text-muted">Sharing</p>
        <p className="mt-1 text-sm text-ink">Not shared with anyone. Only you can see this.</p>
      </section>

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
