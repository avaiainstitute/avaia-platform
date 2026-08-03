import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VIRTUE_FAMILIES } from "@/lib/virtues";
import {
  SECONDARY_LOSS_NAMES,
  PROGRAM_KEYS,
  PROGRAM_LABEL,
  type LibraryEntry,
} from "@/lib/library";

export const metadata = { title: "Library — AVAIA" };
export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams?: { q?: string; virtue?: string; loss?: string; program?: string; type?: string };
}) {
  const supabase = createClient();

  // RLS alone decides what shows up here: signed-out visitors and free
  // members only ever get status='published' + visibility='public' rows;
  // signed-in members additionally get visibility='member' rows. No branching
  // needed in this page for that — the query is identical either way.
  let query = supabase
    .from("library_entries")
    .select("id, title, great_idea, overview, virtues, secondary_losses, journey_stages, programs, content_type, tags, visibility, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (searchParams?.q) {
    const q = searchParams.q.trim();
    if (q) query = query.or(`title.ilike.%${q}%,overview.ilike.%${q}%,great_idea.ilike.%${q}%`);
  }
  if (searchParams?.virtue) {
    query = query.contains("virtues", [{ family: searchParams.virtue }]);
  }
  if (searchParams?.loss) {
    query = query.contains("secondary_losses", [searchParams.loss]);
  }
  if (searchParams?.program) {
    query = query.contains("programs", [searchParams.program]);
  }
  if (searchParams?.type === "avaia-owned" || searchParams?.type === "external-resource") {
    query = query.eq("content_type", searchParams.type);
  }

  const { data } = await query;
  const entries = (data as LibraryEntry[]) ?? [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <p className="label mb-3">The AVAIA Library</p>
      <h1 className="font-serif text-4xl text-ink">Library</h1>
      <p className="mt-4 max-w-prose text-lg text-muted">
        Ideas, virtues, and resources connected to the AVAIA Journey — browse, search, or follow a
        thread from one entry to the next.
      </p>

      <div className="mt-6">
        <Link href="/library/suggest" className="label hover:text-seal">
          Suggest a resource →
        </Link>
      </div>

      <form method="GET" className="mt-8 grid gap-3 sm:grid-cols-5">
        <input
          type="text"
          name="q"
          defaultValue={searchParams?.q ?? ""}
          placeholder="Search…"
          className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-seal sm:col-span-2"
        />
        <select
          name="virtue"
          defaultValue={searchParams?.virtue ?? ""}
          className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal"
        >
          <option value="">Any virtue</option>
          {VIRTUE_FAMILIES.map((f) => (
            <option key={f.key} value={f.key}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          name="loss"
          defaultValue={searchParams?.loss ?? ""}
          className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal"
        >
          <option value="">Any Secondary Loss</option>
          {SECONDARY_LOSS_NAMES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select
          name="program"
          defaultValue={searchParams?.program ?? ""}
          className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal"
        >
          <option value="">Any program</option>
          {PROGRAM_KEYS.map((p) => (
            <option key={p} value={p}>
              {PROGRAM_LABEL[p]}
            </option>
          ))}
        </select>
        <div className="flex gap-2 sm:col-span-5">
          <select
            name="type"
            defaultValue={searchParams?.type ?? ""}
            className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal"
          >
            <option value="">Any resource type</option>
            <option value="avaia-owned">AVAIA</option>
            <option value="external-resource">External</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-seal px-5 py-2 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Filter
          </button>
          <Link
            href="/library"
            className="rounded-md border border-rule px-5 py-2 font-sans text-sm text-muted transition-colors hover:border-seal hover:text-ink"
          >
            Clear
          </Link>
        </div>
      </form>

      {entries.length === 0 && (
        <p className="mt-12 text-muted">Nothing matches yet — try a different filter.</p>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {entries.map((e) => (
          <Link
            key={e.id}
            href={`/library/${e.id}`}
            className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm transition-colors hover:border-seal"
          >
            {e.visibility === "member" && <p className="label mb-1 text-seal">Member</p>}
            <p className="font-serif text-xl text-ink">{e.title}</p>
            <p className="mt-1 text-sm text-muted">{e.great_idea}</p>
            <p className="mt-3 line-clamp-2 text-sm text-ink">{e.overview}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
