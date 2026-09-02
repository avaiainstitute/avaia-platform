import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { recordGuardianConsentForParticipant, type GuardianConsentScope, type VerificationMethod } from "@/lib/guardian-consent";
import { YOUTH_ASSENT_TEXT } from "@/lib/youth-assent-text";
import type { DevelopmentalBand } from "@/lib/engine/prompts";

export const dynamic = "force-dynamic";

/** Per-participant guardian consent, offering the choice this program
 *  roster exists to make real: 'guide_or_self_attested' (consent already
 *  collected -- a signed form, a verbal exchange -- immediately active,
 *  the same mechanism the individual entry point already uses) or
 *  'guardian_link_confirmed' (generates a unique link only the guardian
 *  can complete; the record starts 'pending' and this participant is not
 *  cleared to participate until they do). See lib/guardian-consent.ts and
 *  migration 0043 for the underlying model. */
async function submitConsent(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const programId = String(formData.get("programId") ?? "");
  const participantId = String(formData.get("participantId") ?? "");

  const { data: participant } = await supabase
    .from("guide_participants")
    .select("id, guide_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.guide_id !== user.id) notFound();

  const scope = String(formData.get("scope") ?? "individual") as GuardianConsentScope;
  const guardianName = String(formData.get("guardianName") ?? "").trim();
  const guardianEmail = String(formData.get("guardianEmail") ?? "").trim();
  const sponsoringOrganization = String(formData.get("sponsoringOrganization") ?? "").trim() || null;
  const verificationMethod = String(formData.get("verificationMethod") ?? "guide_or_self_attested") as VerificationMethod;

  const backHref = `/toolkit/youth-defying-grief/programs/${programId}/participants/${participantId}/consent`;

  if (!guardianName || !guardianEmail) {
    redirect(`${backHref}?error=${encodeURIComponent("Guardian name and email are required.")}`);
  }

  if (verificationMethod === "guide_or_self_attested") {
    if (formData.get("guardianConsentConfirmed") !== "1" || formData.get("assentDelivered") !== "1") {
      redirect(
        `${backHref}?error=${encodeURIComponent(
          "Confirm both guardian consent was collected and Youth participation information was delivered."
        )}`
      );
    }
  }

  const { error, consentToken } = await recordGuardianConsentForParticipant(
    supabase,
    user.id,
    participantId,
    scope,
    guardianName,
    guardianEmail,
    sponsoringOrganization,
    verificationMethod,
    verificationMethod === "guide_or_self_attested"
  );
  if (error) redirect(`${backHref}?error=${encodeURIComponent(error)}`);

  if (verificationMethod === "guardian_link_confirmed" && consentToken) {
    redirect(
      `/toolkit/youth-defying-grief/programs/${programId}?consentLink=${encodeURIComponent(consentToken)}&participant=${encodeURIComponent(guardianName)}`
    );
  }

  redirect(`/toolkit/youth-defying-grief/programs/${programId}`);
}

export default async function ParticipantConsentPage({
  params,
  searchParams,
}: {
  params: { programId: string; participantId: string };
  searchParams?: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const { data: participant } = await supabase
    .from("guide_participants")
    .select("id, name, developmental_band, guide_id")
    .eq("id", params.participantId)
    .maybeSingle();
  if (!participant || participant.guide_id !== user.id) notFound();

  const { data: program } = await supabase
    .from("youth_programs")
    .select("id, name, delivery_context")
    .eq("id", params.programId)
    .maybeSingle();
  if (!program) notFound();

  const band = participant.developmental_band as DevelopmentalBand | null;
  const defaultScope: GuardianConsentScope =
    program.delivery_context === "school_organization" ? "school_organization" : "group_workshop";

  return (
    <div>
      <p className="mb-6">
        <Link href={`/toolkit/youth-defying-grief/programs/${program.id}`} className="label hover:text-seal">
          ← Back to {program.name}
        </Link>
      </p>
      <p className="label mb-3">Guardian Consent</p>
      <h1 className="font-serif text-4xl text-ink">{participant.name}</h1>

      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {searchParams.error}
        </p>
      )}

      {!band && (
        <p className="mt-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          This participant has no developmental band on record yet — set one from the roster before
          they can be cleared to participate, even once consent is confirmed.
        </p>
      )}

      <form action={submitConsent} className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <input type="hidden" name="programId" value={program.id} />
        <input type="hidden" name="participantId" value={participant.id} />
        <input type="hidden" name="scope" value={defaultScope} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label mb-2 block" htmlFor="guardianName">
              Parent/guardian name
            </label>
            <input
              id="guardianName"
              name="guardianName"
              type="text"
              required
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
          <div>
            <label className="label mb-2 block" htmlFor="guardianEmail">
              Parent/guardian email
            </label>
            <input
              id="guardianEmail"
              name="guardianEmail"
              type="email"
              required
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
        </div>

        {program.delivery_context === "school_organization" && (
          <div className="mt-4">
            <label className="label mb-2 block" htmlFor="sponsoringOrganization">
              Sponsoring organization note (optional)
            </label>
            <input
              id="sponsoringOrganization"
              name="sponsoringOrganization"
              type="text"
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
        )}

        <fieldset className="mt-6 rounded-md border border-rule bg-white/[0.03] p-4">
          <legend className="label mb-3 px-1">How was consent obtained?</legend>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-rule bg-white/[0.03] px-4 py-3">
            <input type="radio" name="verificationMethod" value="guide_or_self_attested" defaultChecked className="mt-1" />
            <span className="text-sm text-ink">
              I already collected this guardian&rsquo;s consent (a signed form, a verbal exchange) —
              record it now.
            </span>
          </label>
          <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-md border border-rule bg-white/[0.03] px-4 py-3">
            <input type="radio" name="verificationMethod" value="guardian_link_confirmed" className="mt-1" />
            <span className="text-sm text-ink">
              Send the guardian a private link — they confirm it themselves. This participant stays
              &ldquo;not cleared&rdquo; until they do.
            </span>
          </label>

          <div className="mt-4 border-t border-rule pt-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" name="guardianConsentConfirmed" value="1" className="mt-1" />
              <span className="text-sm text-ink">
                I confirm this participant&rsquo;s parent or guardian has given permission for
                participation. <span className="text-muted">(Only needed if recording consent directly.)</span>
              </span>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input type="checkbox" name="assentDelivered" value="1" className="mt-1" />
              <span className="text-sm text-ink">
                I have communicated the age-appropriate participation information to this Youth Host.{" "}
                <span className="text-muted">(Only needed if recording consent directly.)</span>
              </span>
            </label>
          </div>
        </fieldset>

        {band && (
          <details className="mt-4 rounded-md border border-rule bg-white/[0.03] p-4">
            <summary className="cursor-pointer text-sm text-ink">
              View Youth participation information — {band}
            </summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{YOUTH_ASSENT_TEXT[band]}</p>
          </details>
        )}

        <button
          type="submit"
          className="mt-6 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Save Consent
        </button>
      </form>
    </div>
  );
}
