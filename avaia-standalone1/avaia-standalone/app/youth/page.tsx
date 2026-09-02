import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import YouthAssentForm from "@/components/YouthAssentForm";
import { createConversation, createJourney } from "@/lib/engine/conversation";
import type { DevelopmentalBand } from "@/lib/engine/prompts";

export const metadata = { title: "AVAIA for Youth" };
export const dynamic = "force-dynamic";

function isBand(value: FormDataEntryValue | null): value is DevelopmentalBand {
  return value === "8-11" || value === "12-14" || value === "15-17";
}

/** Mirrors startDefyingGriefWorkshop in app/defying-grief/page.tsx: same
 *  archive-then-create shape, plus writing the chosen developmental band.
 *  Shared by both a first Youth Journey and "Begin Another Youth Journey". */
async function startYouthJourney(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  band: DevelopmentalBand
) {
  await supabase.from("profiles").update({ developmental_band: band }).eq("id", userId);

  await supabase
    .from("conversations")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("host_id", userId)
    .eq("status", "active");

  // Every Youth Journey start is a new Journey -- never reuses a prior one,
  // matching /journey?new=1 and startDefyingGriefWorkshop. createConversation
  // seeds the normal STAGE_OPENING.iap line automatically since no explicit
  // opening is passed.
  const journeyId = await createJourney(supabase, userId, "youth");
  await createConversation(supabase, userId, "iap", undefined, "youth", journeyId);
}

async function beginYouthJourney(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/youth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("consent_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");

  const band = formData.get("band");
  if (!isBand(band)) redirect("/youth");

  // The Youth Host's own understanding of what participation involves --
  // separate from guardian consent (already recorded at /welcome). Checked
  // server-side, not just via the client component's disabled button --
  // see components/YouthAssentForm.tsx for the actual band-specific text
  // this checkbox follows.
  if (formData.get("assentAcknowledged") !== "1") redirect("/youth");

  await startYouthJourney(supabase, user.id, band);
  redirect("/journey");
}

export default async function YouthPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <p className="label mb-3">AVAIA for Youth</p>
        <h1 className="font-serif text-4xl text-ink">Begin your Youth Journey</h1>
        <p className="mt-4 text-lg text-muted">
          The same three AVAIA conversations, adapted for you — no account required yet.
        </p>
        <div className="mt-8">
          <Link
            href="/sign-in?from=/youth"
            className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Sign in to begin
          </Link>
        </div>
      </div>
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("consent_at, developmental_band")
    .eq("id", user.id)
    .maybeSingle();

  // Same posture as /journey -- a real query error must never be silently
  // treated as "not consented."
  if (profileError) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <p className="label mb-3">Something&rsquo;s wrong</p>
        <h1 className="font-serif text-4xl text-ink">We couldn&rsquo;t load your profile</h1>
        <p className="mt-4 text-lg text-muted">
          This is a server-side problem, not something to retry your way past. Please let AVAIA
          know what happened.
        </p>
        <p className="mt-3 text-xs text-muted/70">Details: {profileError.message}</p>
      </div>
    );
  }

  if (!profile?.consent_at) redirect("/welcome");

  const { data: youthConvos } = await supabase
    .from("conversations")
    .select("id, status")
    .eq("host_id", user.id)
    .eq("program", "youth")
    .order("created_at", { ascending: false })
    .limit(1);

  const mostRecent = youthConvos?.[0] ?? null;

  // A Youth Journey is already under way -- /journey already renders it
  // correctly for any program (chat UI, stage transitions, membership gate,
  // referral continuity), so there's nothing Youth-specific to add here.
  if (mostRecent?.status === "active") {
    redirect("/journey");
  }

  const alreadyStarted = mostRecent !== null;

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <div className="flex items-baseline justify-between">
        <Link href="/" className="font-serif text-xl tracking-[0.16em] text-ink">
          AVAIA
        </Link>
        <SignOutButton />
      </div>

      <p className="label mt-8 mb-2">AVAIA for Youth</p>
      <h1 className="font-serif text-4xl text-ink">
        {alreadyStarted ? "Begin Another Youth Journey" : "Begin your Youth Journey"}
      </h1>
      <p className="mt-4 text-lg text-muted">
        The same three conversations every AVAIA Host takes — Individual Awareness Profile,
        Conversations Across Time, and InnerCompass — adapted for you.
      </p>

      <YouthAssentForm
        action={beginYouthJourney}
        defaultBand={(profile.developmental_band as DevelopmentalBand) ?? null}
        submitLabel={alreadyStarted ? "Begin Another Youth Journey" : "Begin"}
      />
    </div>
  );
}
