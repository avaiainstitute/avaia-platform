import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getConsentStatusForParticipant,
  isParticipantClearedToParticipate,
  revokeGuardianConsent,
} from "@/lib/guardian-consent";
import type { DevelopmentalBand } from "@/lib/engine/prompts";

export const dynamic = "force-dynamic";

type Program = {
  id: string;
  guide_id: string;
  name: string;
  delivery_context: "group_workshop" | "school_organization";
  delivery_format: string | null;
  status: string;
  organization_id: string | null;
  starts_at: string | null;
  session_notes: string | null;
};

type Participant = {
  id: string;
  name: string;
  email: string | null;
  developmental_band: DevelopmentalBand | null;
};

const BAND_LABEL: Record<DevelopmentalBand, string> = { "8-11": "8–11", "12-14": "12–14", "15-17": "15–17" };

function isBand(value: string | null): value is DevelopmentalBand {
  return value === "8-11" || value === "12-14" || value === "15-17";
}

/** Bulk registration -- the "add multiple participants efficiently in one
 *  workflow" requirement. No file-upload infrastructure exists anywhere
 *  in this codebase (checked before building this), so rather than
 *  inventing one, this parses a plain textarea: one participant per line,
 *  comma-separated Name, Email, Band (email and band both optional --
 *  either can be filled in later from the roster). This creates the
 *  participant + program registration only; guardian consent and Youth
 *  assent are deliberately NOT bulk-confirmed here -- a Guide cannot
 *  truthfully bulk-attest to collecting consent from several different
 *  guardians in one click, so each participant's consent is recorded
 *  individually, per person, from their own row below. */
async function bulkAddParticipants(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const programId = String(formData.get("programId") ?? "");
  const { data: program } = await supabase
    .from("youth_programs")
    .select("id, guide_id")
    .eq("id", programId)
    .maybeSingle();
  if (!program || program.guide_id !== user.id) notFound();

  const raw = String(formData.get("bulkText") ?? "");
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const parts = line.split(",").map((p) => p.trim());
    const name = parts[0] ?? "";
    if (!name) continue;
    const email = parts[1] || null;
    const bandRaw = (parts[2] || "").trim();
    const band = isBand(bandRaw) ? bandRaw : null;

    const { data: participant, error: participantError } = await supabase
      .from("guide_participants")
      .insert({ guide_id: user.id, name, email, developmental_band: band })
      .select("id")
      .single();
    if (participantError || !participant) continue;

    await supabase
      .from("youth_program_participants")
      .insert({ program_id: programId, participant_id: participant.id });
  }

  redirect(`/toolkit/youth-defying-grief/programs/${programId}`);
}

async function addSingleParticipant(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const programId = String(formData.get("programId") ?? "");
  const { data: program } = await supabase
    .from("youth_programs")
    .select("id, guide_id")
    .eq("id", programId)
    .maybeSingle();
  if (!program || program.guide_id !== user.id) notFound();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`/toolkit/youth-defying-grief/programs/${programId}`);
  const email = String(formData.get("email") ?? "").trim() || null;
  const bandRaw = String(formData.get("band") ?? "");
  const band = isBand(bandRaw) ? bandRaw : null;

  const { data: participant, error } = await supabase
    .from("guide_participants")
    .insert({ guide_id: user.id, name, email, developmental_band: band })
    .select("id")
    .single();
  if (error || !participant) redirect(`/toolkit/youth-defying-grief/programs/${programId}`);

  await supabase.from("youth_program_participants").insert({ program_id: programId, participant_id: participant.id });

  redirect(`/toolkit/youth-defying-grief/programs/${programId}`);
}

/** Corrects an erroneous registration -- removes the participant from
 *  THIS program's roster only. Does not delete the guide_participants row
 *  or any guardian_consents record -- a mis-added registration is an
 *  administrative correction, not a request to erase someone's data (see
 *  the separate Youth data deletion tooling for that). */
async function removeRegistration(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const programId = String(formData.get("programId") ?? "");
  const participantId = String(formData.get("participantId") ?? "");
  const { data: program } = await supabase
    .from("youth_programs")
    .select("id, guide_id")
    .eq("id", programId)
    .maybeSingle();
  if (!program || program.guide_id !== user.id) notFound();

  await supabase
    .from("youth_program_participants")
    .update({ registration_status: "removed" })
    .eq("program_id", programId)
    .eq("participant_id", participantId);

  redirect(`/toolkit/youth-defying-grief/programs/${programId}`);
}

/** Withdraws guardian consent -- e.g. the guardian contacted the Guide
 *  directly to withdraw permission (the consent page itself tells them
 *  they can do this; before this action existed, there was no way for a
 *  Guide to actually act on that -- revokeGuardianConsent() existed in
 *  lib/guardian-consent.ts but nothing in the app ever called it). Flips
 *  the participant's current pending-or-active consent to 'revoked',
 *  which immediately drops them out of isParticipantClearedToParticipate
 *  -- does not touch registration or delete any data; see the separate
 *  Youth data deletion tooling for that. */
async function revokeConsent(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const programId = String(formData.get("programId") ?? "");
  const participantId = String(formData.get("participantId") ?? "");
  const { data: program } = await supabase
    .from("youth_programs")
    .select("id, guide_id")
    .eq("id", programId)
    .maybeSingle();
  if (!program || program.guide_id !== user.id) notFound();

  const { data: participant } = await supabase
    .from("guide_participants")
    .select("id, guide_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.guide_id !== user.id) notFound();

  const { data: consent } = await supabase
    .from("guardian_consents")
    .select("id")
    .eq("guide_participant_id", participantId)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (consent) {
    await revokeGuardianConsent(supabase, consent.id);
  }

  redirect(`/toolkit/youth-defying-grief/programs/${programId}`);
}

/** Starts this participant's own private Youth Defying Grief session --
 *  only reachable when isParticipantClearedToParticipate is true (the
 *  button itself is only rendered then, and this action re-checks
 *  server-side rather than trusting the UI). Identical program='youth',
 *  session_context='youth_individual' shape as the individual entry
 *  point (app/toolkit/youth-defying-grief/page.tsx) -- this is that same
 *  private engine, launched from a roster instead of a standalone form,
 *  never a second implementation. */
async function launchParticipantSession(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const participantId = String(formData.get("participantId") ?? "");
  const { data: participant } = await supabase
    .from("guide_participants")
    .select("id, guide_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.guide_id !== user.id) notFound();

  const cleared = await isParticipantClearedToParticipate(supabase, participantId);
  if (!cleared) redirect(`/toolkit/youth-defying-grief/programs`);

  const { data: session, error } = await supabase
    .from("guide_sessions")
    .insert({
      guide_id: user.id,
      participant_id: participantId,
      tool: "iap",
      program: "youth",
      session_context: "youth_individual",
    })
    .select("id")
    .single();
  if (error || !session) redirect(`/toolkit/youth-defying-grief/programs`);

  redirect(`/toolkit/iap/${session.id}`);
}

export default async function YouthProgramRosterPage({
  params,
  searchParams,
}: {
  params: { programId: string };
  searchParams?: { consentLink?: string; participant?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const { data: programData } = await supabase
    .from("youth_programs")
    .select("*")
    .eq("id", params.programId)
    .maybeSingle();
  if (!programData || (programData as Program).guide_id !== user.id) notFound();
  const program = programData as Program;

  let organizationName: string | null = null;
  if (program.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", program.organization_id)
      .maybeSingle();
    organizationName = org?.name ?? null;
  }

  const { data: regRows } = await supabase
    .from("youth_program_participants")
    .select("participant_id, registration_status, added_at")
    .eq("program_id", program.id)
    .eq("registration_status", "registered")
    .order("added_at", { ascending: true });
  const participantIds = (regRows ?? []).map((r) => r.participant_id);

  let participants: Participant[] = [];
  if (participantIds.length > 0) {
    const { data } = await supabase
      .from("guide_participants")
      .select("id, name, email, developmental_band")
      .in("id", participantIds);
    participants = (data as Participant[]) ?? [];
  }

  const rows = await Promise.all(
    participants.map(async (p) => {
      const consent = await getConsentStatusForParticipant(supabase, p.id);
      const cleared = await isParticipantClearedToParticipate(supabase, p.id);
      return { participant: p, consent, cleared };
    })
  );

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit/youth-defying-grief/programs" className="label hover:text-seal">
          ← Back to Programs
        </Link>
      </p>
      <p className="label mb-3">Program</p>
      <h1 className="font-serif text-4xl text-ink">{program.name}</h1>
      <p className="mt-3 text-muted">
        {program.delivery_context === "school_organization" ? "School / organization" : "Group / workshop"}
        {organizationName ? ` · ${organizationName}` : ""}
        {program.delivery_format ? ` · ${program.delivery_format}` : ""}
        {" · "}Status: {program.status}
      </p>
      {program.session_notes && <p className="mt-2 text-sm text-muted">{program.session_notes}</p>}

      {searchParams?.consentLink && (
        <div className="mt-6 rounded-lg border border-seal/40 bg-seal/[0.06] p-5">
          <p className="text-sm text-ink">
            Consent link generated for <span className="font-semibold">{searchParams.participant}</span>. Send this
            to the guardian directly (text, email, however fits) — AVAIA does not send it for you. This
            participant is not cleared until the guardian opens it and confirms.
          </p>
          <p className="mt-3 break-all rounded-md border border-rule bg-white/[0.04] px-3 py-2 font-mono text-xs text-ink">
            {`${headers().get("x-forwarded-proto") ?? "https"}://${headers().get("host")}/consent/${searchParams.consentLink}`}
          </p>
        </div>
      )}

      <section className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5">
        <p className="label mb-2 text-muted">Shared-room delivery</p>
        <p className="mb-3 text-sm text-muted">
          The curriculum itself is delivered live -- print the Facilitator Guide and Participant
          Materials for the whole room from the Youth Defying Grief curriculum. Private AVAIA
          sessions launch per-participant below, only once cleared.
        </p>
        <Link
          href="/toolkit/youth-defying-grief"
          className="text-sm text-ink underline decoration-rule underline-offset-2 hover:text-seal"
        >
          Open Youth Defying Grief curriculum →
        </Link>
      </section>

      <section className="mt-10">
        <p className="label mb-3 text-muted">Add Participants</p>
        <div className="grid gap-4 md:grid-cols-2">
          <form
            action={addSingleParticipant}
            className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm"
          >
            <input type="hidden" name="programId" value={program.id} />
            <p className="mb-3 text-sm text-ink">Add one participant</p>
            <div className="space-y-3">
              <input
                name="name"
                type="text"
                placeholder="Participant name"
                required
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
              <input
                name="email"
                type="email"
                placeholder="Email (optional)"
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
              <select
                name="band"
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              >
                <option value="" className="bg-[#05060b]">
                  Band not yet known
                </option>
                {(Object.keys(BAND_LABEL) as DevelopmentalBand[]).map((b) => (
                  <option key={b} value={b} className="bg-[#05060b]">
                    {BAND_LABEL[b]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="mt-4 rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
            >
              Add
            </button>
          </form>

          <form
            action={bulkAddParticipants}
            className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm"
          >
            <input type="hidden" name="programId" value={program.id} />
            <p className="mb-3 text-sm text-ink">Add several at once</p>
            <p className="mb-2 text-xs text-muted">
              One per line: Name, Email (optional), Band (optional — 8-11, 12-14, or 15-17)
            </p>
            <textarea
              name="bulkText"
              rows={6}
              placeholder={"Jordan Lee, jordan@example.com, 12-14\nAlex Rivera, , 15-17\nSam Chen"}
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
            <button
              type="submit"
              className="mt-4 rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
            >
              Add All
            </button>
          </form>
        </div>
      </section>

      <section className="mt-10">
        <p className="label mb-3 text-muted">Roster ({rows.length})</p>
        {rows.length === 0 ? (
          <p className="text-muted">No participants registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-muted">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Band</th>
                  <th className="py-2 pr-4">Guardian consent</th>
                  <th className="py-2 pr-4">Youth assent</th>
                  <th className="py-2 pr-4">Cleared</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ participant, consent, cleared }) => (
                  <tr key={participant.id} className="border-b border-rule/50">
                    <td className="py-3 pr-4 text-ink">{participant.name}</td>
                    <td className="py-3 pr-4 text-muted">
                      {participant.developmental_band ? BAND_LABEL[participant.developmental_band] : "—"}
                    </td>
                    <td className="py-3 pr-4 text-muted">
                      {consent.status === "none" && "Not started"}
                      {consent.status === "pending" && "Waiting on guardian"}
                      {consent.status === "active" && "Confirmed"}
                      {consent.status === "revoked" && "Revoked"}
                    </td>
                    <td className="py-3 pr-4 text-muted">{consent.assentConfirmed ? "Confirmed" : "Not yet"}</td>
                    <td className="py-3 pr-4">
                      {cleared ? (
                        <span className="rounded-full border border-seal/40 bg-seal/[0.08] px-2 py-0.5 text-xs text-ink">
                          Cleared
                        </span>
                      ) : (
                        <span className="rounded-full border border-rule px-2 py-0.5 text-xs text-muted">
                          Not cleared
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-2">
                        {consent.status === "none" && (
                          <Link
                            href={`/toolkit/youth-defying-grief/programs/${program.id}/participants/${participant.id}/consent`}
                            className="rounded-md border border-rule px-3 py-1.5 text-xs text-ink transition-colors hover:border-seal"
                          >
                            Add consent
                          </Link>
                        )}
                        {(consent.status === "pending" || consent.status === "active") && (
                          <form action={revokeConsent}>
                            <input type="hidden" name="programId" value={program.id} />
                            <input type="hidden" name="participantId" value={participant.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-rule px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/60 hover:text-red-300"
                            >
                              Revoke consent
                            </button>
                          </form>
                        )}
                        {cleared && (
                          <form action={launchParticipantSession}>
                            <input type="hidden" name="participantId" value={participant.id} />
                            <button
                              type="submit"
                              className="rounded-md bg-seal px-3 py-1.5 text-xs font-semibold text-[#05060b] transition-opacity hover:opacity-90"
                            >
                              Start session
                            </button>
                          </form>
                        )}
                        <Link
                          href={`/toolkit/preparation/${participant.id}`}
                          className="rounded-md border border-rule px-3 py-1.5 text-xs text-ink transition-colors hover:border-seal"
                        >
                          Prepare
                        </Link>
                        <form action={removeRegistration}>
                          <input type="hidden" name="programId" value={program.id} />
                          <input type="hidden" name="participantId" value={participant.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-rule px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/60 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
