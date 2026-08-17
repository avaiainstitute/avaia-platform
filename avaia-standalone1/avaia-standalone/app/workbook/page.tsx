import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SignOutButton from "@/components/SignOutButton";
import WorkbookExport from "@/components/WorkbookExport";
import ShareButton from "@/components/ShareButton";
import SharedWithList from "@/components/SharedWithList";
import { STAGE_LABEL, loadMessages, type DbConversation } from "@/lib/engine/conversation";
import type { Stage } from "@/lib/engine/prompts";
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

export default async function WorkbookPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

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

  const transcripts = await Promise.all(
    conversations.map((c) => loadMessages(supabase, c.id))
  );

  const hasActive = conversations.some((c) => c.status === "active");
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

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href={hasActive ? "/journey" : "/journey?new=1"}
          className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          {hasActive ? "Continue your journey" : "Begin a new journey"}
        </Link>
        {journeys.length > 0 && <ShareButton scope="workbook" label="Share entire Workbook" />}
      </div>

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
              <p className="font-serif text-2xl text-ink">Journey {j.n}</p>
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
                        {m.content}
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
