import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import VirtueSignatureVisual from "@/components/VirtueSignatureVisual";
import { VirtueLink } from "@/components/VirtueLink";
import {
  addSignatureEntryForHost,
  removeSignatureEntry,
  listSignatureEntriesForHost,
  groupByElement,
  type SignatureSourceType,
} from "@/lib/virtue-signature";
import { VIRTUE_FAMILIES, virtuesByFamily } from "@/lib/virtues";

export const metadata = { title: "My Virtue Signature, AVAIA" };
export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<SignatureSourceType, string> = {
  self: "You added this",
  conversation_referral: "From a conversation",
  unsung_heroes: "From Unsung Heroes",
  observation_offered: "Offered to you",
  journal: "From your journal",
};

/** A Virtue Signature becomes visible through repeated experiences, repeated
 *  expressions, and different scenarios; those patterns help reveal who the person
 *  is. It is a living recognition record, not a ranked trait list and not a list
 *  chosen once. This is a Host adding their own recognition directly, the same act
 *  "What Became Visible" (components/WhatBecameVisible.tsx) offers after a
 *  conversation or Unsung Heroes recognition, just self-initiated rather than
 *  sourced from one. The same virtue can be added again, in its own words, whenever
 *  it shows up in a different experience; there is deliberately no count, threshold
 *  or score. */
async function addEntry(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/signature");

  const family = String(formData.get("family") ?? "");
  const element = String(formData.get("element") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!family) redirect("/signature");

  const { error } = await addSignatureEntryForHost(supabase, user.id, family, element, note, "self", null);
  if (error) redirect(`/signature?error=${encodeURIComponent(error)}`);
  redirect("/signature");
}

async function removeEntry(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/signature");

  const entryId = String(formData.get("entryId") ?? "");
  await removeSignatureEntry(supabase, entryId);
  redirect("/signature");
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default async function VirtueSignaturePage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/signature");

  const { data: profile } = await supabase.from("profiles").select("consent_at").eq("id", user.id).maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");

  const entries = await listSignatureEntriesForHost(supabase, user.id);
  const elements = groupByElement(entries);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <div className="flex items-baseline justify-between">
        <Link href="/" className="font-serif text-xl tracking-[0.16em] text-ink">
          AVAIA
        </Link>
        <SignOutButton />
      </div>

      <p className="label mb-3 mt-8">Chemistry of Virtue</p>
      <h1 className="font-serif text-4xl text-ink">My Virtue Signature</h1>
      <p className="mt-4 text-lg text-muted">
        Not a personality test. Not a score. Your Virtue Signature becomes visible through repeated
        experiences, repeated expressions, and different scenarios, and those patterns help reveal
        who you are. Other people can offer evidence. Only you author this.
      </p>

      <div className="mt-10 rounded-lg border border-rule bg-white/[0.03] p-6">
        <VirtueSignatureVisual entries={entries} />
        <p className="mt-4 text-center text-sm text-muted">
          At the center is you, your identity, which doesn&rsquo;t change. Vulnerability and
          Authenticity surround and protect it. Around them, the virtues that keep becoming
          visible in you.
        </p>
      </div>

      {/* Wake It Up, Signature as orientation, not just record. Static
          invitation text, no new mechanism: points back to the same
          Chemistry table (app/chemistry/page.tsx) when nothing here fits.
          Only rendered once there's something to orient from. */}
      {entries.length > 0 && (
        <div className="mt-6 rounded-lg border border-rule bg-white/[0.03] px-5 py-6 backdrop-blur-sm">
          <p className="label mb-2 text-muted">Orientation, not obligation</p>
          <p className="text-ink">
            What in here might you need to wake up right now? A hard moment rarely calls on
            everything you&rsquo;ve recognized in yourself, that&rsquo;s not a gap in your
            Signature, just what this particular moment happens to need.
          </p>
          <p className="mt-3 text-muted">
            If nothing here seems to fit, that&rsquo;s not failure either, the wider{" "}
            <Link href="/chemistry" className="underline decoration-rule underline-offset-2 hover:text-seal">
              Chemistry of Virtue
            </Link>{" "}
            is still yours to explore. Becoming a Noble Gas doesn&rsquo;t mean not needing
            anyone, it means you don&rsquo;t need another person to supply your identity in
            order to connect with them.
          </p>
        </div>
      )}

      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {searchParams.error}
        </p>
      )}

      <section className="mt-10 border-t border-rule pt-6">
        <p className="label text-muted">What has become visible</p>
        <p className="mt-1 text-sm text-muted">
          Each virtue, with the experiences and scenarios where it showed up, in your own words.
        </p>
        {elements.length > 0 ? (
          <div className="mt-4 space-y-4">
            {elements.map((g) => (
              <div key={g.key} className="rounded-md border border-rule bg-white/[0.03] px-4 py-3">
                <VirtueLink
                  family={g.family}
                  virtue={g.element}
                  className="text-sm text-ink underline decoration-rule underline-offset-2 hover:text-seal"
                >
                  {g.element ? `${g.family}, ${g.element}` : g.family}
                </VirtueLink>
                <ul className="mt-2 space-y-2">
                  {g.entries.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        {e.note && <p className="text-sm text-ink">{e.note}</p>}
                        <p className="text-xs text-muted">
                          {SOURCE_LABEL[e.source_type] ?? "You added this"} · {fmtDate(e.created_at)}
                        </p>
                      </div>
                      <form action={removeEntry}>
                        <input type="hidden" name="entryId" value={e.id} />
                        <button type="submit" className="text-xs text-muted transition-colors hover:text-red-300">
                          Remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
                <p className="mt-2">
                  <Link
                    href={`/library?virtue_family=${encodeURIComponent(g.family)}${g.element ? `&virtue_element=${encodeURIComponent(g.element)}` : ""}`}
                    className="text-xs text-muted underline hover:text-seal"
                  >
                    Explore in the Library →
                  </Link>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Nothing here yet.</p>
        )}
      </section>

      <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <p className="label mb-1 text-muted">Add to Your Signature</p>
        <p className="mb-3 text-sm text-muted">
          When a virtue shows up in you, add it, even if it is one you have added before. The same
          quality showing up in a different experience is how a pattern becomes visible.
        </p>
        <form action={addEntry}>
          <div>
            <label className="label mb-2 block" htmlFor="family">
              Family
            </label>
            <select
              id="family"
              name="family"
              required
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            >
              {VIRTUE_FAMILIES.map((f) => (
                <option key={f.key} value={f.name} className="bg-[#05060b]">
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <label className="label mb-2 block" htmlFor="element">
              Element (optional, leave blank for the family alone)
            </label>
            <input
              id="element"
              name="element"
              type="text"
              list="virtue-elements"
              placeholder="e.g. Courage"
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
            <datalist id="virtue-elements">
              {VIRTUE_FAMILIES.flatMap((f) => virtuesByFamily(f.key)).map((v) => (
                <option key={v.symbol + v.name} value={v.name} />
              ))}
            </datalist>
          </div>
          <div className="mt-4">
            <label className="label mb-2 block" htmlFor="note">
              In your own words: the experience or scenario where this showed up (optional)
            </label>
            <textarea
              id="note"
              name="note"
              rows={3}
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
          <button
            type="submit"
            className="mt-4 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Add to My Signature
          </button>
        </form>
      </section>
    </div>
  );
}
