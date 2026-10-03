import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPinkSnapshot } from "@/lib/pink/ops";
import type { NeedsItem } from "@/lib/ops/needs-dorian-core";

export const metadata = { title: "Pink Shoelace Foundation Admin" };
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// The Pink Shoelace Foundation's own admin home. Separate from AVAIA's admin:
// nothing about AVAIA appears here, and nothing about Pink Shoelace appears in
// AVAIA's admin. Same sign-in and admin role for now (Stage 1 of the
// separation); Stage 2 moves this whole area to its own project.

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/pink-admin");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
}

function Section({ title, items, empty, quiet }: { title: string; items: NeedsItem[]; empty: string; quiet?: boolean }) {
  return (
    <section className="rule-t mt-8 border-t border-rule pt-6">
      <div className="flex items-baseline justify-between">
        <p className="label text-muted">{title}</p>
        <span className={`font-serif text-2xl ${quiet ? "text-muted" : "text-ink"}`}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.key} className={`rounded-lg border border-rule bg-white/[0.04] px-4 py-2 text-sm ${quiet ? "text-muted" : "text-ink"}`}>
              {item.text}
              {item.href && (
                <>
                  {" "}
                  <Link href={item.href} className="text-seal underline-offset-2 hover:underline">
                    Open
                  </Link>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function PinkAdminHome() {
  await requireAdmin();
  const snapshot = await getPinkSnapshot();

  // The Pink Shoelace site and intake checks (recorded by the scheduled system checks).
  const admin = createAdminClient();
  const { data: latest } = await admin.from("system_check_results").select("run_id, checked_at").order("checked_at", { ascending: false }).limit(1).maybeSingle();
  const { data: checkRows } = latest
    ? await admin
        .from("system_check_results")
        .select("check_key, label, status, detail")
        .eq("run_id", latest.run_id)
        .like("check_key", "pink_%")
        .order("check_key", { ascending: true })
    : { data: [] as { check_key: string; label: string; status: string; detail: string | null }[] };

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="label mb-3">Pink Shoelace Foundation Admin</p>
      <h1 className="font-serif text-4xl text-ink">What Needs Attention</h1>
      <p className="mt-4 text-lg text-muted">
        {snapshot.totalNeeded === 0
          ? "Nothing needs you right now."
          : `${snapshot.totalNeeded} thing(s) need you today.`}
      </p>
      <p className="mt-2 text-sm text-muted">
        This is the same list as the Pink Shoelace daily summary email. The Pink Shoelace Foundation is separate from
        AVAIA; AVAIA&rsquo;s admin does not show any of this.
      </p>

      <Section title="Problems" items={snapshot.problems} empty="No Pink Shoelace site or intake problems detected." />
      <Section title="People" items={snapshot.people} empty="No calls, replies or follow-ups waiting on you." />
      <Section title="Approvals" items={snapshot.approvals} empty="Nothing waiting on your approval." />
      <Section title="Opportunities" items={snapshot.opportunities} empty="No new research-found opportunities awaiting your first look." quiet />

      <section className="rule-t mt-8 border-t border-rule pt-6">
        <p className="label mb-3 text-muted">Pink Shoelace Site and Intake Checks</p>
        {!checkRows || checkRows.length === 0 ? (
          <p className="text-sm text-muted">No checks recorded yet; they run automatically every six hours.</p>
        ) : (
          <ul className="space-y-2">
            {checkRows.map((r) => (
              <li key={r.check_key} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-2 text-sm">
                <span className="text-ink">
                  {r.label}
                  {r.detail && <span className="mt-1 block text-xs text-muted">{r.detail}</span>}
                </span>
                <span className={`label ${r.status === "pass" ? "text-seal" : "text-[#e0857d]"}`}>{r.status === "pass" ? "PASS" : "NEEDS ATTENTION"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-6">
        <p className="label mb-3 text-muted">Pink Shoelace Tools</p>
        <div className="flex flex-wrap gap-3">
          {[
            { href: "/pink-admin/inquiries", label: "Inquiries" },
            { href: "/pink-admin/opportunities", label: "Opportunities" },
            { href: "/pink-admin/notes", label: "Ideas, decisions & follow-ups" },
            { href: "/pink-admin/content", label: "Communications & content" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md border border-rule px-4 py-2 text-sm text-ink hover:border-seal">
              {l.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
