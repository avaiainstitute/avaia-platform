import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TOOL_REGISTRY, toolLabel, type ToolKey } from "@/lib/toolkit";
import { SUPPORT_CATEGORIES, answerRoutineToolkitQuestion, type SupportCategory } from "@/lib/toolkit-stewardship";
import { getGuideFacingToolkitItems, submitToolkitSupportItem } from "@/lib/ops/toolkit-stewardship";

export const metadata = { title: "Toolkit Support, AVAIA" };
export const dynamic = "force-dynamic";

// Toolkit Stewardship, Guide side. A certified Guide (the Toolkit layout already
// requires an active certification and Toolkit authorization) reports a problem,
// asks a question, or makes a request about a Toolkit resource. A plain question
// the Toolkit registry can answer is answered here on the spot and never becomes
// a ticket. Everything else becomes one item that AVAIA sees through What Needs
// Dorian. A Guide sees only their own items, with the status and the written
// resolution, never who is handling it or any internal note.

const CATEGORY_CHOICES: Record<SupportCategory, string> = {
  SUPPORT: "I need help using it",
  BUG: "Something is broken",
  MISSING_ASSET: "Something is missing",
  VERSION: "Which version is this?",
  CLARIFICATION: "I have a question about it",
  ADAPTATION_REQUEST: "I would like to request an adaptation",
  ADDITION_REQUEST: "I would like to request an addition",
  AUTHORIZATION_QUESTION: "I have a question about my access",
  POLICY_REQUIRED: "This needs an AVAIA decision",
};

const STATE_LABEL: Record<string, string> = {
  open: "Received",
  in_review: "Being looked at",
  awaiting_human: "Waiting for AVAIA",
  resolved: "Resolved",
  closed: "Closed",
};

async function submitSupport(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit/support");

  const toolKey = String(formData.get("toolKey") ?? "") as ToolKey;
  const category = String(formData.get("category") ?? "") as SupportCategory;
  const description = String(formData.get("description") ?? "");
  if (!TOOL_REGISTRY.some((t) => t.key === toolKey) || !SUPPORT_CATEGORIES.includes(category)) {
    redirect("/toolkit/support?error=invalid");
  }

  // A plain question the registry can already answer is answered, not ticketed.
  if (category === "CLARIFICATION" && !description.trim()) {
    const answer = answerRoutineToolkitQuestion(toolKey);
    if (answer.kind === "answered") redirect(`/toolkit/support?answered=${encodeURIComponent(toolKey)}`);
  }

  const result = await submitToolkitSupportItem(supabase, { hostId: user.id, toolKey, category, description });
  if (!result.ok) redirect("/toolkit/support?error=failed");
  redirect("/toolkit/support?submitted=1");
}

export default async function ToolkitSupportPage({
  searchParams,
}: {
  searchParams: { error?: string; submitted?: string; answered?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit/support");

  const items = await getGuideFacingToolkitItems(supabase, user.id).catch(() => []);
  const answeredKey = searchParams.answered as ToolKey | undefined;
  const answer = answeredKey && TOOL_REGISTRY.some((t) => t.key === answeredKey) ? answerRoutineToolkitQuestion(answeredKey) : null;
  const fieldClass = "w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none focus:border-seal";

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to the Toolkit
        </Link>
      </p>
      <p className="label mb-3">Toolkit Support</p>
      <h1 className="font-serif text-4xl text-ink">Report a problem or make a request</h1>
      <p className="mt-4 text-lg text-muted">
        Tell AVAIA about anything in the Toolkit that is broken, missing, unclear, or that you would like adapted or added.
        Only you can see what you send here and what comes back.
      </p>

      {searchParams.submitted && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">Thank you. AVAIA has received it.</p>
      )}
      {searchParams.error && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          That did not go through. Please check what you entered and try again.
        </p>
      )}
      {answeredKey && answer && answer.kind === "answered" && (
        <div className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          <p className="label mb-1 text-muted">From the Toolkit about {toolLabel(answeredKey)}</p>
          <p>{answer.text}</p>
          <p className="mt-2 text-xs text-muted">If this does not answer your question, add a few words describing it below and send it to AVAIA.</p>
        </div>
      )}

      <form action={submitSupport} className="mt-8 space-y-4 rounded-lg border border-rule bg-white/[0.04] p-5">
        <div>
          <label className="label mb-2 block" htmlFor="toolKey">
            Which part of the Toolkit?
          </label>
          <select id="toolKey" name="toolKey" required defaultValue="" className={fieldClass}>
            <option value="" disabled>
              Choose one
            </option>
            {TOOL_REGISTRY.map((t) => (
              <option key={t.key} value={t.key} className="bg-[#05060b] text-ink">
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="category">
            What is this about?
          </label>
          <select id="category" name="category" required defaultValue="" className={fieldClass}>
            <option value="" disabled>
              Choose one
            </option>
            {SUPPORT_CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-[#05060b] text-ink">
                {CATEGORY_CHOICES[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="description">
            Tell us more
          </label>
          <textarea id="description" name="description" rows={5} className={`${fieldClass} resize-none`} />
          <p className="mt-2 text-xs text-muted">
            Please do not include a participant&rsquo;s name or anything private about someone you are guiding.
          </p>
        </div>
        <button type="submit" className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] hover:opacity-90">
          Send to AVAIA
        </button>
      </form>

      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">What you have sent</p>
        {items.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((i) => (
              <div key={i.id} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-ink">
                    {i.toolLabel}
                    <span className="ml-2 text-xs text-muted">{CATEGORY_CHOICES[i.category]}</span>
                  </p>
                  <span className="label text-seal">{STATE_LABEL[i.state] ?? i.state}</span>
                </div>
                <p className="mt-2 text-sm text-muted" style={{ whiteSpace: "pre-wrap" }}>
                  {i.description}
                </p>
                {i.resolution && (
                  <p className="mt-2 text-sm text-ink" style={{ whiteSpace: "pre-wrap" }}>
                    <span className="label mr-2 text-muted">From AVAIA</span>
                    {i.resolution}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted">{new Date(i.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
