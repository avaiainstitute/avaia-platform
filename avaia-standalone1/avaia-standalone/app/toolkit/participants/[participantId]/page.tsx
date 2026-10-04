import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantHistory, type ParticipantSessionRecord } from "@/lib/guide";
import { toolLabel } from "@/lib/toolkit";
import { UNSUNG_HEROES_PATH_LABEL } from "@/lib/engine/prompts";
import {
  formatReferralFields,
  normalizeVirtueClassifications,
  VIRTUE_FIELD_KEYS,
} from "@/lib/engine/referral-provenance";
import { familyOf, type VirtueFamilyKey } from "@/lib/virtues";
import { VirtueLink } from "@/components/VirtueLink";
import { getViewFromAboveClass } from "@/lib/view-from-above";
import { HOST_VOICE_LABEL, hostVoiceItems, offerSourceKey, participantIsReachable } from "@/lib/kept-items";
import { waitingOfferKeys } from "@/lib/ops/kept-items";
import { offerItemsAction, withdrawOfferAction } from "./offer-actions";

export const metadata = { title: "Participant Record, Guide Toolkit, AVAIA" };
export const dynamic = "force-dynamic";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

/** One session card's title, the tool it ran, with the Program framing
 *  folded in (neither Defying Grief nor View From Above is its own `tool`;
 *  they're iap/cat/innercompass with session.program identifying which).
 *  For Youth, session.youth_program (migration 0066) says which established
 *  Program the session belongs to, since program itself only ever says
 *  "youth" for all of them; see lib/engine/prompts.ts's youthSystemPromptFor
 *  for why the default (no youth_program recorded) means Defying Grief. */
function sessionTitle(record: ParticipantSessionRecord): string {
  const base = toolLabel(record.session.tool);
  if (record.session.program === "defying-grief") return `${base}, Defying Grief`;
  if (record.session.program === "view-from-above") {
    const cls = record.session.class_context ? getViewFromAboveClass(record.session.class_context) : undefined;
    return cls ? `${base}, The View from Above, ${cls.title}` : `${base}, The View from Above`;
  }
  if (record.session.program === "youth") {
    if (record.session.youth_program === "view-from-above") {
      const cls = record.session.class_context ? getViewFromAboveClass(record.session.class_context) : undefined;
      return cls ? `${base}, Youth, The View from Above, ${cls.title}` : `${base}, Youth, The View from Above`;
    }
    return `${base}, Youth, Defying Grief`;
  }
  return base;
}

/** The Guide's way of giving something back. A Guide may OFFER an item from this session to the
 *  participant; a Guide may never decide that it belongs in the participant's record. The
 *  participant confirms the session is theirs, sees the item, and chooses whether to keep it,
 *  and the Guide is never told what they chose. An offer is a pointer, never a copy. */
function OfferPanel({
  record,
  participantId,
  participantName,
  reachable,
  waiting,
}: {
  record: ParticipantSessionRecord;
  participantId: string;
  participantName: string;
  reachable: boolean;
  waiting: Map<string, string>;
}) {
  const { session, referral, recognition } = record;
  const referralItems = referral ? hostVoiceItems(referral.content) : [];
  const hasAnything = referralItems.length > 0 || !!recognition;
  if (!hasAnything) return null;

  type Row = { value: string; label: string; text: string; key: string };
  const rows: Row[] = [
    ...referralItems.map((i) => ({
      value: `field:${i.field}:${i.index}`,
      label: HOST_VOICE_LABEL[i.field],
      text: i.text,
      key: offerSourceKey({ sessionId: session.id, sourceType: "referral_field", field: i.field, index: i.index }),
    })),
    ...(recognition && session.tool === "unsung-heroes"
      ? [
          {
            value: `recognition:${recognition.id}`,
            label: "Recognition",
            text: recognition.title,
            key: offerSourceKey({ sessionId: session.id, sourceType: "recognition", recognitionId: recognition.id }),
          },
        ]
      : []),
  ];
  if (rows.length === 0) return null;
  const open = rows.filter((r) => !waiting.has(r.key));
  const pending = rows.filter((r) => waiting.has(r.key));

  return (
    <div className="mt-5 rounded-lg border border-rule bg-white/[0.03] p-4">
      <p className="label text-muted">Offer something back to {participantName}</p>
      <p className="mt-1 text-xs text-muted">
        Offering is not deciding. They confirm this session was theirs, see the item, and choose whether to keep it. You will not be told what
        they choose, and nothing is kept for them.
      </p>
      {!reachable ? (
        <p className="mt-3 text-sm text-muted">
          There is no email on file for this person, so there is no account an offer could reach. Add their email to offer anything.
        </p>
      ) : (
        <>
          {pending.length > 0 && (
            <ul className="mt-3 space-y-2">
              {pending.map((r) => (
                <li key={r.key} className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink">
                  <span>
                    <span className="label mr-2 text-muted">{r.label}</span>
                    {r.text}
                  </span>
                  <form action={withdrawOfferAction} className="flex items-center gap-2">
                    <input type="hidden" name="participantId" value={participantId} />
                    <input type="hidden" name="offerId" value={waiting.get(r.key)} />
                    <span className="text-xs text-muted">Offered, waiting</span>
                    <button type="submit" className="rounded-md border border-rule px-2.5 py-1 text-xs text-ink hover:border-seal">
                      Withdraw
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {open.length > 0 && (
            <form action={offerItemsAction} className="mt-3">
              <input type="hidden" name="participantId" value={participantId} />
              <input type="hidden" name="sessionId" value={session.id} />
              <ul className="space-y-2">
                {open.map((r) => (
                  <li key={r.key}>
                    <label className="flex items-start gap-3 text-sm text-ink">
                      <input type="checkbox" name="item" value={r.value} className="mt-1" />
                      <span>
                        <span className="label mr-2 text-muted">{r.label}</span>
                        {r.text}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button type="submit" className="mt-3 rounded-md border border-rule px-4 py-2 font-sans text-sm text-ink transition-colors hover:border-seal">
                Offer the ones I have ticked
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

function SessionCard({
  record,
  participantId,
  participantName,
  reachable,
  waiting,
}: {
  record: ParticipantSessionRecord;
  participantId: string;
  participantName: string;
  reachable: boolean;
  waiting: Map<string, string>;
}) {
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
          {formatReferralFields(referral.from_stage, referral.content).map((item) => {
            // Same Chemistry connection fix Workbook already has (app/
            // workbook/page.tsx): re-derive the structured classification
            // from the raw referral content so this, the Guide-facing
            // counterpart of Workbook for a Guide-facilitated participant,
            // links to real Chemistry of Virtue entries too, instead of
            // showing the formatted "Family, Element" text as plain,
            // unlinked strings.
            const virtueClassifications = VIRTUE_FIELD_KEYS.has(item.key)
              ? normalizeVirtueClassifications(
                  (referral.content as Record<string, unknown> | null)?.[item.key]
                )
              : null;
            return (
              <div key={item.key}>
                <dt className="label text-muted">{item.label}</dt>
                <dd className="mt-1 text-sm text-ink">
                  {virtueClassifications ? (
                    <ul className="list-disc space-y-0.5 pl-5">
                      {virtueClassifications.map((v, i) => (
                        <li key={i}>
                          <VirtueLink
                            family={v.family}
                            virtue={v.element}
                            className="underline decoration-rule underline-offset-2 hover:text-seal"
                          >
                            {v.element ? `${v.family}, ${v.element}` : v.family}
                          </VirtueLink>
                        </li>
                      ))}
                    </ul>
                  ) : Array.isArray(item.value) ? (
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
            );
          })}
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
            <span className="text-ink">{recognition.who_became_visible}</span>, recognized for it
          </p>
          <p className="mt-2 line-clamp-3 text-sm text-muted">{recognition.story}</p>
        </div>
      )}

      <OfferPanel record={record} participantId={participantId} participantName={participantName} reachable={reachable} waiting={waiting} />

      {!referral && !recognition && (
        <p className="mt-3 text-sm text-muted">
          {status === "complete"
            ? "Marked complete, but no referral was found for this session, worth a closer look."
            : "Still in progress, nothing recorded from it yet."}
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
  searchParams,
}: {
  params: { participantId: string };
  searchParams: { offered?: string; offerError?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const history = await getParticipantHistory(supabase, user.id, params.participantId);
  if (!history) notFound();
  const { participant, sessions } = history;
  const reachable = participantIsReachable({ linked_host_id: participant.linked_host_id, email: participant.email });
  const waiting = await waitingOfferKeys(supabase, user.id, participant.id);

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

      {searchParams?.offered && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">{searchParams.offered}</p>
      )}
      {searchParams?.offerError && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">{searchParams.offerError}</p>
      )}

      {sessions.length === 0 ? (
        <p className="mt-12 text-muted">No sessions yet for this participant.</p>
      ) : (
        <div className="mt-10 space-y-4">
          {sessions.map((record) => (
            <SessionCard
              key={record.session.id}
              record={record}
              participantId={participant.id}
              participantName={participant.name}
              reachable={reachable}
              waiting={waiting}
            />
          ))}
        </div>
      )}
    </div>
  );
}
