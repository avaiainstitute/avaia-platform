import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { STAGE_LABEL } from "@/lib/engine/conversation";
import type { Stage } from "@/lib/engine/prompts";
import { HOST_VOICE_LABEL } from "@/lib/kept-items";
import { isUuid } from "@/lib/coordination";
import { ENTRY_LIMITS, ENTRY_TYPES, ENTRY_TYPE_LABEL, parseEntryInput, parseNoteText } from "@/lib/coordination-entries";
import { getCoordinationItem, listPointerChoices, requireCoordinationHost } from "@/lib/ops/coordination";
import {
  addConversationMessageEntry,
  addHostNoteEntry,
  addReferralFieldEntry,
  addRoomMessageEntry,
  listOwnMessages,
  listOwnRoomMessages,
  listReferralChoices,
  listSeatedRooms,
} from "@/lib/ops/coordination-entries";

export const metadata = { title: "Add to the record, AVAIA" };
export const dynamic = "force-dynamic";

// ADD TO THE DECISION RECORD (Workbook, Phase 2). The Host chooses what goes in and what kind of
// entry it is. Nothing is added for them, compared or interpreted. The words are copied exactly as
// they were said, with the date they were said. The browser sends only which message, referral
// field or Room message; the server reads the source itself and builds the stored text from it.

const input = "w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal";
const option = "bg-[#05060b] text-ink";
const card = "rounded-lg border border-rule bg-white/[0.04] p-4 backdrop-blur-sm";
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Where to return after an error, rebuilt from ids only (never an arbitrary address). */
function returnQuery(formData: FormData): string {
  const source = String(formData.get("source") ?? "");
  const params = new URLSearchParams();
  if (["message", "referral", "room", "note"].includes(source)) params.set("source", source);
  for (const key of ["conversation", "referral", "room"] as const) {
    const v = String(formData.get(`return_${key}`) ?? "");
    if (isUuid(v)) params.set(key, v);
  }
  return params.toString();
}

async function addAction(formData: FormData) {
  "use server";
  const itemId = String(formData.get("itemId") ?? "");
  const { supabase, hostId } = await requireCoordinationHost(`/workbook/coordination/${itemId}/entries/new`);
  if (!isUuid(itemId)) redirect("/workbook/coordination");
  const base = `/workbook/coordination/${itemId}/entries/new`;
  function fail(message: string): never {
    const q = returnQuery(formData);
    redirect(`${base}?${q ? `${q}&` : ""}error=${encodeURIComponent(message)}`);
  }

  const raw = Object.fromEntries(formData);
  const parsed = parseEntryInput(raw);
  if (!parsed.ok) fail(parsed.error);
  const choice = parsed.value;

  const source = String(formData.get("source") ?? "");
  let result;
  if (source === "message") {
    result = await addConversationMessageEntry(supabase, hostId, itemId, choice.entryType, String(formData.get("messageId") ?? ""), choice.hostNote);
  } else if (source === "referral") {
    result = await addReferralFieldEntry(
      supabase,
      hostId,
      itemId,
      choice.entryType,
      String(formData.get("referralId") ?? ""),
      String(formData.get("field") ?? ""),
      Number(formData.get("index")),
      choice.hostNote
    );
  } else if (source === "room") {
    result = await addRoomMessageEntry(supabase, hostId, itemId, choice.entryType, String(formData.get("roomId") ?? ""), String(formData.get("roomMessageId") ?? ""), choice.hostNote);
  } else if (source === "note") {
    const note = parseNoteText(raw);
    if (!note.ok) return fail(note.error);
    result = await addHostNoteEntry(supabase, hostId, itemId, choice.entryType, note.text);
  } else {
    return fail("Choose where this comes from.");
  }
  if (!result.ok) return fail(result.error);
  redirect(`/workbook/coordination/${itemId}?saved=${encodeURIComponent("Added to the record.")}#record`);
}

function EntryFields({ withNote = true }: { withNote?: boolean }) {
  return (
    <div className="mt-3 space-y-3">
      <div>
        <label className="label mb-2 block">What is this?</label>
        <select name="entry_type" required defaultValue="" className={input}>
          <option value="" disabled className={option}>
            Choose what this is
          </option>
          {ENTRY_TYPES.map((t) => (
            <option key={t} value={t} className={option}>
              {ENTRY_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">Your choice only. AVAIA doesn&rsquo;t compare entries or decide anything for you.</p>
      </div>
      {withNote && (
        <div>
          <label className="label mb-2 block">Your own note (optional)</label>
          <textarea name="host_note" rows={2} maxLength={ENTRY_LIMITS.hostNote} className={input} />
          <p className="mt-1 text-xs text-muted">
            If your position changed, you can say here, in your own words, what changed. AVAIA never writes this for you.
          </p>
        </div>
      )}
      <button
        type="submit"
        className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
      >
        Add to the record
      </button>
    </div>
  );
}

export default async function NewEntryPage({
  params,
  searchParams,
}: {
  params: { itemId: string };
  searchParams: { source?: string; conversation?: string; referral?: string; room?: string; error?: string };
}) {
  const { supabase, hostId } = await requireCoordinationHost(`/workbook/coordination/${params.itemId}/entries/new`);
  const item = await getCoordinationItem(supabase, hostId, params.itemId);
  if (!item) notFound();
  if (item.kind !== "decision") redirect(`/workbook/coordination/${item.id}`);

  const source = searchParams.source ?? "";
  const base = `/workbook/coordination/${item.id}/entries/new`;
  const choices = source === "message" || source === "referral" ? await listPointerChoices(supabase, hostId) : null;

  const ownMessages = source === "message" && searchParams.conversation ? await listOwnMessages(supabase, hostId, searchParams.conversation) : null;
  const referralItems = source === "referral" && searchParams.referral ? await listReferralChoices(supabase, hostId, searchParams.referral) : null;
  const rooms = source === "room" ? await listSeatedRooms(hostId) : null;
  const roomMessages = source === "room" && searchParams.room ? await listOwnRoomMessages(hostId, searchParams.room) : null;

  const stageName = (s: string) => STAGE_LABEL[s as Stage] ?? s;

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="mb-6">
        <Link href={`/workbook/coordination/${item.id}#record`} className="label hover:text-seal">
          ← Back to this decision
        </Link>
      </p>
      <p className="label mb-3">Decision record</p>
      <h1 className="font-serif text-4xl text-ink">Add to the record</h1>
      <p className="mt-3 text-lg text-ink">{item.title}</p>
      <p className="mt-4 text-muted">
        You choose what goes in, and what kind of entry it is. Nothing is added for you. Words from a conversation are copied exactly as
        you said them, with the date you said them.
      </p>

      {searchParams.error && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">{searchParams.error}</p>
      )}

      {!["message", "referral", "room", "note"].includes(source) && (
        <ul className="mt-8 space-y-3">
          <li className={card}>
            <Link href={`${base}?source=message`} className="font-serif text-lg text-ink hover:text-seal">
              One of my own messages in a conversation
            </Link>
            <p className="mt-1 text-sm text-muted">Your own words, copied exactly, with the date you said them.</p>
          </li>
          <li className={card}>
            <Link href={`${base}?source=referral`} className="font-serif text-lg text-ink hover:text-seal">
              From my referral
            </Link>
            <p className="mt-1 text-sm text-muted">A decision, commitment or question from a referral. This is a summary in your words, not a word-for-word message.</p>
          </li>
          <li className={card}>
            <Link href={`${base}?source=room`} className="font-serif text-lg text-ink hover:text-seal">
              My own words in a Shared Room
            </Link>
            <p className="mt-1 text-sm text-muted">Only what you said. Other people&rsquo;s words in a Room are never copied.</p>
          </li>
          <li className={card}>
            <Link href={`${base}?source=note`} className="font-serif text-lg text-ink hover:text-seal">
              Something I want to write now
            </Link>
            <p className="mt-1 text-sm text-muted">Your own note, dated the moment you write it.</p>
          </li>
        </ul>
      )}

      {source === "note" && (
        <form action={addAction} className="mt-8">
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="source" value="note" />
          <label className="label mb-2 block">What do you want to record?</label>
          <textarea name="note_text" rows={5} required maxLength={ENTRY_LIMITS.excerpt} className={input} />
          <EntryFields withNote={false} />
        </form>
      )}

      {source === "message" && !searchParams.conversation && choices && (
        <div className="mt-8">
          <h2 className="font-serif text-2xl text-ink">Choose a conversation</h2>
          {choices.conversations.length === 0 ? (
            <p className="mt-3 text-muted">You don&rsquo;t have a conversation to choose from yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {choices.conversations.map((c) => (
                <li key={c.id}>
                  <Link href={`${base}?source=message&conversation=${c.id}`} className="text-ink underline-offset-2 hover:text-seal hover:underline">
                    {stageName(c.stage)}, {fmt(c.created_at)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {source === "message" && searchParams.conversation && ownMessages && (
        <div className="mt-8">
          <h2 className="font-serif text-2xl text-ink">Your own words</h2>
          <p className="mt-1 text-sm text-muted">Only what you said, never AVAIA&rsquo;s replies. Each message is kept whole.</p>
          {ownMessages.length === 0 ? (
            <p className="mt-3 text-muted">There are no messages of yours to choose from in this conversation.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {ownMessages.map((m) => (
                <li key={m.id} className={card}>
                  <p className="label text-muted">Said {fmtTime(m.created_at)}</p>
                  <p className="mt-2 whitespace-pre-wrap border-l-2 border-seal/50 pl-4 font-serif italic leading-relaxed text-ink">{m.content}</p>
                  <form action={addAction}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="source" value="message" />
                    <input type="hidden" name="return_conversation" value={searchParams.conversation} />
                    <input type="hidden" name="messageId" value={m.id} />
                    <EntryFields />
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {source === "referral" && !searchParams.referral && choices && (
        <div className="mt-8">
          <h2 className="font-serif text-2xl text-ink">Choose a referral</h2>
          {choices.referrals.length === 0 ? (
            <p className="mt-3 text-muted">You don&rsquo;t have a referral to choose from yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {choices.referrals.map((r) => (
                <li key={r.id}>
                  <Link href={`${base}?source=referral&referral=${r.id}`} className="text-ink underline-offset-2 hover:text-seal hover:underline">
                    {stageName(r.from_stage)} referral, {fmt(r.created_at)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {source === "referral" && searchParams.referral && referralItems && (
        <div className="mt-8">
          <h2 className="font-serif text-2xl text-ink">From your referral</h2>
          <p className="mt-1 text-sm text-muted">These are a summary in your words, not word-for-word messages. They are always labelled that way in your record.</p>
          {referralItems.length === 0 ? (
            <p className="mt-3 text-muted">There is nothing in your own words to choose from in this referral.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {referralItems.map((it) => (
                <li key={`${it.field}:${it.index}`} className={card}>
                  <p className="label text-muted">{HOST_VOICE_LABEL[it.field]}</p>
                  <p className="mt-2 border-l-2 border-seal/50 pl-4 font-serif italic leading-relaxed text-ink">{it.text}</p>
                  <form action={addAction}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="source" value="referral" />
                    <input type="hidden" name="return_referral" value={searchParams.referral} />
                    <input type="hidden" name="referralId" value={searchParams.referral} />
                    <input type="hidden" name="field" value={it.field} />
                    <input type="hidden" name="index" value={it.index} />
                    <EntryFields />
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {source === "room" && !searchParams.room && rooms && (
        <div className="mt-8">
          <h2 className="font-serif text-2xl text-ink">Choose a Shared Room</h2>
          {rooms.length === 0 ? (
            <p className="mt-3 text-muted">You aren&rsquo;t seated in a Shared Room right now.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {rooms.map((r) => (
                <li key={r.id}>
                  <Link href={`${base}?source=room&room=${r.id}`} className="text-ink underline-offset-2 hover:text-seal hover:underline">
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {source === "room" && searchParams.room && roomMessages && (
        <div className="mt-8">
          <h2 className="font-serif text-2xl text-ink">Your own words in this Room</h2>
          <p className="mt-1 text-sm text-muted">Only what you said. Nothing from anyone else in the Room is copied, and nothing about the Room itself changes.</p>
          {roomMessages.length === 0 ? (
            <p className="mt-3 text-muted">There are no messages of yours to choose from in this Room.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {roomMessages.map((m) => (
                <li key={m.id} className={card}>
                  <p className="label text-muted">Said {fmtTime(m.created_at)}</p>
                  <p className="mt-2 whitespace-pre-wrap border-l-2 border-seal/50 pl-4 font-serif italic leading-relaxed text-ink">{m.content}</p>
                  <form action={addAction}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="source" value="room" />
                    <input type="hidden" name="return_room" value={searchParams.room} />
                    <input type="hidden" name="roomId" value={searchParams.room} />
                    <input type="hidden" name="roomMessageId" value={m.id} />
                    <EntryFields />
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
