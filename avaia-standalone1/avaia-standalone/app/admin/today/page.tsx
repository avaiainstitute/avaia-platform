import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCommandCenterSnapshot } from "@/lib/ops/command-center";

export const metadata = { title: "What Needs Dorian, AVAIA Admin" };
export const dynamic = "force-dynamic";

// "What Needs Dorian Today" -- the primary operating view (Round 4, Group
// 1, item 1), built as an extension of the existing Founder/Operations
// Agent rather than a new agent. Deliberately the first thing linked from
// /admin: the goal is that this page, plus the daily email it shares its
// data with, is the only place Dorian has to look.

function Bucket({
  title,
  bucket,
  emptyLabel,
  tone,
}: {
  title: string;
  bucket: { count: number; items: string[] };
  emptyLabel: string;
  tone?: "warn";
}) {
  return (
    <section className="rule-t mt-8 border-t border-rule pt-6">
      <div className="flex items-baseline justify-between">
        <p className="label text-muted">{title}</p>
        <span className={`font-serif text-2xl ${tone === "warn" && bucket.count > 0 ? "text-[#e0857d]" : "text-ink"}`}>
          {bucket.count}
        </span>
      </div>
      {bucket.count === 0 ? (
        <p className="mt-2 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {bucket.items.map((item, i) => (
            <li key={i} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-2 text-sm text-ink">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function WhatNeedsDorianPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/today");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const snapshot = await getCommandCenterSnapshot();
  const totalNeeded =
    snapshot.people.count + snapshot.decisions.count + snapshot.approvals.count + snapshot.problems.count;

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
        {totalNeeded === 0
          ? "Nothing needs you right now. Everything else is being handled."
          : `${totalNeeded} thing(s) genuinely need you today.`}
      </p>

      <Bucket title="People" bucket={snapshot.people} emptyLabel="No calls or replies waiting on you." />
      <Bucket title="Decisions" bucket={snapshot.decisions} emptyLabel="No decisions waiting on you." />
      <Bucket title="Approvals" bucket={snapshot.approvals} emptyLabel="Nothing waiting on your approval." />
      <Bucket title="Problems" bucket={snapshot.problems} emptyLabel="No system problems detected." tone="warn" />
      <Bucket
        title="Opportunities"
        bucket={snapshot.opportunities}
        emptyLabel="No new research-found opportunities awaiting your first look."
      />

      <section className="rule-t mt-8 border-t border-rule pt-6">
        <p className="label mb-3 text-muted">Everything Else -- Handled</p>
        <ul className="space-y-1 text-sm text-muted">
          {snapshot.handledSummary.map((line, i) => (
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
