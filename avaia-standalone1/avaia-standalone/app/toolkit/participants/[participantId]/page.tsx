import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantHistory, type ParticipantSessionRecord } from "@/lib/guide";
import { toolLabel } from "@/lib/toolkit";
import { UNSUNG_HEROES_PATH_LABEL } from "@/lib/engine/prompts";
import { formatReferralFields } from "@/lib/engine/referral-provenance";
import { familyOf, type VirtueFamilyKey } from "@/lib/virtues";

export const metadata = { title: "Participant Record — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

/** One session card's title -- the tool it ran, with the Defying Grief or
 *  Youth framing folded in when that's the program (neither is its own
 *  `tool`; they're iap/cat/innercompass with session.program ===
 *  'defying-grief' or 'youth', so this is the only place that distinction
 *  needs to be surfaced for display). */
function sessionTitle(record: ParticipantSessionRecord): string {
  const base = toolLabel(record.session.tool);
  if (record.session.program === "defying-grief") return `${base} — Defying Grief`;
  if (record.session.program === "youth") return `${base} — Youth`;
  return base;
}

function SessionCard({ record }: { record: ParticipantSessionRecord }) {
  const { session, conversation, referral, unsungHeroesConversation, recognition } = record;
  const status = conversation?.status ?? unsungHeroesConversation?.status ?? session.status;
  const createdAt = conversation?.created_at ?? unsungHeroesConversation?.created_at ?? session.created_at;
  const continueHref =
    session.tool === "iap" || session.tool === "cat" || session.tool === "innercompass" || session.tool === "unsung-heroes"
      ? `/toolkit/${session.tool}/${session.id}`
      : null;

  return (
    <div className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-serif text-lg text-ink">{sessionTitle(record)}</p>
        <span className="label text-muted">
          {fmtDate(createdAt)} · {status === "complete" ? "Complete" : "In progress"}
        </span>
      </div>

      {unsungHeroesConversation && (
        <p className="mt-1 text-sm text-muted">{UNSUNG_HEROES_PATH_LABEL[unsungHeroesConversation.path]}</p>
      )}

      {referral && (
        <dl className="mt-4 space-y-3">
          {formatReferralFields(referral.from_stage, referral.content).map((item) => (
            <div key={item.key}>
              <dt className="label text-muted">{item.label}</dt>
              <dd className="mt-1 text-sm text-ink">
                {Array.isArray(item.value) ? (
                  <ul className="list-disc space-y-0.5 pl-5">
                    {item.value.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {recognition && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-serif text-ink">{recognition.title}</p>
            {recognition.primary_virtue && (
              <span
                className="shrink-0 rounded-full px-3 py-0.5 text-xs text-white"
                style={{ backgroundColor: familyOf(recognition.virtue_family as VirtueFamilyKey).color }}
              >
                {recognition.primary_virtue}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            <span className="text-ink">{recognition.who_became_visible}</span> — recognized for it
          </p>
          <p className="mt-2 line-clamp-3 text-sm text-muted">{recognition.story}</p>
        </div>
      )}

      {!referral && !recognition && (
        <p className="mt-3 text-sm text-muted">
          {status === "complete"
            ? "Marked complete, but no referral was found for this session -- worth a closer look."
            : "Still in progress -- nothing recorded from it yet."}
        </p>
      )}

      {continueHref && status !== "complete" && (
        <Link
          href={continueHref}
          className="mt-4 inline-block rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
        >
          Continue this session
        </Link>
      )}
    </div>
  );
}

export default async function ParticipantRecordPage({
  params,
}: {
  params: { participantId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const history = await getParticipantHistory(supabase, user.id, params.participantId);
  if (!history) notFound();
  const { participant, sessions } = history;

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Participant Record</p>
      <h1 className="font-serif text-4xl text-ink">{participant.name}</h1>
      <p className="mt-2 text-muted">
        {participant.email ?? "No email on file"}
        {participant.linked_host_id ? " · Linked to an AVAIA account" : ""} · Participant since{" "}
        {fmtDate(participant.created_at)}
      </p>

      <div className="mt-6">
        <Link
          href={`/toolkit/preparation/${participant.id}`}
          className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
        >
          Prepare for next session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="mt-12 text-muted">No sessions yet for this participant.</p>
      ) : (
        <div className="mt-10 space-y-4">
          {sessions.map((record) => (
            <SessionCard key={record.session.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}
