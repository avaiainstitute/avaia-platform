import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RichText from "@/components/RichText";
import { STAGE_LABEL, loadMessages, type DbConversation } from "@/lib/engine/conversation";
import type { Stage } from "@/lib/engine/prompts";
import { formatReferralFields } from "@/lib/engine/referral-provenance";

export const metadata = { title: "Guided Journey — AVAIA" };
export const dynamic = "force-dynamic";

/** Read-only view of one Host-owned Journey a Host has invited this Guide
 *  to facilitate (Phase E.4). No message input, no response buttons, no
 *  "Continue conversation," no editing -- Guide participation is E.5, not
 *  built here. Every query below runs through the signed-in Guide's own
 *  RLS-bound client; the real access control is the Phase E.4 policies
 *  ("journeys guide read" / "conversations guide read" / "messages guide
 *  read" / "referrals guide read", migration 0029), not this page. If the
 *  journey row doesn't come back -- revoked, certification/authorization
 *  lapsed, Youth, or genuinely not invited -- this page has nothing
 *  further to check or decide; it simply has nothing to show. Gated one
 *  level up, in app/guided-journeys/layout.tsx, on active certification +
 *  Guided Journey Facilitation authorization -- not Toolkit authorization,
 *  which this route deliberately has no dependency on. */
export default async function GuidedJourneyDetailPage({
  params,
}: {
  params: { journeyId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/guided-journeys");

  const { data: journey } = await supabase
    .from("journeys")
    .select("id, program, started_at, completed_at")
    .eq("id", params.journeyId)
    .maybeSingle();

  if (!journey) {
    return (
      <div>
        <Link href="/guided-journeys" className="label text-muted hover:text-seal">
          &larr; Guided Journeys
        </Link>
        <p className="label mb-3 mt-6">Guided Journey</p>
        <h1 className="font-serif text-3xl text-ink">Not currently accessible</h1>
        <p className="mt-4 text-muted">
          This Journey either doesn&rsquo;t exist, the Host has revoked your access, or you
          currently don&rsquo;t hold the certification and Guided Journey Facilitation
          authorization required to view it. If you believe this is a mistake, contact AVAIA.
        </p>
      </div>
    );
  }

  const { data: convosData } = await supabase
    .from("conversations")
    .select("*")
    .eq("journey_id", journey.id)
    .order("created_at", { ascending: true });
  const conversations = (convosData as DbConversation[]) ?? [];

  const transcripts = await Promise.all(conversations.map((c) => loadMessages(supabase, c.id)));

  const conversationIds = conversations.map((c) => c.id);
  let referralsData: Record<string, unknown>[] | null = null;
  if (conversationIds.length > 0) {
    const result = await supabase
      .from("referrals")
      .select("*")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true });
    referralsData = result.data;
  }
  const referrals = referralsData ?? [];

  return (
    <div>
      <Link href="/guided-journeys" className="label text-muted hover:text-seal">
        &larr; Guided Journeys
      </Link>

      <p className="label mb-3 mt-6">Guided Journey</p>
      <h1 className="font-serif text-3xl text-ink">
        {journey.program === "defying-grief" ? "Defying Grief" : "General"} Journey
      </h1>
      <p className="mt-2 text-sm text-muted">
        Started {new Date(journey.started_at).toLocaleDateString()}
        {journey.completed_at ? ` · Completed ${new Date(journey.completed_at).toLocaleDateString()}` : ""}
      </p>

      <div className="mt-4 rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-4">
        <p className="text-ink">Host-owned Journey. Read-only access.</p>
        <p className="mt-1 text-sm text-muted">
          The Host owns this Journey, its Table, and its record. You have scoped facilitation
          access, granted by the Host and revocable by them at any time. Nothing here can be
          edited from this view.
        </p>
      </div>

      {conversations.length === 0 && (
        <p className="mt-8 text-muted">Nothing recorded in this Journey yet.</p>
      )}

      {conversations.map((convo, i) => (
        <section key={convo.id} className="mt-10">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-xl text-ink">{STAGE_LABEL[convo.stage as Stage]}</h2>
            <span className="label">{convo.status === "complete" ? "Complete" : "In progress"}</span>
          </div>
          <div className="mt-4 space-y-4">
            {transcripts[i].length === 0 && (
              <p className="text-sm text-muted">No messages recorded for this conversation yet.</p>
            )}
            {transcripts[i].map((m) => (
              <div key={m.id} className={m.role === "host" ? "flex justify-end" : ""}>
                <div
                  className={
                    m.role === "host"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-white/[0.06] px-4 py-2.5 text-sm text-ink"
                      : "max-w-[90%] font-serif leading-relaxed text-ink"
                  }
                >
                  {m.role === "host" ? m.content : <RichText text={m.content} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {referrals.length > 0 && (
        <section className="mt-12">
          <h2 className="font-serif text-xl text-ink">The Host&rsquo;s Guide&rsquo;s Record</h2>
          <p className="mt-1 text-sm text-muted">
            What each conversation observed and carried forward. This belongs to the Host, not to
            you as the facilitating Guide.
          </p>
          <div className="mt-5 space-y-6">
            {referrals.map((r) => (
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
  );
}
