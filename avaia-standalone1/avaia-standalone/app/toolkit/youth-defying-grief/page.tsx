import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DevelopmentalBand } from "@/lib/engine/prompts";

export const metadata = { title: "Youth Defying Grief — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

const BAND_LABEL: Record<DevelopmentalBand, string> = {
  "8-11": "8–11",
  "12-14": "12–14",
  "15-17": "15–17",
};

function isBand(value: FormDataEntryValue | null): value is DevelopmentalBand {
  return value === "8-11" || value === "12-14" || value === "15-17";
}

/** Same email-lookup pattern used in app/toolkit/defying-grief/page.tsx and
 *  app/toolkit/page.tsx -- kept local to each start action rather than
 *  factored out, matching that established precedent. */
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

/** Guide-facilitated Youth Defying Grief is not a separate implementation
 *  either -- it's the exact same installed IAP/CAT/InnerCompass tools,
 *  started with program: "youth" and session_context: "youth_individual"
 *  instead of "general"/"adult_individual". youthSystemPromptFor (frozen,
 *  untouched) already layers in the Stone-and-Ripples and Audacity framing
 *  unconditionally for every Youth conversation -- Defying Grief is the
 *  Youth program, not a second thing to switch on. The one genuinely new
 *  piece of state a Guide must supply that a self-serve Youth Host
 *  supplies themselves at /youth: the participant's developmental band,
 *  since AVAIA has no profile to read it from for someone the Guide is
 *  facilitating (see 0038_youth_guide_facilitation.sql). */
async function startYouthDefyingGriefSession(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const band = formData.get("band");
  if (!name || !isBand(band)) redirect("/toolkit/youth-defying-grief");

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
  if (participantError || !participant) redirect("/toolkit/youth-defying-grief");

  const { data: session, error: sessionError } = await supabase
    .from("guide_sessions")
    .insert({
      guide_id: user.id,
      participant_id: participant.id,
      tool: "iap",
      program: "youth",
      session_context: "youth_individual",
    })
    .select("id")
    .single();
  if (sessionError || !session) redirect("/toolkit/youth-defying-grief");

  redirect(`/toolkit/iap/${session.id}`);
}

export default async function ToolkitYouthDefyingGriefPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Programs</p>
      <h1 className="font-serif text-4xl text-ink">Youth Defying Grief</h1>
      <p className="mt-4 text-lg text-muted">
        The same Individual Awareness Profile, Conversations Across Time, and InnerCompass
        Toolkit tools a self-serve Youth Host already uses at /youth, developmentally adapted and
        threaded with Defying Grief&rsquo;s own framing -- Stone and Ripples at Awareness, Audacity
        at Understanding and Agency. Nothing about the underlying engine is different; only who is
        present in the room and how it begins.
      </p>

      <form
        action={startYouthDefyingGriefSession}
        className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm"
      >
        <div className="grid gap-4 sm:grid-cols-2">
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
              Email (optional — links to their AVAIA account if they have one)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
        </div>

        <fieldset className="mt-6">
          <legend className="label mb-3">Developmental band</legend>
          <p className="mb-3 text-sm text-muted">
            Governs how this conversation is developmentally adapted throughout -- shorter,
            concrete language for a younger participant; fuller complexity for an older one. What
            Defying Grief means never changes; only how it&rsquo;s spoken does.
          </p>
          {(Object.keys(BAND_LABEL) as DevelopmentalBand[]).map((band) => (
            <label
              key={band}
              className="mt-2 flex cursor-pointer items-start gap-3 rounded-md border border-rule bg-white/[0.03] px-4 py-3 first:mt-0"
            >
              <input type="radio" name="band" value={band} className="mt-1" required />
              <span className="text-ink">{BAND_LABEL[band]}</span>
            </label>
          ))}
        </fieldset>

        <button
          type="submit"
          className="mt-6 rounded-md bg-[#c1502e] px-5 py-2.5 font-sans text-sm font-semibold text-[#0c0503] transition-shadow hover:shadow-[0_0_24px_rgba(193,80,46,0.4)]"
        >
          Begin Youth Defying Grief
        </button>
      </form>
    </div>
  );
}
