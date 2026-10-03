import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HUMAN_DISPOSITIONS, type HumanDisposition, type ReviewStatus } from "@/lib/conversation-integrity";
import { getAllIntegrityFlags, recordIntegrityDisposition } from "@/lib/ops/conversation-integrity";

export const metadata = { title: "Conversation Integrity, AVAIA Admin" };
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Conversation Integrity & Boundary Oversight: the review queue. Every flag here
// is a POSSIBLE flag raised by a keyword check on the AI's own reply, or by the
// crisis pathway check. It carries a category, the AVAIA rule it may be
// inconsistent with, and how it was detected. It NEVER carries any message text,
// and no Host's words were scanned. A flag becomes a finding only when a person
// records a disposition here; nothing else in AVAIA ever sets one.

const STATUSES: ReviewStatus[] = ["open", "in_review", "resolved"];

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/conversation-integrity");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  return user.id;
}

async function recordDisposition(formData: FormData) {
  "use server";
  const reviewerId = await requireAdmin();
  const flagId = String(formData.get("flagId") ?? "");
  const reviewStatus = String(formData.get("reviewStatus") ?? "") as ReviewStatus;
  const rawDisposition = String(formData.get("humanDisposition") ?? "");
  const humanDisposition = HUMAN_DISPOSITIONS.includes(rawDisposition as HumanDisposition) ? (rawDisposition as HumanDisposition) : null;
  const correctiveAction = String(formData.get("correctiveAction") ?? "");
  if (!flagId || !STATUSES.includes(reviewStatus)) redirect("/admin/conversation-integrity?error=invalid");
  // Resolving a flag requires a recorded disposition: that is what makes it a finding or a clearance.
  if (reviewStatus === "resolved" && !humanDisposition) redirect("/admin/conversation-integrity?error=disposition_required");
  const result = await recordIntegrityDisposition({ flagId, reviewerId, reviewStatus, humanDisposition, correctiveAction });
  redirect(result.ok ? "/admin/conversation-integrity?saved=1" : "/admin/conversation-integrity?error=failed");
}

const SEVERITY_ORDER: Record<string, number> = { LEGAL_REVIEW_REQUIRED: 0, POLICY_REQUIRED: 1, HIGH_PRIORITY: 2, REVIEW: 3, INFORMATIONAL: 4 };

export default async function AdminConversationIntegrityPage({ searchParams }: { searchParams: { error?: string; saved?: string } }) {
  await requireAdmin();
  const flags = await getAllIntegrityFlags();
  const open = flags.filter((f) => f.reviewStatus !== "resolved").sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  const resolvedCount = flags.length - open.length;
  const fieldClass = "w-full rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink";

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin/operations" className="label hover:text-seal">
          ← Back to Operations
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">Conversation Integrity</h1>
      <p className="mt-4 text-lg text-muted">
        Possible boundary flags on the AI&rsquo;s own replies. {open.length} awaiting review, {resolvedCount} resolved. No message text is stored here and no one&rsquo;s own
        words were scanned; a flag is only a prompt to look, never a conclusion about anyone.
      </p>
      {searchParams.saved && <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">Saved.</p>}
      {searchParams.error && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          {searchParams.error === "disposition_required" ? "Choose a disposition before marking a flag resolved." : "That did not save. Please try again."}
        </p>
      )}

      <section className="rule-t mt-10 border-t border-rule pt-6">
        <p className="label mb-3 text-muted">Awaiting review</p>
        {open.length === 0 ? (
          <p className="text-sm text-muted">Nothing awaiting review.</p>
        ) : (
          <div className="space-y-3">
            {open.map((f) => (
              <details key={f.id} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3" open={f.severity !== "REVIEW" && f.severity !== "INFORMATIONAL"}>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                  <span className="text-ink">{f.flagCategory.replace(/_/g, " ").toLowerCase()}</span>
                  <span className={`label ${f.severity === "HIGH_PRIORITY" || f.severity === "LEGAL_REVIEW_REQUIRED" ? "text-[#e0857d]" : "text-seal"}`}>{f.severity.replace(/_/g, " ")}</span>
                </summary>
                <div className="mt-3 space-y-1 text-sm text-muted">
                  <p>AVAIA rule it may be inconsistent with: {f.avaiaRuleImplicated}</p>
                  <p>How it was detected: {f.detectionBasis}</p>
                  <p>
                    Where: {f.program ?? "conversation"}
                    {f.stage ? ` · ${f.stage}` : ""} · {new Date(f.createdAt).toLocaleString()}
                    {f.modelSnapshot ? ` · ${f.modelSnapshot}` : ""}
                  </p>
                </div>
                <form action={recordDisposition} className="mt-4 space-y-3">
                  <input type="hidden" name="flagId" value={f.id} />
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="label mb-1 block text-xs">Review status</label>
                      <select name="reviewStatus" defaultValue={f.reviewStatus} className={fieldClass}>
                        {STATUSES.map((s) => (
                          <option key={s} value={s} className="bg-[#05060b] text-ink">
                            {s.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label mb-1 block text-xs">Your disposition</label>
                      <select name="humanDisposition" defaultValue={f.humanDisposition ?? ""} className={fieldClass}>
                        <option value="" className="bg-[#05060b] text-ink">
                          --
                        </option>
                        {HUMAN_DISPOSITIONS.map((d) => (
                          <option key={d} value={d} className="bg-[#05060b] text-ink">
                            {d.replace(/_/g, " ").toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" className="rounded-md bg-seal px-4 py-2 text-sm font-semibold text-[#05060b] hover:opacity-90">
                      Save
                    </button>
                  </div>
                  <div>
                    <label className="label mb-1 block text-xs">Corrective action (optional)</label>
                    <textarea name="correctiveAction" rows={2} defaultValue={f.correctiveAction ?? ""} className={`${fieldClass} resize-none`} />
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
