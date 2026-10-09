import Link from "next/link";
import { notFound } from "next/navigation";
import ShareComposer, { type EntryOption, type FactOption } from "@/components/ShareComposer";
import { ENTRY_TYPE_LABEL, SOURCE_LABEL } from "@/lib/coordination-entries";
import { availableFacts, type ShareInput } from "@/lib/coordination-shares";
import { getCoordinationItem, requireCoordinationHost } from "@/lib/ops/coordination";
import { listEntriesForItem } from "@/lib/ops/coordination-entries";
import { authorizeShare, isSharingEnabled, previewShare } from "@/lib/ops/coordination-shares";

export const metadata = { title: "Share, AVAIA" };
export const dynamic = "force-dynamic";

// SHARE WITH (Workbook, Phase 3). The Host chooses exactly what goes in, previews exactly what the
// recipient will see, and authorizes. The recipient gets a frozen, read-only copy by secure link. Nothing
// is pre-selected, nothing is chosen by AI, and nothing here reads the Journal, a Room or the rest of the
// Workbook. Outward sending stays closed until COORDINATION_SHARING_ENABLED is "true".

export default async function SharePage({ params }: { params: { itemId: string } }) {
  const itemId = params.itemId;
  const here = `/workbook/coordination/${itemId}/share`;
  const { supabase, hostId } = await requireCoordinationHost(here);
  const item = await getCoordinationItem(supabase, hostId, itemId);
  if (!item) notFound();

  // The Host's own server actions. Each one re-checks who is asking before it does anything.
  async function previewAction(input: ShareInput) {
    "use server";
    const host = await requireCoordinationHost(here);
    return previewShare(host.supabase, host.hostId, itemId, input);
  }
  async function authorizeAction(input: ShareInput, hash: string) {
    "use server";
    const host = await requireCoordinationHost(here);
    return authorizeShare(host.supabase, host.hostId, itemId, input, hash);
  }

  const back = (
    <p className="mb-6">
      <Link href={`/workbook/coordination/${item.id}`} className="label hover:text-seal">
        ← Back to this item
      </Link>
    </p>
  );

  if (!isSharingEnabled()) {
    return (
      <div className="mx-auto max-w-prose px-5 py-16">
        {back}
        <h1 className="font-serif text-4xl text-ink">Sharing isn&rsquo;t open yet</h1>
        <p className="mt-4 text-lg text-muted">Sharing something from your Workbook with another person is not available yet. Nothing has been shared.</p>
      </div>
    );
  }

  let entryOptions: EntryOption[] = [];
  let hasRoomEntries = false;
  let entriesFailed = false;
  if (item.kind === "decision") {
    try {
      const all = await listEntriesForItem(supabase, hostId, item.id);
      // Withdrawn entries are never offered, and Shared Room words can't be shared outside AVAIA.
      const active = all.filter((e) => e.withdrawn_at === null);
      hasRoomEntries = active.some((e) => e.source_kind === "room_message");
      entryOptions = active
        .filter((e) => e.source_kind !== "room_message")
        .map((e) => ({
          id: e.id,
          entry_type_label: ENTRY_TYPE_LABEL[e.entry_type],
          source_label: SOURCE_LABEL[e.source_kind],
          occurred_at: e.occurred_at,
          excerpt: e.excerpt,
          host_note: e.host_note,
        }));
    } catch {
      entriesFailed = true;
    }
  }
  const factOptions: FactOption[] = availableFacts(item).map((f) => ({ key: f.key, label: f.label, value: f.value }));

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      {back}
      <p className="label mb-3">Share with someone</p>
      <h1 className="font-serif text-4xl text-ink">{item.title}</h1>
      <p className="mt-4 text-muted">
        You choose exactly what goes in, you see exactly what they will see, and nothing is sent until you authorize it. They get a read-only copy
        that does not change, through a link that ends. They do not get an account, and they cannot see anything else in your Workbook.
      </p>

      {entriesFailed ? (
        <p className="mt-8 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          Your record could not be read just now, so sharing is paused. Please try again in a moment.
        </p>
      ) : (
        <div className="mt-8">
          <ShareComposer
            itemId={item.id}
            defaultTitle={item.title}
            facts={factOptions}
            entries={entryOptions}
            hasRoomEntries={hasRoomEntries}
            isDecision={item.kind === "decision"}
            previewAction={previewAction}
            authorizeAction={authorizeAction}
          />
        </div>
      )}
    </div>
  );
}
