import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SpeakButton from "@/components/SpeakButton";
import type { LibraryEntry } from "@/lib/library";
import { familyOf } from "@/lib/virtues";

export const dynamic = "force-dynamic";

type HostEntryRow = {
  explored_at: string | null;
  state: "save" | "not_for_me" | null;
  note: string | null;
};

/** Save / Not for me are one mutually-exclusive, freely reversible choice
 *  -- clicking the currently-active one again clears it back to no
 *  decision, rather than trapping the Host in a one-way state. */
async function setLibraryState(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/library");

  const entryId = String(formData.get("entryId") ?? "");
  const requested = String(formData.get("state") ?? "");
  if (!entryId || (requested !== "save" && requested !== "not_for_me")) redirect("/library");

  const { data: existing } = await supabase
    .from("library_host_entries")
    .select("state")
    .eq("host_id", user.id)
    .eq("library_entry_id", entryId)
    .maybeSingle();
  const next = existing?.state === requested ? null : requested;

  await supabase.from("library_host_entries").upsert(
    { host_id: user.id, library_entry_id: entryId, state: next, updated_at: new Date().toISOString() },
    { onConflict: "host_id,library_entry_id" }
  );
  redirect(`/library/${entryId}`);
}

/** Host-authored, stored verbatim -- this action never rewrites or
 *  interprets what the Host typed. */
async function saveLibraryNote(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/library");

  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) redirect("/library");
  const note = String(formData.get("note") ?? "").trim();

  await supabase.from("library_host_entries").upsert(
    { host_id: user.id, library_entry_id: entryId, note: note || null, updated_at: new Date().toISOString() },
    { onConflict: "host_id,library_entry_id" }
  );
  redirect(`/library/${entryId}`);
}

export default async function LibraryEntryPage({ params }: { params: { entryId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=/library/${params.entryId}`);

  const { data: entryData } = await supabase
    .from("library_entries")
    .select("*")
    .eq("id", params.entryId)
    .eq("status", "published")
    .maybeSingle();
  const entry = entryData as LibraryEntry | null;
  if (!entry) notFound();

  // Explore = the Host opened this, nothing more inferred -- recorded once,
  // the first time, alongside reading whatever Save/Not for me/Note state
  // already exists so the buttons below reflect it. Best-effort: a failure
  // here should never block reading the entry itself.
  let hostEntry: HostEntryRow | null = null;
  try {
    const { data: existing } = await supabase
      .from("library_host_entries")
      .select("explored_at, state, note")
      .eq("host_id", user.id)
      .eq("library_entry_id", entry.id)
      .maybeSingle();
    hostEntry = existing as HostEntryRow | null;
    if (!hostEntry?.explored_at) {
      await supabase.from("library_host_entries").upsert(
        { host_id: user.id, library_entry_id: entry.id, explored_at: new Date().toISOString() },
        { onConflict: "host_id,library_entry_id" }
      );
    }
  } catch {
    /* explore-tracking is best-effort; the entry itself still renders */
  }

  const isSaved = hostEntry?.state === "save";
  const isNotForMe = hostEntry?.state === "not_for_me";
  const spokenText = [entry.overview, entry.body].filter(Boolean).join("\n\n");

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="mb-6">
        <Link href="/library" className="label hover:text-seal">
          ← Back to the Library
        </Link>
      </p>

      <p className="label mb-3">{entry.great_idea}</p>
      <h1 className="font-serif text-4xl text-ink">{entry.title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">{entry.overview}</p>

      {entry.content_type === "avaia-owned" && entry.body && (
        <div className="mt-6 whitespace-pre-wrap text-ink leading-relaxed">{entry.body}</div>
      )}

      {entry.content_type === "external-resource" && (
        <div className="mt-6 rounded-lg border border-rule bg-white/[0.04] p-5">
          {entry.external_author && <p className="text-sm text-muted">{entry.external_author}</p>}
          {entry.external_description && <p className="mt-2 text-ink">{entry.external_description}</p>}
          {entry.external_url && (
            <a
              href={entry.external_url}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-block text-sm text-seal underline decoration-rule underline-offset-2"
            >
              View the source →
            </a>
          )}
        </div>
      )}

      <div className="mt-4">
        <SpeakButton text={spokenText} />
      </div>

      {(entry.virtues.length > 0 || entry.secondary_losses.length > 0) && (
        <div className="mt-6 flex flex-wrap gap-2">
          {entry.virtues.map((v, i) => (
            <span key={`v-${i}`} className="rounded-full border border-rule px-3 py-0.5 text-xs text-muted">
              {familyOf(v.family).name}
              {v.element ? ` — ${v.element}` : ""}
            </span>
          ))}
          {entry.secondary_losses.map((s) => (
            <span key={s} className="rounded-full border border-rule px-3 py-0.5 text-xs text-muted">
              Secondary Loss: {s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-5">
        <form action={setLibraryState} className="flex flex-wrap gap-3">
          <input type="hidden" name="entryId" value={entry.id} />
          <button
            type="submit"
            name="state"
            value="save"
            className={`rounded-md px-5 py-2.5 font-sans text-sm font-semibold transition-opacity ${
              isSaved
                ? "bg-seal text-[#05060b]"
                : "border border-rule text-ink hover:border-seal"
            }`}
          >
            {isSaved ? "Saved ✓" : "Save"}
          </button>
          <button
            type="submit"
            name="state"
            value="not_for_me"
            className={`rounded-md px-5 py-2.5 font-sans text-sm font-medium transition-colors ${
              isNotForMe
                ? "border border-seal text-seal"
                : "border border-rule text-muted hover:border-seal hover:text-ink"
            }`}
          >
            {isNotForMe ? "Not for me ✓" : "Not for me"}
          </button>
        </form>

        <form action={saveLibraryNote} className="mt-5">
          <input type="hidden" name="entryId" value={entry.id} />
          <label className="label mb-2 block" htmlFor="note">
            Your note
          </label>
          <textarea
            id="note"
            name="note"
            defaultValue={hostEntry?.note ?? ""}
            rows={3}
            placeholder="Anything you want to remember about this, in your own words…"
            className="w-full resize-none rounded-lg border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
          />
          <button
            type="submit"
            className="mt-3 rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Save note
          </button>
        </form>
      </div>

      <p className="mt-6">
        <Link href="/library/mine" className="text-sm text-muted hover:text-seal">
          My Library →
        </Link>
      </p>
    </div>
  );
}
