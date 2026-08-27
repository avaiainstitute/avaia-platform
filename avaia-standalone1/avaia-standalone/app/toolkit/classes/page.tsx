import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CLASS_FAMILY_LABEL, type AvaiaClass } from "@/lib/experiences";

export const metadata = { title: "Classes — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

/** Read-only Class Library browse for Guides -- minimum first slice. The
 *  20 approved Classes are seeded as status='draft' (migration 0020), so
 *  this page will legitimately show "nothing published yet" until they're
 *  explicitly published -- an honest empty state, not a broken one. No
 *  Experience Builder, no admin CRUD UI, in this pass. */
export default async function ToolkitClassesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const { data } = await supabase
    .from("classes")
    .select("*")
    .eq("status", "published")
    .order("family", { ascending: true })
    .order("title", { ascending: true });
  const classes = (data as AvaiaClass[]) ?? [];

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Class Library</p>
      <h1 className="font-serif text-4xl text-ink">Classes</h1>
      <p className="mt-4 text-lg text-muted">
        Smaller, focused modules that can stand alone, become breakout sessions, or support one
        or more full Experiences — the content-management tooling for building and publishing
        these is a separate, later step.
      </p>

      {classes.length === 0 ? (
        <p className="mt-10 text-muted">Nothing published yet.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {classes.map((cls) => (
            <div key={cls.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              <p className="label mb-1">{CLASS_FAMILY_LABEL[cls.family]}</p>
              <p className="font-serif text-lg text-ink">{cls.title}</p>
              {cls.summary && <p className="mt-1 text-sm text-muted">{cls.summary}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
