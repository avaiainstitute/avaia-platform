import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listGuideParticipants,
  listGuideSessions,
  hasReferralForConversation,
  isGuidedJourneyFacilitationAuthorized,
  type GuideParticipant,
} from "@/lib/guide";
import { TOOL_REGISTRY, toolLabel } from "@/lib/toolkit";
import { deleteYouthParticipantData } from "@/lib/youth-data-deletion";
import { UNSUNG_HEROES_PATH_LABEL, type UnsungHeroesPath } from "@/lib/engine/prompts";
import { startUnsungHeroesSession } from "@/lib/engine/unsung-heroes";

const UNSUNG_HEROES_PATHS = Object.keys(UNSUNG_HEROES_PATH_LABEL) as UnsungHeroesPath[];

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

/** Permanently removes a Guide's own participant and every record linked
 *  to them -- found missing during the demonstration-path audit: a Guide
 *  had no way at all to clean up a throwaway participant created here
 *  (e.g. a live demo run with someone), and the admin Youth-data tool's
 *  own search only ever finds participants with a developmental_band set
 *  (see app/admin/youth-data/page.tsx), so an adult demo participant was
 *  unreachable from there too. Reuses deleteYouthParticipantData as-is --
 *  despite the name, its cascade was never actually Youth-specific (no
 *  band filter anywhere in it), so this is genuine reuse, not a new
 *  deletion mechanism. Ownership is verified here, with the caller's own
 *  RLS-scoped client, before the admin (service-role) client is ever
 *  used for the actual cascading delete -- same two-step posture the
 *  admin route itself uses. */
async function removeParticipant(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const participantId = String(formData.get("participantId") ?? "");
  if (!participantId) redirect("/toolkit");

  const { data: participant } = await supabase
    .from("guide_participants")
    .select("id, guide_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.guide_id !== user.id) redirect("/toolkit");

  const admin = createAdminClient();
  await deleteYouthParticipantData(admin, participantId);

  redirect("/toolkit");
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

  // Guided Journeys (Phase E.4) live at their own route, app/guided-journeys/,
  // deliberately outside /toolkit -- Toolkit and Guided Journey Facilitation
  // are independent professional capabilities (see app/guided-journeys/
  // layout.tsx's own comment for why). This page only needs to know whether
  // to show the link-out below, not the actual invitation list.
  const guidedJourneyFacilitationAuthorized = await isGuidedJourneyFacilitationAuthorized(supabase, user.id);

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
            Host gets. For an adult Defying Grief session, a Youth participant, or Unsung Heroes,
            use their own entries in the Toolkit below.
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
                  <p className="text-ink">
                    {p.name}
                    {p.developmental_band && (
                      <span className="ml-2 rounded-full border border-seal/40 bg-seal/[0.08] px-2 py-0.5 align-middle text-xs text-ink">
                        Youth · {p.developmental_band}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {p.email ?? "No email on file"}
                    {p.linked_host_id ? " · Linked to an AVAIA account" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/toolkit/participants/${p.id}`}
                    className="rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
                  >
                    View Record
                  </Link>
                  <Link
                    href={`/toolkit/preparation/${p.id}`}
                    className="rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
                  >
                    Prepare
                  </Link>
                  <form action={startIapSessionForExisting}>
                    <input type="hidden" name="participantId" value={p.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
                    >
                      New IAP session
                    </button>
                  </form>
                  <form action={startUnsungHeroesSession} className="flex items-center gap-1">
                    <input type="hidden" name="participantId" value={p.id} />
                    <select
                      name="path"
                      required
                      defaultValue=""
                      className="rounded-md border border-rule bg-white/[0.04] px-2 py-2 font-sans text-sm text-ink outline-none focus:border-seal"
                    >
                      <option value="" disabled className="bg-[#05060b]">
                        Unsung Heroes path —
                      </option>
                      {UNSUNG_HEROES_PATHS.map((path) => (
                        <option key={path} value={path} className="bg-[#05060b]">
                          {UNSUNG_HEROES_PATH_LABEL[path]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
                    >
                      Begin Unsung Heroes
                    </button>
                  </form>
                  <form action={removeParticipant}>
                    <input type="hidden" name="participantId" value={p.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-muted transition-colors hover:border-red-500/60 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </form>
                </div>
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
          account. Unsung Heroes recognitions are a separate table with no
          Workbook presence at all (public /unsung-heroes/dashboard is
          their only view, already self-scoped by RLS to observer_id, so it
          works unchanged for a Guide's own recognitions too) -- linked
          here rather than folded into Workbook, since folding it in would
          mean editing that frozen page for a table it was never built to
          read. No "Master Connection Map" or equivalent was found anywhere
          in the codebase -- not built here, not invented. */}
      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Records &amp; Continuity</p>
        <p className="text-muted">
          Every referral generated through the Toolkit is saved to your own Guide&rsquo;s Record,
          the same Workbook every AVAIA Host has. Unsung Heroes recognitions are saved to their
          own record, the same one the public flow uses.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/workbook"
            prefetch={false}
            className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            View Guide&rsquo;s Record
          </Link>
          <Link
            href="/unsung-heroes/dashboard"
            prefetch={false}
            className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            View Unsung Heroes Record
          </Link>
        </div>
      </section>

      {/* Guided Journeys (Phase E.4) -- link out only. The feature itself
          lives at app/guided-journeys/, its own route with its own gate
          (active certification + Guided Journey Facilitation
          authorization -- deliberately not Toolkit authorization, which
          this section's own visibility check below also avoids treating
          as a prerequisite). Shown only when this Guide actually holds
          that authorization, so a Guide without it doesn't see a
          dead-end link. */}
      {/* Shared Room -- more than one person in the same AVAIA experience at
          once. Its own route (app/toolkit/rooms/) since it isn't a single
          IAP/CAT/InnerCompass session -- gated by the same Toolkit
          authorization already required to reach this page at all, no
          separate capability. */}
      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Shared Room</p>
        <p className="text-muted">
          Facilitate more than one person in the same AVAIA experience -- each person keeps
          ownership of their own story; nothing moves from private into shared without their
          own choice.
        </p>
        <div className="mt-3">
          <Link
            href="/toolkit/rooms"
            className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Open Shared Rooms
          </Link>
        </div>
      </section>

      {guidedJourneyFacilitationAuthorized && (
        <section className="rule-t mt-14 border-t border-rule pt-8">
          <p className="label mb-3 text-muted">Guided Journeys</p>
          <p className="text-muted">
            Host-owned Journeys you have been invited to facilitate, read-only.
          </p>
          <div className="mt-3">
            <Link
              href="/guided-journeys"
              prefetch={false}
              className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
            >
              View Guided Journeys
            </Link>
          </div>
        </section>
      )}

      {/* Experiences / Classes -- minimum first slice. Read-only browse
          only; the 11 Experiences and 20 Classes are seeded as
          status='draft' (migration 0020), so these pages legitimately
          show "nothing published yet" until publication is explicitly
          approved. No Experience Builder yet. */}
      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Experiences &amp; Classes</p>
        <p className="text-muted">
          Together in the experience. Individual in the conversation. Full AVAIA Experiences and
          the modular Class Library — browsing only in this pass.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/toolkit/experiences"
            className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Full AVAIA Experiences
          </Link>
          <Link
            href="/toolkit/classes"
            className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Class Library
          </Link>
        </div>
      </section>

      {/* Tool registry -- split into Adult/General vs. Youth so a Guide
          working across both populations doesn't have to scan one flat
          list to tell them apart (found during the admin/Guide usability
          pass: nothing on this dashboard previously distinguished them at
          all). Same TOOL_REGISTRY data, same cards, just grouped by key --
          not a redesign of the Toolkit itself. */}
      {(() => {
        const YOUTH_KEYS = new Set(["youth-defying-grief", "youth-group"]);
        const youthTools = TOOL_REGISTRY.filter((t) => YOUTH_KEYS.has(t.key));
        const adultTools = TOOL_REGISTRY.filter((t) => !YOUTH_KEYS.has(t.key));
        const renderCard = (tool: (typeof TOOL_REGISTRY)[number]) => (
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
        );
        return (
          <>
            <section className="rule-t mt-14 border-t border-rule pt-8">
              <p className="label mb-3 text-muted">The Toolkit — Adult / General</p>
              <div className="grid gap-3 sm:grid-cols-2">{adultTools.map(renderCard)}</div>
            </section>
            <section className="rule-t mt-10 border-t border-rule pt-8">
              <p className="label mb-3 text-muted">The Toolkit — Youth</p>
              <Link
                href="/toolkit/youth-safety"
                className="mb-4 block rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-4 transition-colors hover:border-seal"
              >
                <p className="font-serif text-lg text-ink">Youth Safety — What To Actually Do</p>
                <p className="mt-1 text-sm text-muted">
                  The one thing to read before facilitating a Youth session — what to notice, what
                  to do, and what the narrow safety exception actually means in practice.
                </p>
              </Link>
              <div className="grid gap-3 sm:grid-cols-2">{youthTools.map(renderCard)}</div>
            </section>
          </>
        );
      })()}
    </div>
  );
}
