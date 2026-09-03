import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantHistory, type ParticipantSessionRecord } from "@/lib/guide";
import { toolLabel } from "@/lib/toolkit";
import { UNSUNG_HEROES_PATH_LABEL } from "@/lib/engine/prompts";
import { formatReferralFields } from "@/lib/engine/referral-provenance";
import { familyOf, type VirtueFamilyKey } from "@/lib/virtues";
import PreparationSnapshot from "@/components/PreparationSnapshot";
import PreparationChat from "@/components/PreparationChat";
import { listSignatureEntriesForParticipant } from "@/lib/virtue-signature";
import { VirtueLink } from "@/components/VirtueLink";

export const metadata = { title: "Preparation — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

function sessionTitle(record: ParticipantSessionRecord): string {
  const base = toolLabel(record.session.tool);
  if (record.session.program === "defying-grief") return `${base} — Defying Grief`;
  if (record.session.program === "youth") return `${base} — Youth`;
  return base;
}

/** guide_sessions.status only ever flips to 'complete' on the final stage of
 *  a chain (InnerCompass -- see app/toolkit/innercompass/[sessionId]/page.tsx);
 *  an IAP or CAT session's own row stays 'active' forever even once its
 *  underlying conversation is done and handed off. The conversation's (or
 *  Unsung Heroes conversation's) own status is the real signal whenever one
 *  was resolved; session.status is only the fallback for a session with
 *  neither (e.g. a future tool not yet resolved here). */
function effectiveStatus(record: ParticipantSessionRecord): "active" | "complete" {
  return record.conversation?.status ?? record.unsungHeroesConversation?.status ?? record.session.status;
}

/** Preparation's central discipline: only ever render fields already
 *  produced by a completed stage and stored in its referral (or an already-
 *  saved Unsung Heroes recognition) -- never call the model, never
 *  summarize, never infer. "host_authored" and "open_unresolved" are the
 *  two provenance roles formatReferralFields already tags as, respectively,
 *  the Host's own verbatim language and material explicitly left open --
 *  the most literal reading of "prior themes/threads that were explicitly
 *  recorded," as opposed to a stage's own synthesis, which belongs in the
 *  full referral below, not this summary. */
function ThreadsRecorded({ sessions }: { sessions: ParticipantSessionRecord[] }) {
  const blocks = sessions
    .filter((r) => r.referral)
    .map((r) => ({
      record: r,
      items: formatReferralFields(r.referral!.from_stage, r.referral!.content).filter(
        (item) => item.role === "host_authored" || item.role === "open_unresolved"
      ),
    }))
    .filter((b) => b.items.length > 0);

  if (blocks.length === 0) return null;

  return (
    <section className="mt-10 rounded-lg border border-seal/40 bg-seal/[0.06] p-5">
      <h2 className="font-serif text-xl text-seal">Threads already recorded</h2>
      <p className="mt-1 text-sm text-muted">
        In the Host&rsquo;s own words, and what was explicitly left open -- nothing summarized,
        nothing added.
      </p>
      <div className="mt-5 space-y-5">
        {blocks.map(({ record, items }) => (
          <div key={record.session.id}>
            <p className="label text-muted">
              {sessionTitle(record)} · {fmtDate(record.session.created_at)}
            </p>
            <dl className="mt-2 space-y-2">
              {items.map((item) => (
                <div key={item.key}>
                  <dt className="text-xs text-muted">{item.label}</dt>
                  <dd className="mt-0.5 text-sm text-ink">
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
          </div>
        ))}
      </div>
    </section>
  );
}

function FullSessionDetails({ record }: { record: ParticipantSessionRecord }) {
  const { session, referral, unsungHeroesConversation, recognition } = record;
  return (
    <details className="group rule-t border-t border-rule pt-4">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="text-ink">{sessionTitle(record)}</span>
        <span className="label text-muted">
          {fmtDate(session.created_at)}
          <span className="ml-2 transition-transform group-open:rotate-90">▸</span>
        </span>
      </summary>
      <div className="mt-4">
        {unsungHeroesConversation && (
          <p className="mb-3 text-sm text-muted">{UNSUNG_HEROES_PATH_LABEL[unsungHeroesConversation.path]}</p>
        )}
        {referral && (
          <dl className="space-y-3">
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
          <div>
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
            <p className="mt-2 text-sm text-muted">{recognition.story}</p>
          </div>
        )}
        {!referral && !recognition && (
          <p className="text-sm text-muted">Nothing recorded from this session yet.</p>
        )}
      </div>
    </details>
  );
}

export default async function PreparationPage({
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
  const signatureEntries = await listSignatureEntriesForParticipant(supabase, participant.id);

  const active = sessions.filter((r) => effectiveStatus(r) !== "complete");
  const complete = sessions.filter((r) => effectiveStatus(r) === "complete");

  // Distinct (tool, program) combinations this participant has used --
  // display only, drawn straight from session.tool/program.
  const toolsUsed = [
    ...new Map(
      sessions.map((r) => [
        `${r.session.tool}:${r.session.program}`,
        r.session.program === "defying-grief" ? `${toolLabel(r.session.tool)} — Defying Grief` : toolLabel(r.session.tool),
      ])
    ).values(),
  ];

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Preparation</p>
      <h1 className="font-serif text-4xl text-ink">{participant.name}</h1>

      <div className="mt-5 rounded-lg border border-rule bg-white/[0.04] p-5">
        <p className="text-sm text-ink">
          The Host isn&rsquo;t arriving to be examined. This page only organizes what they&rsquo;ve
          already, explicitly brought forward -- it doesn&rsquo;t interpret them, diagnose them, or
          decide what this conversation should discover. It exists so nobody drops their story while
          they walk from one room to the next.
        </p>
      </div>

      <p className="mt-6 text-muted">
        {participant.email ?? "No email on file"}
        {participant.linked_host_id ? " · Linked to an AVAIA account" : ""} · Participant since{" "}
        {fmtDate(participant.created_at)}
      </p>

      {toolsUsed.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {toolsUsed.map((t) => (
            <span key={t} className="rounded-full border border-rule px-3 py-1 text-xs text-muted">
              {t}
            </span>
          ))}
        </div>
      )}

      {signatureEntries.length > 0 && (
        <section className="mt-6 rounded-lg border border-rule bg-white/[0.03] p-5">
          <p className="label mb-2 text-muted">Virtue Signature — qualities this participant has recognized</p>
          <p className="mb-3 text-sm text-muted">
            Evidence the participant has chosen to keep, not a statement of who they are.
          </p>
          <div className="flex flex-wrap gap-2">
            {signatureEntries.map((e) => (
              <VirtueLink
                key={e.id}
                family={e.family}
                virtue={e.element}
                className="rounded-full border border-rule px-3 py-1 text-xs text-ink transition-colors hover:border-seal"
              >
                {e.element ? `${e.family} — ${e.element}` : e.family}
              </VirtueLink>
            ))}
          </div>
        </section>
      )}

      <PreparationSnapshot participantId={participant.id} />
      <PreparationChat participantId={participant.id} />

      {active.length > 0 && (
        <section className="mt-10">
          <h2 className="label text-muted">Active or unfinished</h2>
          <div className="mt-3 space-y-2">
            {active.map((r) => {
              const href =
                r.session.tool === "iap" || r.session.tool === "cat" || r.session.tool === "innercompass" || r.session.tool === "unsung-heroes"
                  ? `/toolkit/${r.session.tool}/${r.session.id}`
                  : null;
              return (
                <div
                  key={r.session.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3"
                >
                  <div>
                    <p className="text-ink">{sessionTitle(r)}</p>
                    <p className="text-xs text-muted">Started {fmtDate(r.session.created_at)}</p>
                  </div>
                  {href && (
                    <Link
                      href={href}
                      className="rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
                    >
                      Continue
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <ThreadsRecorded sessions={complete} />

      {sessions.length === 0 ? (
        <p className="mt-12 text-muted">No sessions on record yet for this participant.</p>
      ) : (
        complete.length > 0 && (
          <section className="mt-10">
            <h2 className="label mb-2 text-muted">Prior sessions</h2>
            <div className="space-y-1">
              {complete.map((r) => (
                <FullSessionDetails key={r.session.id} record={r} />
              ))}
            </div>
          </section>
        )
      )}

      <p className="mt-10">
        <Link href={`/toolkit/participants/${participant.id}`} className="text-sm text-muted hover:text-seal">
          View full Participant Record →
        </Link>
      </p>
    </div>
  );
}
