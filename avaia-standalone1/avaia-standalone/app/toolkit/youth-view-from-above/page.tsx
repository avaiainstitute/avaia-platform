import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordGuardianConsentForParticipant } from "@/lib/guardian-consent";
import GuideYouthConsentFields from "@/components/GuideYouthConsentFields";
import type { DevelopmentalBand } from "@/lib/engine/prompts";
import { VIEW_FROM_ABOVE_CLASSES, getViewFromAboveClass } from "@/lib/view-from-above";

export const metadata = { title: "Youth, The View from Above, Guide Toolkit, AVAIA" };
export const dynamic = "force-dynamic";

function isBand(value: FormDataEntryValue | null): value is DevelopmentalBand {
  return value === "8-11" || value === "12-14" || value === "15-17";
}

/** Same email-lookup pattern used in app/toolkit/youth-defying-grief/page.tsx
 *  and app/toolkit/view-from-above/page.tsx, kept local to each start
 *  action rather than factored out, matching that established precedent. */
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

/** Delivery-infrastructure port of Youth Defying Grief's own individual
 *  entry point (app/toolkit/youth-defying-grief/page.tsx): the exact same
 *  installed IAP tool, guardian-consent module, and developmental-band
 *  mechanism, started with program: "youth" and session_context:
 *  "youth_individual", the same values Youth Defying Grief already uses.
 *
 *  FIXED (Program/Toolkit architecture reconciliation, second pass):
 *  guide_sessions.youth_program (migration 0066) now tells the shared
 *  Youth engine which established Program this session belongs to, so
 *  youthSystemPromptFor (lib/engine/prompts.ts) injects The View From
 *  Above's own generic VIEW_FROM_ABOVE_CONTEXT clause here instead of
 *  Defying Grief's Stone-and-Ripples/Audacity framing. Program identity and
 *  developmental band are threaded separately, exactly as two different
 *  things. class_context (the same column the adult tool already uses) is
 *  now also set here, since Preparation actually surfaces it (see
 *  app/toolkit/preparation/[participantId]/page.tsx's sessionTitle), so a
 *  Youth session's specific class is no longer lost either. */
async function startYouthViewFromAboveSession(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const slug = String(formData.get("slug") ?? "");
  const cls = getViewFromAboveClass(slug);
  if (!cls) redirect("/toolkit/youth-view-from-above");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const band = formData.get("band");
  if (!name || !isBand(band)) redirect("/toolkit/youth-view-from-above");

  // Same two-part requirement as Youth Defying Grief: guardian consent
  // authorizes participation, the Guide's own confirmation that they
  // delivered the age-appropriate assent information is separate, both
  // required and checked server-side before any row exists.
  const guardianName = String(formData.get("guardianName") ?? "").trim();
  const guardianEmail = String(formData.get("guardianEmail") ?? "").trim();
  if (
    !guardianName ||
    !guardianEmail ||
    formData.get("guardianConsentConfirmed") !== "1" ||
    formData.get("assentDelivered") !== "1"
  ) {
    redirect(
      `/toolkit/youth-view-from-above?error=${encodeURIComponent(
        "Guardian consent and Youth participation information are both required."
      )}`
    );
  }

  const linkedHostId = email ? await findHostIdByEmail(email) : null;

  const { data: participant, error: participantError } = await supabase
    .from("guide_participants")
    .insert({
      guide_id: user.id,
      name,
      email: email || null,
      linked_host_id: linkedHostId,
      developmental_band: band,
    })
    .select("id")
    .single();
  if (participantError || !participant) {
    console.error("AVAIA youth-view-from-above error: participant insert failed", participantError);
    redirect(
      `/toolkit/youth-view-from-above?error=${encodeURIComponent(participantError?.message ?? "no participant returned")}`
    );
  }

  const { error: consentError } = await recordGuardianConsentForParticipant(
    supabase,
    user.id,
    participant.id,
    "individual",
    guardianName,
    guardianEmail,
    null,
    "guide_or_self_attested",
    true
  );
  if (consentError) {
    console.error("AVAIA youth-view-from-above error: guardian consent insert failed", consentError);
    redirect(`/toolkit/youth-view-from-above?error=${encodeURIComponent(consentError)}`);
  }

  const { data: session, error: sessionError } = await supabase
    .from("guide_sessions")
    .insert({
      guide_id: user.id,
      participant_id: participant.id,
      tool: "iap",
      program: "youth",
      session_context: "youth_individual",
      youth_program: "view-from-above",
      class_context: slug,
    })
    .select("id")
    .single();
  if (sessionError || !session) {
    console.error("AVAIA youth-view-from-above error: session insert failed", sessionError);
    redirect(
      `/toolkit/youth-view-from-above?error=${encodeURIComponent(sessionError?.message ?? "no session returned")}`
    );
  }

  redirect(`/toolkit/iap/${session.id}`);
}

export default async function ToolkitYouthViewFromAbovePage({
  searchParams,
}: {
  searchParams: { error?: string; class?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const preselected = searchParams.class && getViewFromAboveClass(searchParams.class) ? searchParams.class : "";

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Programs</p>
      <h1 className="font-serif text-4xl text-ink">Youth, The View from Above</h1>
      <p className="mt-4 text-lg text-muted">
        The same Individual Awareness Profile a self-serve Youth Host already uses at /youth,
        developmentally adapted by band and threaded with The View From Above&rsquo;s own framing,
        opened here for a young participant after you&rsquo;ve taught one of the ten classes live
        (see{" "}
        <Link href="/toolkit/view-from-above" className="text-ink underline decoration-rule underline-offset-2 hover:text-seal">
          The View from Above Toolkit
        </Link>{" "}
        for the shared teaching, questions, and Chemistry activity for each class).
      </p>

      {searchParams.error && (
        <div className="mt-6 rounded-lg border border-red-500/40 bg-red-500/[0.08] p-4 text-sm text-red-300">
          Couldn&rsquo;t start this session: {searchParams.error}
        </div>
      )}

      <form
        action={startYouthViewFromAboveSession}
        className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm"
      >
        <label className="label mb-2 block" htmlFor="slug">
          Class
        </label>
        <select
          id="slug"
          name="slug"
          required
          defaultValue={preselected}
          className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
        >
          <option value="" disabled className="bg-[#05060b] text-ink">
            Choose one of the ten classes…
          </option>
          {VIEW_FROM_ABOVE_CLASSES.map((c, i) => (
            <option key={c.slug} value={c.slug} className="bg-[#05060b] text-ink">
              {i + 1}. {c.title}, {c.virtueFamily}
            </option>
          ))}
        </select>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
              Email (optional, links to their AVAIA account if they have one)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
        </div>

        <GuideYouthConsentFields />

        <button
          type="submit"
          className="mt-6 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Begin Private Conversation
        </button>
      </form>
    </div>
  );
}
