import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNeedsDorian, type NeedsBucket } from "@/lib/ops/needs-dorian";

export const metadata = { title: "What Needs Dorian, AVAIA Admin" };
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// "What Needs Dorian Today": the live view of the ONE Needs-Dorian source
// (lib/ops/needs-dorian.ts). The Founder Digest email renders the very same
// snapshot, so this page and the email always agree. Nothing here is stored;
// an item disappears the moment what it describes is resolved. The only
// button is "Mark handled" on a Certification Companion escalation, because
// nothing else records that a person responded to it.

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/today");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  return supabase;
}

async function markEscalationHandled(formData: FormData) {
  "use server";
  const supabase = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) {
    // The signed-in admin's own RLS-bound client; the table's "admin all"
    // policy is the real enforcement.
    await supabase.from("certification_companion_escalations").update({ resolved_at: new Date().toISOString() }).eq("id", id);
  }
  redirect("/admin/today");
}

function Bucket({
  title,
  bucket,
  emptyLabel,
  tone,
  quiet,
}: {
  title: string;
  bucket: NeedsBucket;
  emptyLabel: string;
  tone?: "warn";
  /** Visibility-only sections are drawn quieter and are not counted as tasks. */
  quiet?: boolean;
}) {
  return (
    <section className="rule-t mt-8 border-t border-rule pt-6">
      <div className="flex items-baseline justify-between">
        <p className="label text-muted">{title}</p>
        <span className={`font-serif text-2xl ${tone === "warn" && bucket.count > 0 ? "text-[#e0857d]" : quiet ? "text-muted" : "text-ink"}`}>
          {bucket.count}
        </span>
      </div>
      {bucket.count === 0 ? (
        <p className="mt-2 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {bucket.items.map((item) => (
            <li
              key={item.key}
              className={`rounded-lg border border-rule bg-white/[0.04] px-4 py-2 text-sm ${quiet ? "text-muted" : "text-ink"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span>
                  {item.text}
                  {item.href && (
                    <>
                      {" "}
                      <Link href={item.href} className="text-seal underline-offset-2 hover:underline">
                        Open
                      </Link>
                    </>
                  )}
                </span>
                {item.resolve && (
                  <form action={markEscalationHandled}>
                    <input type="hidden" name="id" value={item.resolve.id} />
                    <button type="submit" className="rounded-md border border-rule px-3 py-1 text-xs text-ink hover:border-seal">
                      Mark handled
                    </button>
                  </form>
                )}
              </div>
              {item.detail && <p className="mt-2 text-xs text-muted">{item.detail}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function WhatNeedsDorianPage() {
  await requireAdmin();
  const snapshot = await getNeedsDorian();

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin" className="label hover:text-seal">
          ← Back to Admin
        </Link>
      </p>
      <p className="label mb-3">AVAIA + Pink Shoelace Admin</p>
      <h1 className="font-serif text-4xl text-ink">What Needs Dorian Today</h1>
      <p className="mt-4 text-lg text-muted">
        {snapshot.totalNeeded === 0
          ? "Nothing needs you right now. Everything else is being handled."
          : `${snapshot.totalNeeded} thing(s) genuinely need you today.`}
      </p>
      <p className="mt-2 text-sm text-muted">
        This is the same list as your daily email. Anything resolved disappears from here on its own.
      </p>

      <Bucket title="Problems" bucket={snapshot.problems} emptyLabel="No system problems detected." tone="warn" />
      <Bucket title="Decisions" bucket={snapshot.decisions} emptyLabel="No decisions waiting on you." />
      <Bucket title="People" bucket={snapshot.people} emptyLabel="No calls or replies waiting on you." />
      <Bucket title="Approvals" bucket={snapshot.approvals} emptyLabel="Nothing waiting on your approval." />
      <Bucket
        title="Opportunities"
        bucket={snapshot.opportunities}
        emptyLabel="No new research-found opportunities awaiting your first look."
        quiet
      />
      <Bucket title="Being watched (nothing for you to do)" bucket={snapshot.watching} emptyLabel="Nothing being watched." quiet />

      <section className="rule-t mt-8 border-t border-rule pt-6">
        <p className="label mb-3 text-muted">Everything Else -- Handled</p>
        <ul className="space-y-1 text-sm text-muted">
          {snapshot.automatic.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-6">
        <p className="label mb-3 text-muted">Capture Something</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/notes" className="rounded-md border border-rule px-4 py-2 text-sm text-ink hover:border-seal">
            Log an idea, decision, or follow-up
          </Link>
          <Link href="/admin/opportunities" className="rounded-md border border-rule px-4 py-2 text-sm text-ink hover:border-seal">
            Review opportunities
          </Link>
          <Link href="/admin/system-checks" className="rounded-md border border-rule px-4 py-2 text-sm text-ink hover:border-seal">
            System checks
          </Link>
        </div>
      </section>
    </div>
  );
}
