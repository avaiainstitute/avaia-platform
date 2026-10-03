import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toolLabel } from "@/lib/toolkit";
import { SUPPORT_STATES, requiresHumanApproval, type SupportState } from "@/lib/toolkit-stewardship";
import {
  getAllToolkitSupportItems,
  getToolkitRegistryHealth,
  recordToolkitSupportResolution,
} from "@/lib/ops/toolkit-stewardship";

export const metadata = { title: "Toolkit Support, AVAIA Admin" };
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Toolkit Stewardship, admin side: the queue of what Guides have reported or
// requested, the live health of the Toolkit registry, and the one place a
// resolution is written. Resolution text is only ever what a person types here;
// nothing in AVAIA writes one, approves an adaptation or addition, or decides a
// policy question on anyone's behalf.

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/toolkit-support");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
}

async function resolveItem(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const state = String(formData.get("state") ?? "") as SupportState;
  const resolution = String(formData.get("resolution") ?? "");
  if (!id || !SUPPORT_STATES.includes(state)) redirect("/admin/toolkit-support?error=invalid");
  const result = await recordToolkitSupportResolution({ itemId: id, state, resolution });
  redirect(result.ok ? "/admin/toolkit-support?saved=1" : "/admin/toolkit-support?error=failed");
}

export default async function AdminToolkitSupportPage({ searchParams }: { searchParams: { error?: string; saved?: string } }) {
  await requireAdmin();
  const [items, health] = await Promise.all([getAllToolkitSupportItems(), getToolkitRegistryHealth()]);
  const open = items.filter((i) => i.state !== "resolved" && i.state !== "closed");
  const done = items.length - open.length;
  const fieldClass = "w-full rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink";

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin/operations" className="label hover:text-seal">
          ← Back to Operations
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">Toolkit Support</h1>
      <p className="mt-4 text-lg text-muted">
        What Guides have reported or requested about the Toolkit. {open.length} open, {done} resolved or closed. Adaptation, addition and policy
        items are yours to decide; nothing here approves them for you.
      </p>
      {searchParams.saved && <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">Saved.</p>}
      {searchParams.error && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">That did not save. Please try again.</p>
      )}

      <section className="rule-t mt-10 border-t border-rule pt-6">
        <p className="label mb-3 text-muted">Toolkit health (checked live)</p>
        {health.length === 0 ? (
          <p className="text-sm text-muted">Every tool the registry marks as installed has a working page, and nothing marked unavailable has appeared.</p>
        ) : (
          <ul className="space-y-2">
            {health.map((h) => (
              <li key={`${h.toolKey}:${h.kind}`} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-2 text-sm text-ink">
                {h.detail}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-6">
        <p className="label mb-3 text-muted">Open items</p>
        {open.length === 0 ? (
          <p className="text-sm text-muted">Nothing open.</p>
        ) : (
          <div className="space-y-3">
            {open.map((i) => (
              <details key={i.id} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3" open>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                  <span className="text-ink">
                    {toolLabel(i.toolKey)} <span className="ml-1 text-xs text-muted">{i.category.replace(/_/g, " ").toLowerCase()}</span>
                  </span>
                  <span className="label text-seal">{requiresHumanApproval(i.category) ? "NEEDS YOUR DECISION" : i.state.replace(/_/g, " ")}</span>
                </summary>
                <p className="mt-3 text-sm text-muted" style={{ whiteSpace: "pre-wrap" }}>
                  {i.description}
                </p>
                <p className="mt-1 text-xs text-muted">Received {new Date(i.createdAt).toLocaleString()}</p>
                <form action={resolveItem} className="mt-4 space-y-3">
                  <input type="hidden" name="id" value={i.id} />
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="label mb-1 block text-xs">Status</label>
                      <select name="state" defaultValue={i.state} className={fieldClass}>
                        {SUPPORT_STATES.map((s) => (
                          <option key={s} value={s} className="bg-[#05060b] text-ink">
                            {s.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" className="rounded-md bg-seal px-4 py-2 text-sm font-semibold text-[#05060b] hover:opacity-90">
                      Save
                    </button>
                  </div>
                  <div>
                    <label className="label mb-1 block text-xs">Reply to the Guide (they will see this when you mark it resolved or closed)</label>
                    <textarea name="resolution" rows={3} defaultValue={i.resolution ?? ""} className={`${fieldClass} resize-none`} />
                  </div>
                </form>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
