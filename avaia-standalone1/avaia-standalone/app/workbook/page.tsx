import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SignOutButton from "@/components/SignOutButton";
import WorkbookExport from "@/components/WorkbookExport";
import ShareButton from "@/components/ShareButton";
import SharedWithList from "@/components/SharedWithList";
import RichText from "@/components/RichText";
import { STAGE_LABEL, loadMessages, type DbConversation } from "@/lib/engine/conversation";
import type { Stage, Program } from "@/lib/engine/prompts";
import type { SharedAccessGrantWithEmail } from "@/lib/sharing";
import {
  formatVirtueClassifications,
  formatSecondaryLossClassifications,
  formatReferralFields,
} from "@/lib/engine/referral-provenance";

export const metadata = { title: "Your Workbook — AVAIA" };
export const dynamic = "force-dynamic";

type Transcript = Awaited<ReturnType<typeof loadMessages>>;

/** Serialize the whole Workbook to a readable plain-text document for download. */
function buildWorkbookText(
  conversations: DbConversation[],
  transcripts: Transcript[],
  referrals: Record<string, unknown>[],
  exportedOn: string
): string {
  const bar = "=".repeat(60);
  const out: string[] = [
    "YOUR AVAIA WORKBOOK",
    `Exported: ${exportedOn}`,
    "",
    "The living record of your AVAIA journey — your conversations, what became",
    "visible, and the referrals that carried you forward.",
    "",
  ];

  const hv = (key: string) =>
    referrals.flatMap((r) => {
      const arr = (r as { content?: Record<string, unknown> }).content?.[key];
      return Array.isArray(arr) ? (arr as string[]) : [];
    });
  const hostVoice: Array<[string, string[]]> = (
    [
      ["Anchor Statements", hv("anchorStatements")],
      ["Reflections That Emerged", hv("reflectionsThatEmerged")],
      ["Questions Worth Carrying", hv("questionsWorthCarrying")],
      ["Decisions Made", hv("decisionsMade")],
      ["Commitments Chosen", hv("commitmentsChosen")],
    ] as Array<[string, string[]]>
  ).filter(([, items]) => items.length > 0);
  if (hostVoice.length > 0) {
    out.push(bar, "IN YOUR OWN WORDS", bar, "");
    for (const [label, items] of hostVoice) {
      out.push(`${label}:`);
      for (const it of items) out.push(`  "${it}"`);
      out.push("");
    }
  }

  conversations.forEach((c, i) => {
    const status = c.status === "complete" ? "Complete" : "In progress";
    out.push(bar, `${STAGE_LABEL[c.stage as Stage]} — ${status}`, bar, "");
    for (const m of transcripts[i]) {
      out.push(`${m.role === "host" ? "You" : "Guide"}: ${m.content}`, "");
    }
  });

  if (referrals.length > 0) {
    out.push(bar, "REFERRALS", bar, "");
    for (const r of referrals) {
      const from = STAGE_LABEL[r.from_stage as Stage] ?? String(r.from_stage);
      const to = STAGE_LABEL[r.to_stage as Stage] ?? "Continuity";
      out.push(`${from} -> ${to}`, "-".repeat(60));
      for (const item of formatReferralFields(
        r.from_stage as Stage,
        (r.content ?? null) as Record<string, unknown> | null
      )) {
        if (Array.isArray(item.value)) {
          out.push(`${item.label}:`);
          for (const v of item.value) out.push(`  - ${v}`);
        } else {
          out.push(`${item.label}: ${item.value}`);
        }
      }
      out.push("");
    }
  }

  return out.join("\n");
}

const GUIDE_ACCESS_ERROR_MESSAGE: Record<string, string> = {
  missing_fields: "Please select a Guide before inviting.",
  missing_confirmation: "Please confirm the invitation to proceed.",
  guide_already_invited: "This Guide already has active access to this Journey.",
  invite_failed: "Could not invite this Guide. They may no longer be eligible, or you may not own this Journey.",
  missing_access_id: "That access record could not be found.",
  missing_revoke_confirmation: "Please confirm before revoking access.",
  revoke_failed: "Could not revoke this Guide's access. Please try again.",
};

/** Creates one guide_journey_access row (Phase E.3) -- an explicit,
 *  Host-initiated invitation of a specific eligible Guide into a specific
 *  Host-owned Journey. Does NOT grant the Guide any ability to read or
 *  write Journey content; that remains a later, separately-approved phase.
 *  Ownership integrity and Guide eligibility are enforced by the database
 *  itself (the composite foreign key and the INSERT policy's eligibility
 *  checks from migration 0027) -- this action never trusts client input
 *  for host_id, always uses the signed-in Host's own id, and never bypasses
 *  RLS via a service-role client. A duplicate-active or ineligible-Guide
 *  attempt surfaces as a plain, non-technical message -- never a raw
 *  database error. */
async function inviteGuideToJourney(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/workbook");

  const journeyId = String(formData.get("journeyId") ?? "");
  const guideId = String(formData.get("guideId") ?? "");
  const confirmed = formData.get("confirmInvite") === "on";

  if (!journeyId || !guideId) redirect("/workbook?guideAccessError=missing_fields");
  if (!confirmed) redirect("/workbook?guideAccessError=missing_confirmation");

  const { error } = await supabase.from("guide_journey_access").insert({
    journey_id: journeyId,
    host_id: user.id,
    guide_id: guideId,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    redirect(`/workbook?guideAccessError=${code === "23505" ? "guide_already_invited" : "invite_failed"}`);
  }

  redirect("/workbook?guideAccessGranted=1");
}

/** Revokes one guide_journey_access row -- sets revoked_at, never deletes
 *  the row, preserving it as historical evidence that access once
 *  existed. Scoped to rows the signed-in Host owns and that are still
 *  active; the database trigger from migration 0027 independently
 *  guarantees only revoked_at changes and only from null to non-null. */
async function revokeGuideJourneyAccess(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/workbook");

  const accessId = String(formData.get("accessId") ?? "");
  const confirmed = formData.get("confirmRevoke") === "on";
  if (!accessId) redirect("/workbook?guideAccessError=missing_access_id");
  if (!confirmed) redirect("/workbook?guideAccessError=missing_revoke_confirmation");

  const { error } = await supabase
    .from("guide_journey_access")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", accessId)
    .eq("host_id", user.id)
    .is("revoked_at", null);
  if (error) redirect("/workbook?guideAccessError=revoke_failed");

  redirect("/workbook?guideAccessRevoked=1");
}

export default async function WorkbookPage({
  searchParams,
}: {
  searchParams: {
    guideAccessGranted?: string;
    guideAccessRevoked?: string;
    guideAccessError?: string;
  };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/workbook");

  const { data: profile } = await supabase
    .from("profiles")
    .select("consent_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");

  const { data: convosData } = await supabase
    .from("conversations")
    .select("*")
    .eq("host_id", user.id)
    .order("created_at", { ascending: true });
  const conversations = (convosData as DbConversation[]) ?? [];

  const { data: referralsData } = await supabase
    .from("referrals")
    .select("*")
    .eq("host_id", user.id)
    .order("created_at", { ascending: true });
  const referrals = referralsData ?? [];

  // Who currently has access to what — the shared_with_id -> email lookup
  // needs the admin client since auth.users isn't otherwise queryable; the
  // grants themselves are already scoped to this Host by RLS ("shared_access
  // owner manage"), so this only ever resolves emails for the Host's own
  // grants, never anyone else's.
  const { data: grantsData } = await supabase
    .from("shared_access")
    .select("*")
    .eq("owner_id", user.id)
    .is("revoked_at", null)
    .order("granted_at", { ascending: false });
  const grants = grantsData ?? [];
  let sharedWithGrants: SharedAccessGrantWithEmail[] = [];
  if (grants.length > 0) {
    const admin = createAdminClient();
    const emailById = new Map<string, string>();
    for (let page = 1; page <= 20 && emailById.size < grants.length; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (!data || data.users.length === 0) break;
      for (const u of data.users) if (u.email) emailById.set(u.id, u.email);
      if (data.users.length < 1000) break;
    }
    sharedWithGrants = grants.map((g) => ({
      ...g,
      shared_with_email: emailById.get(g.shared_with_id) ?? null,
    }));
  }

  // Guided Journey access (Phase E.3) -- this Host's own guide_journey_access
  // rows (self-read RLS, see 0027) and the current list of eligible Guides
  // (0028's list_eligible_guided_journey_guides() SECURITY DEFINER
  // function -- never a direct profiles query, since profiles has no
  // cross-account read policy). Identity is always the Guide Display Name,
  // never email -- see 0028's comment on why.
  const { data: guideAccessRows } = await supabase
    .from("guide_journey_access")
    .select("id, journey_id, guide_id, granted_at, revoked_at")
    .eq("host_id", user.id)
    .order("granted_at", { ascending: false });
  const guideAccess = guideAccessRows ?? [];
  const activeAccessByJourney = new Map<string, (typeof guideAccess)[number]>();
  for (const a of guideAccess) {
    if (!a.revoked_at && !activeAccessByJourney.has(a.journey_id)) {
      activeAccessByJourney.set(a.journey_id, a);
    }
  }

  const { data: eligibleGuidesData } = await supabase.rpc("list_eligible_guided_journey_guides");
  const eligibleGuides = eligibleGuidesData ?? [];

  // Resolve display names for every currently-active access row's guide,
  // even one no longer in the eligible list (authorization can change
  // after an invitation exists) -- get_guide_display_name() returns the
  // name regardless of current eligibility, unlike the list above.
  const guideNameById = new Map<string, string>(
    eligibleGuides.map((g: { guide_id: string; guide_display_name: string }) => [
      g.guide_id,
      g.guide_display_name,
    ])
  );
  await Promise.all(
    Array.from(activeAccessByJourney.values())
      .filter((a) => !guideNameById.has(a.guide_id))
      .map(async (a) => {
        const { data } = await supabase.rpc("get_guide_display_name", { p_guide_id: a.guide_id });
        if (data) guideNameById.set(a.guide_id, data);
      })
  );

  const transcripts = await Promise.all(
    conversations.map((c) => loadMessages(supabase, c.id))
  );

  const hasActive = conversations.some((c) => c.status === "active");
  // Preserves the Host's most recent program for the "Begin a new journey"
  // link below -- conversations is already ordered oldest-first, so the
  // last element is the most recent one on record. No new query needed.
  const lastProgram: Program = conversations[conversations.length - 1]?.program ?? "general";
  const exportedOn = new Date().toISOString().slice(0, 10);

  // Group conversations into journeys. Each IAP begins a new journey; the CAT and
  // InnerCompass that follow belong to it. Referrals are matched to a journey by
  // the time window in which they were created.
  type Journey = {
    n: number;
    convos: { convo: DbConversation; transcript: Transcript }[];
    referrals: Array<Record<string, unknown>>;
    startedAt: string;
    complete: boolean;
    concern: string;
  };
  const allReferrals = referrals as Array<Record<string, unknown>>;
  const journeys: Journey[] = [];
  conversations.forEach((c, i) => {
    if (c.stage === "iap" || journeys.length === 0) {
      journeys.push({
        n: journeys.length + 1,
        convos: [],
        referrals: [],
        startedAt: c.created_at,
        complete: true,
        concern: "",
      });
    }
    journeys[journeys.length - 1].convos.push({ convo: c, transcript: transcripts[i] });
  });
  journeys.forEach((j, k) => {
    const end = journeys[k + 1]?.startedAt;
    j.referrals = allReferrals.filter((r) => {
      const at = String(r.created_at ?? "");
      return at >= j.startedAt && (end === undefined || at < end);
    });
    j.complete = !j.convos.some(({ convo }) => convo.status === "active");
    j.concern = j.convos[0]?.transcript.find((m) => m.role === "host")?.content ?? "";
  });
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  // Patterns across journeys — surface what has already recurred in the Host's own
  // record, without inventing conclusions. Only meaningful with 2+ journeys.
  const collectAll = (keys: string[]) =>
    allReferrals.flatMap((r) => {
      const c = r.content as Record<string, unknown> | undefined;
      return keys.flatMap((k) => {
        const v = c?.[k];
        return Array.isArray(v) ? (v as string[]) : [];
      });
    });
  const recurring = (items: string[]) => {
    const counts = new Map<string, { label: string; n: number }>();
    for (const it of items) {
      const key = it.trim().toLowerCase();
      if (!key) continue;
      const e = counts.get(key);
      if (e) e.n += 1;
      else counts.set(key, { label: it.trim(), n: 1 });
    }
    return [...counts.values()].filter((e) => e.n >= 2).sort((a, b) => b.n - a.n);
  };
  const uniq = (items: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const it of items) {
      const key = it.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(it.trim());
    }
    return out;
  };
  // Virtue fields need their own collector: collectAll assumes flat string
  // arrays, but relevantVirtues/virtuesInvolved may hold either legacy
  // strings or current {family, element} objects, and recurring()'s
  // it.trim() would throw on an object. formatVirtueClassifications
  // normalizes both shapes to display strings first.
  const collectVirtues = () =>
    allReferrals.flatMap((r) => {
      const c = r.content as Record<string, unknown> | undefined;
      return [
        ...formatVirtueClassifications(c?.relevantVirtues),
        ...formatVirtueClassifications(c?.virtuesInvolved),
      ];
    });
  const patternVirtues = recurring(collectVirtues());
  // Same reasoning as collectVirtues above: secondaryLossesIdentified /
  // significantSecondaryLosses may hold legacy free-prose strings or
  // current {category, description} objects, and collectAll's flat-string
  // assumption would throw on the object shape.
  const collectSecondaryLosses = () =>
    allReferrals.flatMap((r) => {
      const c = r.content as Record<string, unknown> | undefined;
      return [
        ...formatSecondaryLossClassifications(c?.secondaryLossesIdentified),
        ...formatSecondaryLossClassifications(c?.significantSecondaryLosses),
      ];
    });
  const patternLosses = recurring(collectSecondaryLosses());
  const carriedQuestions = uniq(collectAll(["questionsWorthCarrying", "unresolvedQuestions"]));
  const anchorPatterns = uniq(collectAll(["anchorStatements"]));
  const hasPatterns =
    journeys.length >= 2 &&
    (patternVirtues.length > 0 ||
      patternLosses.length > 0 ||
      carriedQuestions.length > 0 ||
      anchorPatterns.length > 0);

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <div className="flex items-baseline justify-between">
        <Link href="/" className="font-serif text-xl tracking-[0.16em] text-ink">
          AVAIA
        </Link>
        <SignOutButton />
      </div>

      <p className="label mb-3 mt-8">Continuity</p>
      <h1 className="font-serif text-4xl text-ink">Your Workbook</h1>
      <p className="mt-4 text-lg text-muted">
        The living record of your AVAIA journeys — each conversation, what became visible, and the
        referrals that carried you forward. Open any journey below to read, save, or print it.
        It&rsquo;s yours, and only yours.
      </p>

      {searchParams?.guideAccessGranted === "1" && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          Guide invited.
        </p>
      )}

      {searchParams?.guideAccessRevoked === "1" && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          Guide access revoked.
        </p>
      )}

      {searchParams?.guideAccessError && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          {GUIDE_ACCESS_ERROR_MESSAGE[searchParams.guideAccessError] ?? "Something went wrong."}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href={
            hasActive
              ? "/journey"
              : lastProgram === "general"
              ? "/journey?new=1"
              : `/journey?new=1&program=${lastProgram}`
          }
          className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          {hasActive ? "Continue your journey" : "Begin a new journey"}
        </Link>
        {journeys.length > 0 && <ShareButton scope="workbook" label="Share entire Workbook" />}
      </div>

      {/* Shared with Me lives here rather than in top-level navigation --
          it's a receiving view for AVAIA's sharing feature, not a
          destination a stranger or first-time Host needs to see. */}
      <p className="mt-4 text-sm">
        <Link href="/shared-with-me" className="text-muted hover:text-seal">
          Looking for what others have shared with you? →
        </Link>
      </p>

      {/* The Library's permanent entrance -- plain /library, not a
          Journey-specific URL, so it stays reachable on its own regardless
          of which (if any) journey below a Host arrived from. */}
      <p className="mt-2 text-sm">
        <Link href="/library" className="text-muted hover:text-seal">
          Explore the AVAIA Library →
        </Link>
      </p>

      {journeys.length > 0 && (
        <section className="mt-10">
          <p className="label text-muted">Shared with</p>
          <div className="mt-3">
            <SharedWithList grants={sharedWithGrants} />
          </div>
        </section>
      )}

      {hasPatterns && (
        <section className="mt-12 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          <p className="label text-seal">Across your journeys</p>
          <h2 className="mt-1 font-serif text-2xl text-ink">What keeps becoming visible</h2>
          <p className="mt-1 text-sm text-muted">
            Patterns already present in your own record — surfaced, not concluded.
          </p>

          {patternVirtues.length > 0 && (
            <div className="mt-5">
              <p className="label text-muted">Virtues that keep surfacing</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {patternVirtues.map((v) => (
                  <span
                    key={v.label}
                    className="rounded-full border border-rule px-3 py-1 text-sm text-ink"
                  >
                    {v.label} <span className="text-muted">×{v.n}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {patternLosses.length > 0 && (
            <div className="mt-5">
              <p className="label text-muted">Losses that recurred</p>
              <ul className="mt-2 space-y-1 text-sm text-ink">
                {patternLosses.map((l) => (
                  <li key={l.label}>
                    {l.label} <span className="text-muted">×{l.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {anchorPatterns.length > 0 && (
            <div className="mt-5">
              <p className="label text-muted">Anchor statements you&rsquo;ve carried</p>
              <ul className="mt-2 space-y-2">
                {anchorPatterns.map((a, i) => (
                  <li
                    key={i}
                    className="border-l-2 border-seal/50 pl-4 font-serif italic leading-relaxed text-ink"
                  >
                    &ldquo;{a}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          )}

          {carriedQuestions.length > 0 && (
            <div className="mt-5">
              <p className="label text-muted">Questions you&rsquo;re still carrying</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
                {carriedQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {journeys.length === 0 && (
        <p className="mt-12 text-muted">Nothing saved yet — your journey hasn&rsquo;t begun.</p>
      )}

      {journeys.length > 0 && (
        <p className="label mt-14">
          {journeys.length} {journeys.length === 1 ? "journey" : "journeys"}
        </p>
      )}

      {/* Filing cabinet — newest journey first, each collapsible. */}
      {[...journeys].reverse().map((j, idx) => (
        <details
          key={j.convos[0]?.convo.id ?? j.n}
          open={idx === 0}
          className="group rule-t mt-5 border-t border-rule pt-5"
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <p className="font-serif text-2xl text-ink">
                Journey {j.n}
                {j.convos[0]?.convo.program === "defying-grief" && (
                  <span className="ml-2 align-middle font-sans text-[0.65rem] font-medium uppercase tracking-wide text-[#c1502e]">
                    Defying Grief
                  </span>
                )}
              </p>
              <p className="label mt-1">
                {fmtDate(j.startedAt)} · {j.complete ? "Complete" : "In progress"} ·{" "}
                {j.convos.length} {j.convos.length === 1 ? "conversation" : "conversations"}
              </p>
              {j.concern && (
                <p className="mt-2 line-clamp-2 text-sm italic text-muted">
                  &ldquo;{j.concern}&rdquo;
                </p>
              )}
            </div>
            <span className="mt-1 shrink-0 text-muted transition-transform group-open:rotate-90">
              ▸
            </span>
          </summary>

          <div className="mt-5">
            <WorkbookExport
              text={buildWorkbookText(
                j.convos.map((x) => x.convo),
                j.convos.map((x) => x.transcript),
                j.referrals,
                exportedOn
              )}
              filename={`AVAIA-Journey-${j.n}-${j.startedAt.slice(0, 10)}.txt`}
            />

            {/* Only offered once this Journey is complete and its
                journey_id is actually known -- a historical conversation
                predating the journeys table has journey_id: null and gets
                no link here rather than a guessed one. */}
            {j.complete && j.convos[0]?.convo.journey_id && (
              <p className="mt-4 text-sm">
                <Link
                  href={`/library?journey=${j.convos[0].convo.journey_id}`}
                  className="text-muted hover:text-seal"
                >
                  Explore the Library from this Journey →
                </Link>
              </p>
            )}

            {/* Guided Journey access (Phase E.3) -- Host-owned, Guide-
                facilitation-only. Held out entirely for Youth Journeys
                (program === "youth") until the separate verified
                guardian-consent architecture exists -- not invented here.
                Held out for a conversation predating the journeys table
                (no journey_id) since there is nothing stable to grant
                access to. */}
            {j.convos[0]?.convo.journey_id && j.convos[0]?.convo.program !== "youth" && (
              <section className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
                <p className="label mb-1 text-muted">Guided Journey</p>
                {(() => {
                  const journeyId = j.convos[0]!.convo.journey_id as string;
                  const active = activeAccessByJourney.get(journeyId);
                  if (active) {
                    return (
                      <>
                        <p className="text-ink">
                          Guide: {guideNameById.get(active.guide_id) ?? "A Certified AVAIA Guide"}
                        </p>
                        <p className="mt-1 text-sm text-muted">Status: Active Permission</p>
                        <p className="mt-3 text-xs text-muted">
                          You remain the owner of this Journey. This Guide has your permission to
                          facilitate it — that permission does not transfer ownership of your
                          Journey, story, or decisions.
                        </p>
                        <form action={revokeGuideJourneyAccess} className="mt-4">
                          <input type="hidden" name="accessId" value={active.id} />
                          <label className="flex cursor-pointer items-start gap-3 text-sm">
                            <input type="checkbox" name="confirmRevoke" className="mt-1" required />
                            <span className="text-ink">
                              Revoking this Guide&rsquo;s access does not delete your Journey or
                              conversation history.
                            </span>
                          </label>
                          <button
                            type="submit"
                            className="mt-3 rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
                          >
                            Revoke Guide Access
                          </button>
                        </form>
                      </>
                    );
                  }
                  return (
                    <>
                      <p className="text-ink">Invite a Certified AVAIA Guide</p>
                      <p className="mt-2 text-sm text-muted">
                        You remain the owner of your Journey. This creates your permission for a
                        Guide to facilitate this Journey. You can revoke that permission later.
                        Guide access to Journey content is enabled separately by AVAIA&rsquo;s
                        Guided Journey system.
                      </p>
                      {eligibleGuides.length === 0 ? (
                        <p className="mt-4 text-sm text-muted">
                          No eligible Guides are currently available.
                        </p>
                      ) : (
                        <form action={inviteGuideToJourney} className="mt-4">
                          <input type="hidden" name="journeyId" value={journeyId} />
                          <label className="label mb-2 block" htmlFor={`guideId-${journeyId}`}>
                            Guide
                          </label>
                          <select
                            id={`guideId-${journeyId}`}
                            name="guideId"
                            required
                            defaultValue=""
                            className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
                          >
                            <option value="" disabled className="bg-[#05060b] text-ink">
                              Select a Guide
                            </option>
                            {eligibleGuides.map((g: { guide_id: string; guide_display_name: string }) => (
                              <option key={g.guide_id} value={g.guide_id} className="bg-[#05060b] text-ink">
                                {g.guide_display_name}
                              </option>
                            ))}
                          </select>
                          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
                            <input type="checkbox" name="confirmInvite" className="mt-1" required />
                            <span className="text-ink">
                              I understand that I am inviting this Guide into this Journey.
                            </span>
                          </label>
                          <button
                            type="submit"
                            className="mt-3 rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
                          >
                            Invite Guide
                          </button>
                        </form>
                      )}
                    </>
                  );
                })()}
              </section>
            )}

            {(() => {
              const collect = (key: string) =>
                j.referrals.flatMap((r) => {
                  const arr = (r.content as Record<string, unknown> | undefined)?.[key];
                  return Array.isArray(arr) ? (arr as string[]) : [];
                });
              const hostVoice = [
                { label: "Anchor Statements", items: collect("anchorStatements") },
                { label: "Reflections That Emerged", items: collect("reflectionsThatEmerged") },
                { label: "Questions Worth Carrying", items: collect("questionsWorthCarrying") },
                { label: "Decisions Made", items: collect("decisionsMade") },
                { label: "Commitments Chosen", items: collect("commitmentsChosen") },
              ].filter((g) => g.items.length > 0);
              if (hostVoice.length === 0) return null;
              return (
                <section className="mt-8 rounded-lg border border-seal/40 bg-seal/[0.06] p-5">
                  <h3 className="font-serif text-xl text-seal">In your own words</h3>
                  <p className="mt-1 text-sm text-muted">
                    What you discovered, asked, and chose along the way — kept in your words.
                  </p>
                  {hostVoice.map((g) => (
                    <div key={g.label} className="mt-5">
                      <p className="label text-muted">{g.label}</p>
                      <ul className="mt-2 space-y-2">
                        {g.items.map((it, ix) => (
                          <li
                            key={ix}
                            className="border-l-2 border-seal/50 pl-4 font-serif italic leading-relaxed text-ink"
                          >
                            &ldquo;{it}&rdquo;
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              );
            })()}

            {j.convos.map(({ convo, transcript }) => (
              <section key={convo.id} className="mt-8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="font-serif text-xl text-ink">{STAGE_LABEL[convo.stage as Stage]}</h3>
                    <span className="label">{convo.status === "complete" ? "Complete" : "In progress"}</span>
                  </div>
                  <ShareButton
                    scope="conversation"
                    conversationId={convo.id}
                    label="Share"
                    allowReferralOnly
                  />
                </div>
                <div className="mt-4 space-y-4">
                  {transcript.map((m) => (
                    <div key={m.id} className={m.role === "host" ? "flex justify-end" : ""}>
                      <div
                        className={
                          m.role === "host"
                            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-white/[0.06] px-4 py-2.5 text-sm text-ink"
                            : "max-w-[90%] font-serif leading-relaxed text-ink"
                        }
                      >
                        {m.role === "host" ? (
                          m.content
                        ) : (
                          // RichText renders any lightly-formatted Guide
                          // reply correctly -- the same component
                          // JourneyChat already uses live. Raw {m.content}
                          // would collapse line breaks and "- " bullets
                          // into an unreadable run-on block.
                          <RichText text={m.content} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {j.referrals.length > 0 && (
              <section className="mt-10">
                <h3 className="font-serif text-xl text-ink">The Guide&rsquo;s record</h3>
                <p className="mt-1 text-sm text-muted">
                  What each conversation observed and carried into the next.
                </p>
                <div className="mt-5 space-y-6">
                  {j.referrals.map((r) => (
                    <div
                      key={r.id as string}
                      className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm"
                    >
                      <p className="label mb-3 text-seal">
                        {STAGE_LABEL[r.from_stage as Stage] ?? String(r.from_stage)} →{" "}
                        {STAGE_LABEL[r.to_stage as Stage] ?? "Continuity"}
                      </p>
                      <dl className="space-y-3">
                        {formatReferralFields(
                          r.from_stage as Stage,
                          r.content as Record<string, unknown> | null
                        ).map((item) => (
                          <div key={item.key}>
                            <dt className="label text-muted">{item.label}</dt>
                            <dd className="mt-1 text-sm text-ink">
                              {Array.isArray(item.value) ? (
                                <ul className="list-disc space-y-0.5 pl-5">
                                  {item.value.map((v, jx) => (
                                    <li key={jx}>{v}</li>
                                  ))}
                                </ul>
                              ) : (
                                item.value
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
