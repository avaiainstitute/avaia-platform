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
  groupByLayer,
  SIGNATURE_LAYER_LABEL,
  SIGNATURE_LAYER_ORDER,
  type SignatureLayer,
} from "@/lib/virtue-signature";
import { VIRTUE_FAMILIES, virtuesByFamily } from "@/lib/virtues";

export const metadata = { title: "My Virtue Signature — AVAIA" };
export const dynamic = "force-dynamic";

function isLayer(value: FormDataEntryValue | null): value is SignatureLayer {
  return typeof value === "string" && (SIGNATURE_LAYER_ORDER as string[]).includes(value);
}

/** "A Virtue Signature is a living recognition record, not a ranked trait
 *  list." (AVAIA_My_Virtue_Signature_Master_Format_Kit.docx) -- a Host
 *  adding their own recognition directly, the same act "What Became
 *  Visible" (components/WhatBecameVisible.tsx) offers after a
 *  conversation or Unsung Heroes recognition, just self-initiated rather
 *  than sourced from one. */
async function addEntry(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/signature");

  const layer = formData.get("layer");
  const family = String(formData.get("family") ?? "");
  const element = String(formData.get("element") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!isLayer(layer) || !family) redirect("/signature");

  const { error } = await addSignatureEntryForHost(supabase, user.id, layer, family, element, note, "self", null);
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
  const grouped = groupByLayer(entries);

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
        Not a personality test. Not a score. A living recognition record — what keeps becoming
        visible when you are being you. Other people can offer evidence. Only you author this.
      </p>

      <div className="mt-10 rounded-lg border border-rule bg-white/[0.03] p-6">
        <VirtueSignatureVisual entries={entries} />
      </div>

      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {searchParams.error}
        </p>
      )}

      {SIGNATURE_LAYER_ORDER.map((layer) => (
        <section key={layer} className="mt-10 border-t border-rule pt-6">
          <p className="label text-muted">{SIGNATURE_LAYER_LABEL[layer]}</p>
          {grouped[layer].length > 0 ? (
            <div className="mt-3 space-y-2">
              {grouped[layer].map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rule bg-white/[0.03] px-4 py-3"
                >
                  <div>
                    <VirtueLink
                      family={e.family}
                      virtue={e.element}
                      className="text-sm text-ink underline decoration-rule underline-offset-2 hover:text-seal"
                    >
                      {e.element ? `${e.family} — ${e.element}` : e.family}
                    </VirtueLink>
                    {e.note && <p className="mt-1 text-sm text-muted">{e.note}</p>}
                  </div>
                  <form action={removeEntry}>
                    <input type="hidden" name="entryId" value={e.id} />
                    <button type="submit" className="text-xs text-muted transition-colors hover:text-red-300">
                      Remove
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Nothing here yet.</p>
          )}
        </section>
      ))}

      <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <p className="label mb-3 text-muted">Add to Your Signature</p>
        <form action={addEntry}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label mb-2 block" htmlFor="layer">
                Which layer
              </label>
              <select
                id="layer"
                name="layer"
                required
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              >
                {SIGNATURE_LAYER_ORDER.map((l) => (
                  <option key={l} value={l} className="bg-[#05060b]">
                    {SIGNATURE_LAYER_LABEL[l]}
                  </option>
                ))}
              </select>
            </div>
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
          </div>
          <div className="mt-4">
            <label className="label mb-2 block" htmlFor="element">
              Element (optional — leave blank for the family alone)
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
              In your own words (optional)
            </label>
            <textarea
              id="note"
              name="note"
              rows={2}
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
