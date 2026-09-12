import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SpeakButton from "@/components/SpeakButton";
import MembershipCheckoutButton from "@/components/MembershipCheckoutButton";
import type { LibraryEntry } from "@/lib/library";
import { familyOf } from "@/lib/virtues";
import { getConceptsForEntry, getQuestionsForEntry } from "@/lib/library-concepts";
import { isMember } from "@/lib/membership";
import { isToolkitAuthorized } from "@/lib/guide";

export const dynamic = "force-dynamic";

type HostEntryRow = {
  explored_at: string | null;
  state: "save" | "not_for_me" | null;
  note: string | null;
};

/** Save / Not for me are one mutually-exclusive, freely reversible choice
 * , clicking the currently-active one again clears it back to no
 *  decision, rather than trapping the Host in a one-way state. */
async function setLibraryState(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/library");

  // A Server Action is its own reachable endpoint, not something only
  // reachable through this page's own render, re-checked here the same
  // way the page component itself is, matching the admin-action precedent
  // elsewhere in this codebase.
  const { data: youthCheck } = await supabase
    .from("profiles")
    .select("minor_with_guardian")
    .eq("id", user.id)
    .maybeSingle();
  if (youthCheck?.minor_with_guardian) redirect("/youth");

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

/** Host-authored, stored verbatim, this action never rewrites or
 *  interprets what the Host typed. */
async function saveLibraryNote(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/library");

  const { data: youthCheck } = await supabase
    .from("profiles")
    .select("minor_with_guardian")
    .eq("id", user.id)
    .maybeSingle();
  if (youthCheck?.minor_with_guardian) redirect("/youth");

  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) redirect("/library");
  const note = String(formData.get("note") ?? "").trim();

  await supabase.from("library_host_entries").upsert(
    { host_id: user.id, library_entry_id: entryId, note: note || null, updated_at: new Date().toISOString() },
    { onConflict: "host_id,library_entry_id" }
  );
  redirect(`/library/${entryId}`);
}

/** A genuine removal, not the Save/Not-for-me toggle-back-to-null that
 *  setLibraryState already does. Deletes the library_host_entries row
 *  outright (save state, note, and explored_at all go with it), the
 *  "remove a saved item" capability the Library completion work order
 *  asked for by name, distinct from just hiding it from /library/mine. */
async function removeLibraryHostEntry(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/library");

  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) redirect("/library");

  await supabase.from("library_host_entries").delete().eq("host_id", user.id).eq("library_entry_id", entryId);
  redirect(`/library/${entryId}`);
}

export default async function LibraryEntryPage({ params }: { params: { entryId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=/library/${params.entryId}`);

  // The Library has no Youth-aware presentation architecture yet (Living
  // Library audit, Section Q), server-derived, never trusting a client
  // flag, the same signal /journey already redirects on. Sent to their own
  // Journey home rather than shown adult-register content, including via a
  // direct entry URL.
  const { data: youthCheck } = await supabase
    .from("profiles")
    .select("minor_with_guardian")
    .eq("id", user.id)
    .maybeSingle();
  if (youthCheck?.minor_with_guardian) redirect("/youth");

  const { data: entryData } = await supabase
    .from("library_entries")
    .select("*")
    .eq("id", params.entryId)
    .eq("status", "published")
    .maybeSingle();
  const entry = entryData as LibraryEntry | null;
  if (!entry) notFound();

  // A member-only entry is never rendered to a non-member, including via a
  // direct URL, this is the same rule search/retrieval/orientation/concept
  // pages already enforce before an entry ever appears as a link; this is
  // the backstop for reaching one straight by id. Acknowledges the entry
  // exists (title/category) rather than a bare 404, but withholds the
  // actual content. MembershipGate (app/journey/page.tsx) isn't reused here
  //, its copy is written specifically for the IAP/CAT/InnerCompass
  // boundary ("Your Individual Awareness Profile is complete...") and would
  // be inaccurate shown against a Library entry, so this reuses the same
  // underlying MembershipCheckoutButton with Library-appropriate copy
  // instead of that wrapper.
  // A Guide's own "library entries guide read" RLS policy already lets
  // them read every published entry regardless of visibility (Living
  // Library audit, Section D); this page-level gate has to agree with
  // that, or an authorized Guide researching a member-only entry would
  // be shown a membership paywall for content their own account can
  // already query directly. isMember and isToolkitAuthorized are
  // independent facts about this account, either one is sufficient here.
  if (entry.visibility === "member" && !(await isMember(supabase, user.id)) && !(await isToolkitAuthorized(supabase, user.id))) {
    return (
      <div className="mx-auto max-w-prose px-5 py-16">
        <p className="mb-6">
          <Link href="/library" className="label hover:text-seal">
            ← Back to the Library
          </Link>
        </p>
        <p className="label mb-3">{entry.great_idea}</p>
        <h1 className="font-serif text-4xl text-ink">{entry.title}</h1>
        <p className="mt-4 text-lg text-muted">
          This entry is part of AVAIA Membership.
        </p>
        <div className="mt-8">
          <MembershipCheckoutButton returnTo={`/library/${entry.id}`} />
        </div>
      </div>
    );
  }

  // Explore = the Host opened this, nothing more inferred, recorded once,
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

  // Published concept/question content exists now (Library completion
  // audit, Phase 2); this renders real connections wherever an editor has
  // actually reviewed and published one, and nothing when there isn't
  // one yet for THIS entry specifically, same as it always would.
  const [relatedConcepts, relatedQuestions] = await Promise.all([
    getConceptsForEntry(supabase, entry.id),
    getQuestionsForEntry(supabase, entry.id),
  ]);

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

      {/* Body renders whenever it's present, independent of content_type.
          Gating this on content_type === 'avaia-owned' would force
          non-AVAIA (historical/research/contemporary) material to falsely
          claim avaia-owned just to be readable, a provenance error, not
          a rendering shortcut. The external-resource attribution block
          below is unaffected, it still only appears for
          content_type === 'external-resource', so an AVAIA-owned entry
          never shows external attribution it doesn't have, and an
          external-resource entry's real authorship stays visible
          alongside its body. */}
      {entry.body && (
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
              {v.element ? `, ${v.element}` : ""}
            </span>
          ))}
          {entry.secondary_losses.map((s) => (
            <span key={s} className="rounded-full border border-rule px-3 py-0.5 text-xs text-muted">
              Secondary Loss: {s}
            </span>
          ))}
        </div>
      )}

      {(relatedConcepts.length > 0 || relatedQuestions.length > 0) && (
        <div className="mt-8 space-y-4">
          {relatedConcepts.length > 0 && (
            <div>
              <p className="label mb-2 text-muted">Related ideas</p>
              <div className="flex flex-wrap gap-2">
                {relatedConcepts.map(({ concept }) => (
                  <Link
                    key={concept.id}
                    href={`/library/concepts/${concept.id}`}
                    className="rounded-full border border-rule px-3 py-0.5 text-xs text-ink transition-colors hover:border-seal"
                  >
                    {concept.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {relatedQuestions.length > 0 && (
            <div>
              <p className="label mb-2 text-muted">Questions this touches</p>
              <ul className="space-y-1">
                {relatedQuestions.map(({ question }) => (
                  <li key={question.id} className="text-sm italic text-ink">
                    &ldquo;{question.question}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          )}
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

        {(isSaved || isNotForMe || hostEntry?.note) && (
          <form action={removeLibraryHostEntry} className="mt-4">
            <input type="hidden" name="entryId" value={entry.id} />
            <button type="submit" className="text-xs text-muted underline hover:text-seal">
              Remove from My Library
            </button>
          </form>
        )}
      </div>

      <div className="mt-8 rounded-md border border-rule bg-white/[0.03] px-4 py-4">
        <p className="font-serif text-base text-ink">Want to bring this into a conversation?</p>
        <p className="mt-1 text-sm text-muted">
          Take {entry.title} into a private AVAIA conversation, explore what it brought to mind,
          where you&rsquo;ve seen it, or why it matters to you.
        </p>
        <Link
          href={`/journey?origin=library&key=${encodeURIComponent(`entry:${entry.id}`)}`}
          prefetch={false}
          className="mt-3 inline-block rounded-md bg-seal px-4 py-2 font-sans text-xs font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Bring Into My Conversation →
        </Link>
      </div>

      <p className="mt-6">
        <Link href="/library/mine" className="text-sm text-muted hover:text-seal">
          My Library →
        </Link>
      </p>
    </div>
  );
}
