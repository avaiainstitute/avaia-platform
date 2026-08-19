import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listGuideParticipants,
  listGuideSessions,
  hasReferralForConversation,
  type GuideParticipant,
} from "@/lib/guide";
import { TOOL_REGISTRY, toolLabel } from "@/lib/toolkit";

export const metadata = { title: "Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

/** Finds an existing AVAIA account by email, if one exists -- same
 *  page-through-listUsers pattern already used in app/api/share/route.ts,
 *  not a new mechanism. Written fresh here rather than importing that
 *  route's private helper, so the existing, working share flow stays
 *  untouched. */
async function findHostIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

/** Creates a participant (linked to an existing Host account by email if
 *  one is found -- no invite/auto-link-on-signup mechanism yet, that's a
 *  deliberate follow-up, not required for this build) and immediately
 *  starts an IAP session for them, the only installed tool so far. */
async function startIapSession(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!name) redirect("/toolkit");

  const linkedHostId = email ? await findHostIdByEmail(email) : null;

  const { data: participant, error: participantError } = await supabase
    .from("guide_participants")
    .insert({
      guide_id: user.id,
      name,
      email: email || null,
      linked_host_id: linkedHostId,
    })
    .select("id")
    .single();
  if (participantError || !participant) redirect("/toolkit");

  const { data: session, error: sessionError } = await supabase
    .from("guide_sessions")
    .insert({ guide_id: user.id, participant_id: participant.id, tool: "iap" })
    .select("id")
    .single();
  if (sessionError || !session) redirect("/toolkit");

  redirect(`/toolkit/iap/${session.id}`);
}

/** Starts a new IAP session for an existing participant -- same underlying
 *  action as startIapSession above, just skipping participant creation. */
async function startIapSessionForExisting(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const participantId = String(formData.get("participantId") ?? "");
  if (!participantId) redirect("/toolkit");

  const { data: session, error } = await supabase
    .from("guide_sessions")
    .insert({ guide_id: user.id, participant_id: participantId, tool: "iap" })
    .select("id")
    .single();
  if (error || !session) redirect("/toolkit");

  redirect(`/toolkit/iap/${session.id}`);
}

export default async function ToolkitDashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const [participants, sessions] = await Promise.all([
    listGuideParticipants(supabase, user.id),
    listGuideSessions(supabase, user.id),
  ]);

  const participantById = new Map<string, GuideParticipant>(participants.map((p) => [p.id, p]));

  const sessionReferralFlags = await Promise.all(
    sessions.map((s) => (s.conversation_id ? hasReferralForConversation(supabase, s.conversation_id) : Promise.resolve(false)))
  );

  return (
    <div>
      <p className="label mb-3">Guide Dashboard</p>
      <h1 className="font-serif text-4xl text-ink">Welcome back.</h1>
      <p className="mt-4 text-lg text-muted">
        Begin a session with someone new, continue an existing one, or explore what&rsquo;s
        available in the Toolkit below.
      </p>

      {/* Start a new session */}
      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Start a New Session</p>
        <form action={startIapSession} className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label mb-2 block" htmlFor="name">
                Participant name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
            </div>
            <div>
              <label className="label mb-2 block" htmlFor="email">
                Email (optional — links to their AVAIA account if they have one)
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">
            Tool: <span className="text-ink">Individual Awareness Profile</span> — CAT and
            InnerCompass follow automatically as this session progresses, the same handoff every
            Host gets. For Defying Grief or Unsung Heroes, use their own entries in the Toolkit
            below.
          </p>
          <button
            type="submit"
            className="mt-4 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Begin Individual Awareness Profile
          </button>
        </form>
      </section>

      {/* Existing participants */}
      {participants.length > 0 && (
        <section className="rule-t mt-14 border-t border-rule pt-8">
          <p className="label mb-3 text-muted">Participants</p>
          <div className="space-y-2">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3"
              >
                <div>
                  <p className="text-ink">{p.name}</p>
                  <p className="text-xs text-muted">
                    {p.email ?? "No email on file"}
                    {p.linked_host_id ? " · Linked to an AVAIA account" : ""}
                  </p>
                </div>
                <form action={startIapSessionForExisting}>
                  <input type="hidden" name="participantId" value={p.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
                  >
                    New IAP session
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sessions */}
      {sessions.length > 0 && (
        <section className="rule-t mt-14 border-t border-rule pt-8">
          <p className="label mb-3 text-muted">Sessions</p>
          <div className="space-y-2">
            {sessions.map((s, i) => {
              const participant = s.participant_id ? participantById.get(s.participant_id) : null;
              const referralSaved = sessionReferralFlags[i];
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3"
                >
                  <div>
                    <p className="text-ink">
                      {participant?.name ?? "Unnamed participant"} — {toolLabel(s.tool)}
                    </p>
                    <p className="text-xs text-muted">
                      {s.status === "complete" ? "Complete" : "In progress"}
                      {referralSaved ? " · Referral saved" : ""}
                    </p>
                  </div>
                  {(s.tool === "iap" || s.tool === "cat" || s.tool === "innercompass" || s.tool === "unsung-heroes") && (
                    <Link
                      href={`/toolkit/${s.tool}/${s.id}`}
                      className="rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
                    >
                      Open
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Records / continuity -- the Workbook is the existing, real
          continuity view (referrals, transcripts, patterns across
          journeys); it isn't a separate Guide-only record, since
          Guide-facilitated conversations live under the Guide's own
          account. No "Master Connection Map" or equivalent was found
          anywhere in the codebase -- not built here, not invented. */}
      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Records &amp; Continuity</p>
        <p className="text-muted">
          Every referral generated through the Toolkit is saved to your own Guide&rsquo;s Record,
          the same Workbook every AVAIA Host has.
        </p>
        <Link
          href="/workbook"
          prefetch={false}
          className="mt-3 inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
        >
          View Guide&rsquo;s Record
        </Link>
      </section>

      {/* Tool registry */}
      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">The Toolkit</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {TOOL_REGISTRY.map((tool) => (
            <div key={tool.key} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-serif text-lg text-ink">{tool.label}</p>
                <span className="label shrink-0 text-muted">
                  {tool.status === "installed"
                    ? "Installed"
                    : tool.status === "specified-not-installed"
                      ? "Not yet installed"
                      : "Specification pending"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{tool.description}</p>
              {tool.href && (
                <Link href={tool.href} className="mt-2 inline-block text-sm text-ink underline decoration-rule underline-offset-2 hover:text-seal">
                  Open →
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
