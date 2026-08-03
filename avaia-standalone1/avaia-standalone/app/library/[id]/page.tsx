import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { familyOf } from "@/lib/virtues";
import { JOURNEY_STAGE_LABEL, PROGRAM_LABEL, type LibraryEntry } from "@/lib/library";
import type { Program, Stage } from "@/lib/engine/prompts";

export const dynamic = "force-dynamic";

export default async function LibraryEntryPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("library_entries")
    .select("*")
    .eq("id", params.id)
    .eq("status", "published")
    .maybeSingle();

  // RLS returns null both for a genuinely missing id and for a member-only
  // entry the current visitor isn't allowed to see — deliberately not
  // distinguished, so a restricted entry's existence isn't confirmed to
  // someone who can't view it.
  if (!data) notFound();
  const entry = data as LibraryEntry;

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <Link href="/library" className="label hover:text-seal">
        ← Library
      </Link>

      {entry.visibility === "member" && <p className="label mt-6 text-seal">Member</p>}
      <h1 className="mt-2 font-serif text-4xl text-ink">{entry.title}</h1>
      <p className="mt-2 text-lg text-muted">{entry.great_idea}</p>

      <p className="mt-6 text-lg leading-relaxed text-ink">{entry.overview}</p>

      {entry.content_type === "avaia-owned" && entry.body && (
        <div className="mt-8 whitespace-pre-wrap font-serif text-lg leading-relaxed text-ink">
          {entry.body}
        </div>
      )}

      {entry.content_type === "external-resource" && (
        <div className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          {entry.external_author && <p className="label text-muted">By {entry.external_author}</p>}
          {entry.external_description && (
            <p className="mt-2 text-ink">{entry.external_description}</p>
          )}
          {entry.external_url && (
            <a
              href={entry.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-seal hover:underline"
            >
              Visit resource →
            </a>
          )}
        </div>
      )}

      <div className="mt-10 space-y-5">
        {entry.virtues.length > 0 && (
          <div>
            <p className="label mb-2 text-muted">Virtues</p>
            <div className="flex flex-wrap gap-2">
              {entry.virtues.map((v, i) => {
                const fam = familyOf(v.family);
                return (
                  <Link
                    key={i}
                    href={`/library?virtue=${fam.key}`}
                    className="rounded-full px-3 py-1 text-sm text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: fam.color }}
                  >
                    {v.element ? `${v.element} · ${fam.name}` : fam.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {entry.secondary_losses.length > 0 && (
          <div>
            <p className="label mb-2 text-muted">Secondary Losses</p>
            <div className="flex flex-wrap gap-2">
              {entry.secondary_losses.map((l) => (
                <Link
                  key={l}
                  href={`/library?loss=${encodeURIComponent(l)}`}
                  className="rounded-full border border-rule px-3 py-1 text-sm text-ink transition-colors hover:border-seal"
                >
                  {l}
                </Link>
              ))}
            </div>
          </div>
        )}

        {entry.journey_stages.length > 0 && (
          <div>
            <p className="label mb-2 text-muted">Journey Stages</p>
            <div className="flex flex-wrap gap-2">
              {entry.journey_stages.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-rule px-3 py-1 text-sm text-ink"
                >
                  {JOURNEY_STAGE_LABEL[s as Stage]}
                </span>
              ))}
            </div>
          </div>
        )}

        {entry.programs.length > 0 && (
          <div>
            <p className="label mb-2 text-muted">Programs</p>
            <div className="flex flex-wrap gap-2">
              {entry.programs.map((p) => (
                <Link
                  key={p}
                  href={`/library?program=${p}`}
                  className="rounded-full border border-rule px-3 py-1 text-sm text-ink transition-colors hover:border-seal"
                >
                  {PROGRAM_LABEL[p as Program]}
                </Link>
              ))}
            </div>
          </div>
        )}

        {entry.tags.length > 0 && (
          <div>
            <p className="label mb-2 text-muted">Tags</p>
            <div className="flex flex-wrap gap-2">
              {entry.tags.map((t) => (
                <span key={t} className="text-sm text-muted">
                  #{t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
