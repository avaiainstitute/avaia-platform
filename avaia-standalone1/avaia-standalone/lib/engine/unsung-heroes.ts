import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordGuardianConsentForParticipant, isParticipantClearedToParticipate } from "@/lib/guardian-consent";
import {
  UNSUNG_HEROES_PATH_OPENING,
  type UnsungHeroesPath,
  type DevelopmentalBand,
} from "./prompts";

function isBand(value: FormDataEntryValue | null): value is DevelopmentalBand {
  return value === "8-11" || value === "12-14" || value === "15-17";
}

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

/** Every failure branch below redirects back to the toolkit Unsung Heroes
 *  entry page with ?error= set. */
function failPath(message: string): string {
  return `/toolkit/unsung-heroes?error=${encodeURIComponent(message)}`;
}

// A parallel record to lib/engine/conversation.ts's DbConversation/DbMessage,
// backed by unsung_heroes_conversations/unsung_heroes_messages — kept fully
// separate so nothing here touches the core Journey's tables or logic.

export type UnsungHeroesMessage = {
  id: string;
  conversation_id: string;
  role: "host" | "guide";
  content: string;
  created_at: string;
};

export type UnsungHeroesConversation = {
  id: string;
  host_id: string;
  path: UnsungHeroesPath;
  status: "active" | "complete";
  created_at: string;
  completed_at: string | null;
};

/** The Host's current active Unsung Heroes conversation, if any (most recent). */
export async function getActiveUnsungHeroesConversation(
  supabase: SupabaseClient,
  hostId: string
): Promise<UnsungHeroesConversation | null> {
  const { data } = await supabase
    .from("unsung_heroes_conversations")
    .select("*")
    .eq("host_id", hostId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as UnsungHeroesConversation) ?? null;
}

/** Create an Unsung Heroes conversation for a path and seed the Guide's opener. */
export async function createUnsungHeroesConversation(
  supabase: SupabaseClient,
  hostId: string,
  path: UnsungHeroesPath
): Promise<UnsungHeroesConversation> {
  const { data, error } = await supabase
    .from("unsung_heroes_conversations")
    .insert({ host_id: hostId, path })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const convo = data as UnsungHeroesConversation;

  await supabase.from("unsung_heroes_messages").insert({
    conversation_id: convo.id,
    host_id: hostId,
    role: "guide",
    content: UNSUNG_HEROES_PATH_OPENING[path],
  });

  return convo;
}

export async function loadUnsungHeroesMessages(
  supabase: SupabaseClient,
  conversationId: string
): Promise<UnsungHeroesMessage[]> {
  const { data } = await supabase
    .from("unsung_heroes_messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data as UnsungHeroesMessage[]) ?? [];
}

/** Starts an Unsung Heroes session from the Guide Toolkit -- either for a
 *  brand-new participant (name/email/optional band collected inline, same
 *  as this action's original, page-local form) or for an EXISTING roster
 *  participant (participantId present). Unsung Heroes runs on its own
 *  engine, fully separate from the IAP/CAT/InnerCompass conversation
 *  tables; the only new thing here is creating the conversation under the
 *  Guide's account and tracking it via guide_sessions, same posture as the
 *  Journey tools. Unlike IAP, the path has to be chosen before the
 *  conversation can exist at all, so participant + session + conversation
 *  are all created in one action rather than lazily on first load.
 *
 *  Deliberately placed in this lib module, not as a page.tsx export --
 *  Next.js's App Router only allows a fixed set of named exports from a
 *  page.tsx (default, metadata, generateMetadata, etc.); a plain exported
 *  function there fails the build's page-shape typecheck. This is the one
 *  place three separate UI surfaces (the toolkit's own Unsung Heroes entry
 *  form, the Youth Group/Program roster, and the Guide's general
 *  existing-participants list) share the exact same action, per the
 *  group-delivery gap found in a live facilitator-readiness audit: there
 *  was previously no way to launch Unsung Heroes for someone already
 *  registered on a roster, only ever a brand-new participant.
 *
 *  When participantId is present, this reuses that existing, already-owned
 *  participant instead of creating a new one, skips re-collecting a
 *  name/email/consent already on file, and gates on the same
 *  isParticipantClearedToParticipate check IAP's own roster launch already
 *  uses -- a Youth participant must already be guardian-consented and
 *  assented, exactly as before, just not re-collected here. Absent
 *  participantId, every original behavior (new participant, guardian
 *  consent collected inline) is unchanged. */
export async function startUnsungHeroesSession(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const path = String(formData.get("path") ?? "") as UnsungHeroesPath;
  if (!Object.keys(UNSUNG_HEROES_PATH_OPENING).includes(path)) redirect(failPath("Choose a path."));

  const existingParticipantId = String(formData.get("participantId") ?? "").trim();
  let participantId: string;
  let band: DevelopmentalBand | null;

  if (existingParticipantId) {
    const { data: existing } = await supabase
      .from("guide_participants")
      .select("id, guide_id, developmental_band")
      .eq("id", existingParticipantId)
      .maybeSingle();
    if (!existing || existing.guide_id !== user.id) redirect(failPath("Participant not found."));

    band = (existing!.developmental_band as DevelopmentalBand | null) ?? null;
    if (band && !(await isParticipantClearedToParticipate(supabase, existing!.id))) {
      redirect(failPath("This participant isn't cleared yet -- guardian consent and Youth assent are required first."));
    }
    participantId = existing!.id;
  } else {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!name) redirect(failPath("Enter a name and choose a path."));

    // Optional -- most Unsung Heroes participants are adults. Set only when
    // this session is for a Youth participant, exactly the same signal
    // app/toolkit/youth-defying-grief/page.tsx sets: its presence is what
    // /api/unsung-heroes/message and /recognition use to compose the Youth
    // instructions instead of the adult ones (see resolveDevelopmentalBand,
    // lib/guide.ts). Unsung Heroes stays its own single entry point rather
    // than a parallel "Youth Unsung Heroes" page -- it's a supporting tool
    // inside the Youth Defying Grief ecosystem, not a second Youth program.
    const bandField = formData.get("band");
    band = isBand(bandField) ? bandField : null;

    // A band means this participant is a Youth Host -- guardian consent and
    // the Guide's assent-delivery confirmation are then required, the same
    // as Youth Defying Grief. An adult session (no band) needs neither, so
    // it stays exactly as simple as before this requirement existed. See
    // components/GuideYouthConsentFields.tsx (bandOptional mode) for the UI
    // these fields come from.
    const guardianName = String(formData.get("guardianName") ?? "").trim();
    const guardianEmail = String(formData.get("guardianEmail") ?? "").trim();
    if (
      band &&
      (!guardianName ||
        !guardianEmail ||
        formData.get("guardianConsentConfirmed") !== "1" ||
        formData.get("assentDelivered") !== "1")
    ) {
      redirect(failPath("Guardian consent and Youth participation information are both required."));
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
    if (participantError || !participant)
      redirect(failPath(participantError?.message ?? "Could not create the participant."));

    if (band) {
      const { error: consentError } = await recordGuardianConsentForParticipant(
        supabase,
        user.id,
        participant!.id,
        "individual",
        guardianName,
        guardianEmail,
        null,
        "guide_or_self_attested",
        true
      );
      if (consentError) redirect(failPath(consentError));
    }
    participantId = participant!.id;
  }

  let convo: UnsungHeroesConversation;
  try {
    convo = await createUnsungHeroesConversation(supabase, user.id, path);
  } catch (e) {
    redirect(failPath(e instanceof Error ? e.message : "Could not start the conversation."));
  }

  const { data: session, error: sessionError } = await supabase
    .from("guide_sessions")
    .insert({
      guide_id: user.id,
      participant_id: participantId,
      tool: "unsung-heroes",
      conversation_id: convo!.id,
      program: band ? "youth" : "general",
      session_context: band ? "youth_individual" : "adult_individual",
    })
    .select("id")
    .single();
  if (sessionError || !session)
    redirect(failPath(sessionError?.message ?? "Could not create the session."));

  redirect(`/toolkit/unsung-heroes/${session.id}`);
}
