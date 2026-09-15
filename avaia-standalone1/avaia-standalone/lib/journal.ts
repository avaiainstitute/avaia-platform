import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// AVAIA Journal -- a capability inside the Workbook, not a separate
// product. See migration 0080_journal.sql's own header for the full
// governing distinction. This module owns the record/query helpers
// against journal_entries; RLS (self-only, no exceptions) is the actual
// enforcement, every function here trusts the caller's own RLS-scoped
// client entirely, exactly like lib/virtue-signature.ts does for its own
// table. No function here ever reads, rewrites, summarizes, or classifies
// entry content -- the one thing this module must never grow into.

export type JournalEntryMethod = "write" | "talk";

/** A journal entry's optional origin tag -- set only when the Host opened
 *  Journal from a specific doorway (an offered ponder prompt, or a
 *  Program/Experience connection). Mirrors the lightweight shape already
 *  established by conversations.origin_context (0059): a provenance label,
 *  never a join anything else depends on, never authorization-bearing. */
export type JournalContext = {
  source: "prompt" | "program";
  label: string;
};

export type JournalEntry = {
  id: string;
  host_id: string;
  content: string;
  entry_method: JournalEntryMethod;
  context: JournalContext | null;
  created_at: string;
};

/** Creates one Journal entry for the signed-in Host. `supabase` must be
 *  the caller's own RLS-scoped client; RLS enforces host_id = auth.uid()
 *  regardless of what's passed. Never touches any other table -- no
 *  automatic Virtue Signature entry, no crisis-response conversation turn,
 *  nothing beyond the one row (the caller may separately log a crisis
 *  oversight event, see app/api/journal/route.ts, but that is metadata
 *  logging, not a change to this entry or a response to the Host). */
export async function createJournalEntry(
  supabase: SupabaseClient,
  hostId: string,
  content: string,
  entryMethod: JournalEntryMethod,
  context: JournalContext | null
): Promise<{ entry: JournalEntry | null; error: string | null }> {
  const { data, error } = await supabase
    .from("journal_entries")
    .insert({ host_id: hostId, content, entry_method: entryMethod, context })
    .select("*")
    .single();
  return { entry: (data as JournalEntry) ?? null, error: error?.message ?? null };
}

/** Every entry the signed-in Host has ever written, newest first -- the
 *  Journal is additive and entries are never edited or removed in this
 *  build, so this is simply the Host's own full, ordered history. */
export async function listJournalEntries(supabase: SupabaseClient, hostId: string): Promise<JournalEntry[]> {
  const { data } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("host_id", hostId)
    .order("created_at", { ascending: false });
  return (data as JournalEntry[]) ?? [];
}

/** One entry by id, scoped to the signed-in Host by RLS -- returns null
 *  for an entry that doesn't exist OR belongs to someone else, the two
 *  cases are indistinguishable by design (never leak existence). */
export async function getJournalEntry(supabase: SupabaseClient, entryId: string): Promise<JournalEntry | null> {
  const { data } = await supabase.from("journal_entries").select("*").eq("id", entryId).maybeSingle();
  return (data as JournalEntry) ?? null;
}

/** A small, fixed set of optional ponder prompts, reusing already-
 *  established, named AVAIA reflection categories rather than inventing
 *  new ones (per the explicit instruction not to build a large new prompt
 *  library in this pass): the Virtue Signature's own six layers, and the
 *  Unsung Heroes Recognition Cycle's five stages. Each is offered only as
 *  a one-line hint shown above a blank composer -- never sent to any
 *  model, never a question AVAIA asks or follows up on. */
export const JOURNAL_PROMPTS: { label: string; hint: string }[] = [
  { label: "What I Recognize in Myself", hint: "Something you recognize in yourself." },
  { label: "What Other People Have Noticed", hint: "Something someone else has noticed in you." },
  { label: "How My Qualities Work Together", hint: "How a few of your qualities showed up together." },
  { label: "Different Ways the Same Quality Can Show Up", hint: "A different way a familiar quality showed up this time." },
  { label: "What I Want to Practice", hint: "Something you want to practice." },
  { label: "How I Want to Contribute", hint: "Something you want to contribute." },
  { label: "Observe", hint: "Something you noticed, in yourself or someone else." },
  { label: "Reflect", hint: "Something you're still thinking about." },
];
