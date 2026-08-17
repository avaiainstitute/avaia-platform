import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SignOutButton from "@/components/SignOutButton";
import RichText from "@/components/RichText";
import { STAGE_LABEL, loadMessages, type DbConversation } from "@/lib/engine/conversation";
import type { Stage } from "@/lib/engine/prompts";
import { formatReferralFields } from "@/lib/engine/referral-provenance";

export const metadata = { title: "Shared with Me — AVAIA" };
export const dynamic = "force-dynamic";

export default async function SharedWithMePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // RLS ("shared_access recipient read") already scopes this to grants made
  // TO this account — nothing here can surface another recipient's shares.
  const { data: grantsData } = await supabase
    .from("shared_access")
    .select("owner_id, scope, conversation_id")
    .eq("shared_with_id", user.id)
    .is("revoked_at", null);
  const grants = grantsData ?? [];

  // Group by owner: a 'workbook' grant supersedes any 'conversation' grants
  // from the same owner (they'd be a subset anyway). 'referral' grants are
  // deliberately NOT added to conversationIds — that set drives which
  // conversations get their transcript fetched below, and a referral-only
  // grant must never expose the transcript. The referrals query further down
  // is unfiltered by conversation and relies entirely on RLS ("referrals
  // shared read", which DOES include 'referral' scope) to surface exactly
  // the right referrals — so referral-only shares still show up correctly,
  // just without a transcript alongside them.
  const byOwner = new Map<string, { workbook: boolean; conversationIds: Set<string> }>();
  for (const g of grants) {
    const entry = byOwner.get(g.owner_id) ?? { workbook: false, conversationIds: new Set<string>() };
    if (g.scope === "workbook") entry.workbook = true;
    else if (g.scope === "conversation" && g.conversation_id) entry.conversationIds.add(g.conversation_id);
    byOwner.set(g.owner_id, entry);
  }

  // Resolve owner ids to emails for display — same admin-lookup pattern as
  // the Workbook's "Shared with" list, just resolving the other direction.
  const ownerIds = [...byOwner.keys()];
  const emailById = new Map<string, string>();
  if (ownerIds.length > 0) {
    const admin = createAdminClient();
    for (let page = 1; page <= 20 && emailById.size < ownerIds.length; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (!data || data.users.length === 0) break;
      for (const u of data.users) if (u.email && ownerIds.includes(u.id)) emailById.set(u.id, u.email);
      if (data.users.length < 1000) break;
    }
  }

  type OwnerSection = {
    ownerId: string;
    ownerEmail: string | null;
    conversations: { convo: DbConversation; transcript: Awaited<ReturnType<typeof loadMessages>> }[];
    referrals: Array<Record<string, unknown>>;
  };
  const sections: OwnerSection[] = [];
  for (const [ownerId, entry] of byOwner) {
    let query = supabase.from("conversations").select("*").eq("host_id", ownerId).order("created_at");
    if (!entry.workbook) query = query.in("id", [...entry.conversationIds]);
    const { data: convosData } = await query;
    const conversations = (convosData as DbConversation[]) ?? [];
    const transcripts = await Promise.all(conversations.map((c) => loadMessages(supabase, c.id)));

    // RLS ("referrals shared read") scopes this the same way: every referral
    // for the owner when the grant is workbook-wide, or just the one tied to
    // a specifically shared conversation (referrals created before
    // conversation_id existed won't appear for a conversation-scope grant —
    // they only ever show up under a workbook-scope share).
    const { data: referralsData } = await supabase
      .from("referrals")
      .select("*")
      .eq("host_id", ownerId)
      .order("created_at");
    const referrals = (referralsData as Array<Record<string, unknown>>) ?? [];

    sections.push({
      ownerId,
      ownerEmail: emailById.get(ownerId) ?? null,
      conversations: conversations.map((convo, i) => ({ convo, transcript: transcripts[i] })),
      referrals,
    });
  }

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <div className="flex items-baseline justify-between">
        <Link href="/" className="font-serif text-xl tracking-[0.16em] text-ink">
          AVAIA
        </Link>
        <SignOutButton />
      </div>

      <p className="label mb-3 mt-8">Not your own Workbook</p>
      <h1 className="font-serif text-4xl text-ink">Shared with me</h1>
      <p className="mt-4 text-lg text-muted">
        Conversations and Workbooks other Hosts have chosen to share with you. This is kept
        separate from <Link href="/workbook" className="text-seal hover:underline">your own Workbook</Link> —
        nothing here is yours to edit, and nothing of yours appears here.
      </p>

      {sections.length === 0 && (
        <p className="mt-12 text-muted">Nothing has been shared with you yet.</p>
      )}

      {sections.map((s) => (
        <section key={s.ownerId} className="mt-12 rule-t border-t border-rule pt-6">
          <p className="label text-seal">Shared by</p>
          <h2 className="mt-1 font-serif text-2xl text-ink">{s.ownerEmail ?? "An AVAIA Host"}</h2>

          {s.conversations.length === 0 && s.referrals.length === 0 && (
            <p className="mt-3 text-sm text-muted">Nothing to show yet.</p>
          )}

          <div className="mt-5 space-y-8">
            {s.conversations.map(({ convo, transcript }) => (
              <div key={convo.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-serif text-xl text-ink">{STAGE_LABEL[convo.stage as Stage]}</h3>
                  <span className="label">{convo.status === "complete" ? "Complete" : "In progress"}</span>
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
                        {/* Same fix as Workbook's transcript rendering: a
                            guide turn may be the persisted, multi-section
                            referral text, not just a normal reply. */}
                        {m.role === "host" ? m.content : <RichText text={m.content} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {s.referrals.length > 0 && (
            <div className="mt-10">
              <h3 className="font-serif text-xl text-ink">The Guide&rsquo;s record</h3>
              <div className="mt-4 space-y-5">
                {s.referrals.map((r) => (
                  <div
                    key={r.id as string}
                    className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm"
                  >
                    <p className="label mb-3 text-seal">
                      {STAGE_LABEL[r.from_stage as Stage] ?? String(r.from_stage)} →{" "}
                      {STAGE_LABEL[r.to_stage as Stage] ?? "Continuity"}
                    </p>
                    <dl className="space-y-2">
                      {formatReferralFields(
                        r.from_stage as Stage,
                        r.content as Record<string, unknown> | null
                      ).map((item) => (
                        <div key={item.key}>
                          <dt className="label text-muted">{item.label}</dt>
                          <dd className="mt-0.5 text-sm text-ink">
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
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
