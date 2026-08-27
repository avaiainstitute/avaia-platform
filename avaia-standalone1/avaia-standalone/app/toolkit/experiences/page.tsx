import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Experience } from "@/lib/experiences";

export const metadata = { title: "Experiences — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

/** Read-only Experience browse for Guides -- minimum first slice. The 11
 *  approved Experiences are seeded as status='draft' (migration 0020), so
 *  this page will legitimately show "nothing published yet" until they're
 *  explicitly published -- an honest empty state, not a broken one. No
 *  Experience Builder, no admin CRUD UI, in this pass. */
export default async function ToolkitExperiencesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const { data } = await supabase
    .from("experiences")
    .select("*")
    .eq("status", "published")
    .order("title", { ascending: true });
  const experiences = (data as Experience[]) ?? [];

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Full AVAIA Experiences</p>
      <h1 className="font-serif text-4xl text-ink">Experiences</h1>
      <p className="mt-4 text-lg text-muted">
        Together in the experience. Individual in the conversation. Larger Experience containers
        capable of supporting presentations, workshops, retreats, and connected AVAIA
        conversations — the content-management tooling for building and publishing these is a
        separate, later step.
      </p>

      {experiences.length === 0 ? (
        <p className="mt-10 text-muted">Nothing published yet.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {experiences.map((experience) => (
            <div
              key={experience.id}
              className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4"
            >
              <p className="font-serif text-lg text-ink">{experience.title}</p>
              {experience.summary && (
                <p className="mt-1 text-sm text-muted">{experience.summary}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
