import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { evaluateCapabilities } from "@/lib/ops/capabilities";
import type { NeedsItem } from "@/lib/ops/needs-dorian-core";

export const metadata = { title: "Operations, AVAIA Admin" };
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// One page for every operational capability (Guide Operations, Host/Participant
// Operations, Organization/Event Operations, Toolkit Stewardship, Conversation
// Integrity, Program Operations): what each one examined just now and what it
// found. It replaces a separate admin page per capability. Anything that needs a
// person is also in What Needs Dorian and the daily digest; this page is the place
// to see the detail and to confirm each capability is actually operating.

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/operations");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
}

/** Where a person manages each capability, when it has somewhere to act. */
const MANAGE: Record<string, { href: string; label: string }> = {
  guide_operations: { href: "/admin/guide-certifications", label: "Guide certifications" },
  organization_operations: { href: "/admin/organization-admins", label: "Organization administrators" },
  toolkit_stewardship: { href: "/admin/toolkit-support", label: "Toolkit support queue" },
  conversation_integrity: { href: "/admin/conversation-integrity", label: "Integrity review queue" },
};

function ItemList({ title, items, tone }: { title: string; items: NeedsItem[] | undefined; tone?: "quiet" }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="label text-muted">
        {title} ({items.length})
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.key} className={`rounded-lg border border-rule bg-white/[0.04] px-4 py-2 text-sm ${tone === "quiet" ? "text-muted" : "text-ink"}`}>
            {item.text}
            {item.href && (
              <>
                {" "}
                <Link href={item.href} className="text-seal underline-offset-2 hover:underline">
                  Open
                </Link>
              </>
            )}
            {item.detail && <p className="mt-1 text-xs text-muted">{item.detail}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function AdminOperationsPage() {
  await requireAdmin();
  const { results, evidence } = await evaluateCapabilities();

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin" className="label hover:text-seal">
          ← Back to Admin
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">Operations</h1>
      <p className="mt-4 text-lg text-muted">
        Every operational capability, evaluated just now. Anything that needs you is also in{" "}
        <Link href="/admin/today" className="underline hover:text-seal">
          What Needs Dorian
        </Link>{" "}
        and the daily digest; the rest is handled without you.
      </p>

      {results.map((r) => {
        const ev = evidence.find((e) => e.key === r.key);
        return (
          <section key={r.key} className="rule-t mt-10 border-t border-rule pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-serif text-2xl text-ink">{r.label}</p>
              <span className={`label ${ev?.ok ? "text-seal" : "text-[#e0857d]"}`}>{ev?.ok ? "OPERATING" : "NOT OPERATING"}</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              Examined {r.evaluated} record(s) just now.
              {MANAGE[r.key] && (
                <>
                  {" "}
                  <Link href={MANAGE[r.key].href} className="text-seal underline-offset-2 hover:underline">
                    {MANAGE[r.key].label}
                  </Link>
                </>
              )}
            </p>
            <ItemList title="Problems" items={r.problems} />
            <ItemList title="Decisions" items={r.decisions} />
            <ItemList title="People" items={r.people} />
            <ItemList title="Approvals" items={r.approvals} />
            <ItemList title="Being watched" items={r.watching} tone="quiet" />
            {(r.problems?.length ?? 0) + (r.decisions?.length ?? 0) + (r.people?.length ?? 0) + (r.approvals?.length ?? 0) + (r.watching?.length ?? 0) === 0 && (
              <p className="mt-3 text-sm text-muted">Nothing found. Everything examined is as it should be.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
