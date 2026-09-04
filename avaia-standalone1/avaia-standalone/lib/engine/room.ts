import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "crypto";
import { anthropic, detectCrisis } from "./anthropic";
import { AVAIA_MODEL, roomSystemPromptFor, ROOM_REFERRAL_FORMAT, type Program } from "./prompts";
import { createConversation, createJourney } from "./conversation";
import { recordAiUsage } from "./ai-usage";
import { isParticipantClearedToParticipate } from "../guardian-consent";
import { createAdminClient } from "../supabase/admin";

export type DbRoom = {
  id: string;
  guide_id: string;
  title: string | null;
  program: Program;
  status: "active" | "complete";
  created_at: string;
  completed_at: string | null;
};

export type RoomParticipant = {
  room_participant_id: string;
  participant_id: string;
  name: string;
  developmental_band: string | null;
  added_at: string;
  removed_at: string | null;
};

export type RoomMessage = {
  id: string;
  role: "participant" | "guide";
  speaker_participant_id: string | null;
  speaker_name: string | null;
  content: string;
  created_at: string;
};

const str = { type: "string" } as const;
const strArr = { type: "array", items: { type: "string" } } as const;

// The Room's own closing record -- see ROOM_REFERRAL_FORMAT in prompts.ts
// for the discipline this schema enforces (no verdicts, no manufactured
// consensus, disagreement preserved explicitly).
const ROOM_REFERRAL_SCHEMA = {
  type: "object",
  properties: {
    roomTitle: { type: ["string", "null"] },
    whatWeWereLookingAt: str,
    whatEachPersonMadeVisible: {
      type: "array",
      items: {
        type: "object",
        properties: { participantName: str, contribution: str },
        required: ["participantName", "contribution"],
        additionalProperties: false,
      },
    },
    whatBecameClearerBetweenThem: str,
    whereTheyStillSeeItDifferently: strArr,
    whatWasChosenToCarryForward: strArr,
    questionsStillAtTheTable: strArr,
  },
  required: [
    "roomTitle",
    "whatWeWereLookingAt",
    "whatEachPersonMadeVisible",
    "whatBecameClearerBetweenThem",
    "whereTheyStillSeeItDifferently",
    "whatWasChosenToCarryForward",
    "questionsStillAtTheTable",
  ],
  additionalProperties: false,
} as const;

/** Creates a new, empty Shared Room. Title is set later, once the Room has
 *  found its own identity (see updateRoomTitle) -- never guessed at
 *  creation. */
export async function createRoom(
  supabase: SupabaseClient,
  guideId: string,
  program: Program = "general"
): Promise<DbRoom> {
  const { data, error } = await supabase
    .from("rooms")
    .insert({ guide_id: guideId, program })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as DbRoom;
}

export async function updateRoomTitle(
  supabase: SupabaseClient,
  roomId: string,
  title: string
): Promise<void> {
  await supabase.from("rooms").update({ title }).eq("id", roomId);
}

export async function listRooms(supabase: SupabaseClient, guideId: string): Promise<DbRoom[]> {
  const { data } = await supabase
    .from("rooms")
    .select("*")
    .eq("guide_id", guideId)
    .order("created_at", { ascending: false });
  return (data as DbRoom[]) ?? [];
}

export async function getRoom(supabase: SupabaseClient, roomId: string): Promise<DbRoom | null> {
  const { data } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
  return (data as DbRoom) ?? null;
}

/** Seats a participant at this Room's Table. Reuses the exact same consent
 *  gate a Youth session already requires everywhere else in AVAIA
 *  (isParticipantClearedToParticipate) -- a Youth cannot be added to a
 *  Room without an already-active, assent-confirmed guardian consent for
 *  that participant, no new consent mechanism invented here. */
export async function addParticipantToRoom(
  supabase: SupabaseClient,
  roomId: string,
  participantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cleared = await isParticipantClearedToParticipate(supabase, participantId);
  if (!cleared) {
    return {
      ok: false,
      error: "This participant needs an active guardian consent on file before joining a Room.",
    };
  }
  const { error } = await supabase
    .from("room_participants")
    .insert({ room_id: roomId, guide_participant_id: participantId });
  if (error) {
    if ((error as { code?: string }).code === "23505") return { ok: true }; // already seated
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Removes a seat -- soft-removal only. Nothing this participant already
 *  said or brought back is deleted; they simply stop being addressed as
 *  present going forward. */
export async function removeParticipantFromRoom(
  supabase: SupabaseClient,
  roomId: string,
  participantId: string
): Promise<void> {
  await supabase
    .from("room_participants")
    .update({ removed_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("guide_participant_id", participantId)
    .is("removed_at", null);
}

export async function listRoomParticipants(
  supabase: SupabaseClient,
  roomId: string,
  { activeOnly = true }: { activeOnly?: boolean } = {}
): Promise<RoomParticipant[]> {
  // Two plain queries + a manual JS join, matching this codebase's
  // established pattern (see app/toolkit/page.tsx's participantById Map)
  // rather than a PostgREST embedded-select join, which has no existing
  // precedent anywhere in this codebase to verify against.
  let query = supabase
    .from("room_participants")
    .select("id, guide_participant_id, added_at, removed_at")
    .eq("room_id", roomId)
    .order("added_at", { ascending: true });
  if (activeOnly) query = query.is("removed_at", null);
  const { data: rows } = await query;
  const seats = (rows as { id: string; guide_participant_id: string; added_at: string; removed_at: string | null }[]) ?? [];
  if (seats.length === 0) return [];

  const { data: people } = await supabase
    .from("guide_participants")
    .select("id, name, developmental_band")
    .in("id", seats.map((s) => s.guide_participant_id));
  const peopleById = new Map(
    ((people as { id: string; name: string; developmental_band: string | null }[]) ?? []).map((p) => [p.id, p])
  );

  return seats.map((s) => {
    const person = peopleById.get(s.guide_participant_id);
    return {
      room_participant_id: s.id,
      participant_id: s.guide_participant_id,
      name: person?.name ?? "(removed participant)",
      developmental_band: person?.developmental_band ?? null,
      added_at: s.added_at,
      removed_at: s.removed_at,
    };
  });
}

export async function loadRoomMessages(
  supabase: SupabaseClient,
  roomId: string
): Promise<RoomMessage[]> {
  const { data: rows } = await supabase
    .from("room_messages")
    .select("id, role, speaker_participant_id, content, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  const messages =
    (rows as {
      id: string;
      role: "participant" | "guide";
      speaker_participant_id: string | null;
      content: string;
      created_at: string;
    }[]) ?? [];

  const speakerIds = [...new Set(messages.map((m) => m.speaker_participant_id).filter((id): id is string => !!id))];
  let namesById = new Map<string, string>();
  if (speakerIds.length > 0) {
    const { data: people } = await supabase.from("guide_participants").select("id, name").in("id", speakerIds);
    namesById = new Map(((people as { id: string; name: string }[]) ?? []).map((p) => [p.id, p.name]));
  }

  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    speaker_participant_id: m.speaker_participant_id,
    speaker_name: m.speaker_participant_id ? namesById.get(m.speaker_participant_id) ?? null : null,
    content: m.content,
    created_at: m.created_at,
  }));
}

/** Posts one participant's turn into the shared Room thread and returns
 *  AVAIA's own Witness-function reply, addressed to the Table as a whole.
 *  Every active participant's name is passed into the system prompt so the
 *  model addresses people by name instead of "Person A/B" language; a
 *  Youth participant among them adds ROOM_YOUTH_SAFETY. The full shared
 *  transcript is what the model sees -- never any participant's private
 *  conversation content, which lives entirely outside room_messages. */
export async function postRoomMessage(
  supabase: SupabaseClient,
  guideId: string,
  roomId: string,
  speakerParticipantId: string,
  content: string
): Promise<{ reply: string; crisis: boolean }> {
  const crisis = detectCrisis(content);

  const { error: insertError } = await supabase.from("room_messages").insert({
    room_id: roomId,
    guide_id: guideId,
    role: "participant",
    speaker_participant_id: speakerParticipantId,
    content,
  });
  if (insertError) throw new Error(insertError.message);

  const participants = await listRoomParticipants(supabase, roomId);
  const hasYouth = participants.some((p) => !!p.developmental_band);
  const system = roomSystemPromptFor(
    participants.map((p) => p.name),
    hasYouth
  );

  const messages = await loadRoomMessages(supabase, roomId);
  const history: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role === "guide" ? ("assistant" as const) : ("user" as const),
    content: m.role === "participant" ? `[${m.speaker_name ?? "Participant"}]: ${m.content}` : m.content,
  }));

  const client = anthropic();
  const resp: any = await client.messages.create({
    model: AVAIA_MODEL,
    max_tokens: 2048,
    system,
    messages: history,
  });
  await recordAiUsage({
    hostId: guideId,
    conversationId: null,
    feature: "room_conversation",
    stage: null,
    model: resp.model,
    usage: resp.usage,
  });
  const reply =
    (resp.content as Array<{ type: string; text?: string }>).find((b) => b.type === "text")?.text ??
    "";

  if (reply.trim()) {
    await supabase.from("room_messages").insert({
      room_id: roomId,
      guide_id: guideId,
      role: "guide",
      speaker_participant_id: null,
      content: reply,
    });
  }

  return { reply, crisis };
}

/** Finds or creates a real auth.users identity for a guide_participant, so
 *  their private processing can belong to THEM rather than to the Guide's
 *  own account -- the actual mechanism that makes it inaccessible to the
 *  Guide by default (every existing conversations/messages/referrals RLS
 *  policy already excludes anyone but auth.uid() = host_id; this is what
 *  makes that auth.uid() the participant's, not the Guide's).
 *
 *  Reuses guide_participants.linked_host_id exactly as it already works
 *  for a self-serve Host account found by email (see app/toolkit/page.tsx's
 *  findHostIdByEmail) -- if already set, that identity is reused as-is
 *  the same way every day. If not set and the participant has a real email
 *  on file, a new Supabase account is created for that address (no
 *  password; access only ever happens through the one-time link this flow
 *  generates). If no email is on file, a private, unreachable placeholder
 *  address is used instead -- this account is never used for anything
 *  except this identity boundary; nothing is ever sent to it. Either way
 *  this is the SAME auth.users table and the SAME RLS every other Host
 *  already runs on -- not a parallel identity system. */
async function ensureParticipantAuthUser(
  admin: ReturnType<typeof createAdminClient>,
  supabase: SupabaseClient,
  participantId: string
): Promise<string> {
  const { data: participant } = await supabase
    .from("guide_participants")
    .select("id, name, email, linked_host_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant) throw new Error("Participant not found.");
  if (participant.linked_host_id) return participant.linked_host_id as string;

  const email =
    (participant.email as string | null)?.trim() ||
    `participant-${participant.id}@private.avaiainstitute.com`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { avaia_room_participant: true, guide_participant_id: participant.id },
  });
  if (createError || !created?.user) {
    throw new Error(createError?.message ?? "Could not provision a private identity.");
  }

  await supabase.from("guide_participants").update({ linked_host_id: created.user.id }).eq("id", participantId);
  return created.user.id;
}

/** Opens protected private processing for one participant, from inside a
 *  Room. This is still not a new engine -- it's the exact same IAP-shaped
 *  conversation (createConversation/createJourney) every individual Host
 *  gets -- but it is now provisioned under the PARTICIPANT's own identity
 *  (via the admin client, the one narrow, deliberate use of service-role
 *  privilege in this flow) rather than the Guide's. No guide_sessions row
 *  is created for it -- unlike before, this conversation must NOT surface
 *  in the Guide's own Record/participant-history views, and creating that
 *  row was the one thing that would have made it do so.
 *
 *  Returns a one-time access URL for the participant, not the conversation
 *  itself -- the Guide's own UI never receives anything that could be used
 *  to read the private conversation, only a link meant to be handed to the
 *  participant and opened in their own, separate browser context. */
export async function startPrivateProcessing(
  supabase: SupabaseClient,
  roomId: string,
  participantId: string,
  program: Program = "general",
  origin: string
): Promise<{ accessUrl: string; roomPrivateSessionId: string } | { error: string }> {
  // Defense-in-depth: addParticipantToRoom already enforces this gate before
  // a Youth can be seated at all, but this endpoint must not assume its
  // caller always seats first -- found live, exactly this way, before
  // shipping (a direct call with an unconsented participantId, skipping
  // room seating entirely, succeeded until this check was added).
  const cleared = await isParticipantClearedToParticipate(supabase, participantId);
  if (!cleared) {
    return { error: "This participant needs an active guardian consent on file before private processing." };
  }

  const admin = createAdminClient();
  const participantUserId = await ensureParticipantAuthUser(admin, supabase, participantId);

  const journeyId = await createJourney(admin, participantUserId, program);
  const conversation = await createConversation(admin, participantUserId, "iap", undefined, program, journeyId);

  const { data: rps, error: rpsError } = await supabase
    .from("room_private_sessions")
    .insert({ room_id: roomId, participant_id: participantId, conversation_id: conversation.id })
    .select("id")
    .single();
  if (rpsError) throw new Error(rpsError.message);
  const roomPrivateSessionId = (rps as { id: string }).id;

  // The real Supabase magic-link token is deliberately generated later, at
  // consume time (see consumePrivateAccessToken), not here -- generateLink's
  // own token has a shorter validity window than this access link's 30
  // minutes, and there's no reason to risk it going stale between the Guide
  // creating the link and the participant actually opening it. Our own
  // opaque `token` below is the only credential that needs to survive that
  // gap; supabase_token_hash is filled in with a real, freshly-generated
  // value at the moment it's actually used.
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes, single-use
  const { error: tokenError } = await admin.from("room_private_access_tokens").insert({
    room_private_session_id: roomPrivateSessionId,
    token,
    participant_user_id: participantUserId,
    supabase_token_hash: "",
    expires_at: expiresAt,
  });
  if (tokenError) throw new Error(tokenError.message);

  return { accessUrl: `${origin}/room-access/${token}`, roomPrivateSessionId };
}

/** Consumes a private-access token (single-use) and returns exactly what
 *  the participant's own isolated client (lib/supabase/participant-client.ts)
 *  needs to call verifyOtp() itself, establishing their session client-side.
 *  This function runs with the admin client (the token IS the credential
 *  here -- there is no signed-in user yet to check RLS against), but never
 *  returns anything the Guide's own session could use: the token_hash is
 *  handed straight back to the SAME browser context that presented the
 *  one-time token, not persisted anywhere the Guide's account can read. */
export async function consumePrivateAccessToken(token: string): Promise<
  | { tokenHash: string; email: string; roomTitle: string | null; conversationId: string; roomPrivateSessionId: string }
  | { error: string }
> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("room_private_access_tokens")
    .select("id, expires_at, used_at, participant_user_id, room_private_session_id")
    .eq("token", token)
    .maybeSingle();
  if (!row) return { error: "This link isn't valid." };
  if (row.used_at) return { error: "This link has already been used." };
  if (new Date(row.expires_at as string) < new Date()) return { error: "This link has expired." };

  await admin.from("room_private_access_tokens").update({ used_at: new Date().toISOString() }).eq("id", row.id);

  const { data: authUser } = await admin.auth.admin.getUserById(row.participant_user_id as string);
  const email = authUser?.user?.email;
  if (!email) return { error: "This link isn't valid." };

  // Re-derive a fresh hashed_token bound to this exact consumption, rather
  // than reusing the one generated at creation time -- generateLink's
  // hashed_token is itself only valid for a limited window server-side,
  // and regenerating here (still admin-side, still never touching the
  // Guide's session) keeps this robust even if some minutes passed between
  // the Guide creating the link and the participant opening it.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link) return { error: "Could not open this link. Please ask your Guide for a new one." };
  const tokenHash = (link.properties as { hashed_token?: string } | undefined)?.hashed_token;
  if (!tokenHash) return { error: "Could not open this link. Please ask your Guide for a new one." };

  const { data: rps } = await admin
    .from("room_private_sessions")
    .select("room_id, conversation_id")
    .eq("id", row.room_private_session_id as string)
    .maybeSingle();
  if (!rps) return { error: "This link isn't valid." };
  const { data: room } = await admin.from("rooms").select("title").eq("id", rps.room_id as string).maybeSingle();

  return {
    tokenHash,
    email,
    roomTitle: (room?.title as string | null) ?? null,
    conversationId: rps.conversation_id as string,
    roomPrivateSessionId: row.room_private_session_id as string,
  };
}

/** Returns from private processing, called by the PARTICIPANT's own
 *  authenticated request (see app/api/room-access/return/route.ts) -- never
 *  by the Guide. `bearerUserId` is that participant's own auth.uid(),
 *  already verified by the caller via their bearer token before this runs.
 *  This function independently re-confirms that roomPrivateSessionId
 *  actually belongs to a private conversation THIS user owns before doing
 *  anything -- a participant cannot act on another participant's private
 *  session by guessing its id.
 *
 *  `choice: "keep_private"` ends it with nothing crossing back into the
 *  Room -- the Room only ever learns that this participant stepped away
 *  and returned, never why or what was said. `choice: "brought_forward"`
 *  requires `content`: the participant's OWN chosen wording. That wording
 *  becomes a room_shared_items row AND is posted into the shared thread as
 *  this participant's own turn, through the same postRoomMessage every
 *  ordinary Room turn uses -- nothing about how it re-enters the Room is a
 *  separate, hidden mechanism. The actual writes use the admin client
 *  (room_shared_items/room_messages are Guide-owned tables by RLS) --
 *  reachable only after the ownership check above, not exposed to any
 *  unauthenticated or cross-participant caller. */
export async function returnToRoomAsParticipant(
  bearerUserId: string,
  roomPrivateSessionId: string,
  choice: "keep_private" | "brought_forward",
  content?: string
): Promise<{ reply: string | null } | { error: string }> {
  const admin = createAdminClient();
  const { data: rps } = await admin
    .from("room_private_sessions")
    .select("id, room_id, participant_id, conversation_id, returned_at")
    .eq("id", roomPrivateSessionId)
    .maybeSingle();
  if (!rps) return { error: "Private session not found." };
  if (rps.returned_at) return { error: "This private session has already been closed." };

  const { data: convo } = await admin
    .from("conversations")
    .select("host_id")
    .eq("id", rps.conversation_id as string)
    .maybeSingle();
  if (!convo || convo.host_id !== bearerUserId) {
    return { error: "This isn't your private session." };
  }

  await admin
    .from("room_private_sessions")
    .update({ returned_at: new Date().toISOString(), return_choice: choice })
    .eq("id", roomPrivateSessionId);

  if (choice === "keep_private" || !content?.trim()) {
    return { reply: null };
  }

  const { data: room } = await admin.from("rooms").select("guide_id").eq("id", rps.room_id as string).maybeSingle();
  if (!room) return { error: "Room not found." };

  await admin.from("room_shared_items").insert({
    room_id: rps.room_id,
    participant_id: rps.participant_id,
    source_private_session_id: roomPrivateSessionId,
    content: content.trim(),
  });

  const { reply } = await postRoomMessage(
    admin,
    room.guide_id as string,
    rps.room_id as string,
    rps.participant_id as string,
    content.trim()
  );
  return { reply };
}

/** Generates the Room's own closing record and marks the Room complete.
 *  Only ever reads room_messages (the shared thread) -- never any
 *  participant's private conversation, which this function has no access
 *  path to at all. */
export async function closeRoom(
  supabase: SupabaseClient,
  guideId: string,
  roomId: string
): Promise<{ ok: true; content: Record<string, unknown> } | { ok: false; error: string }> {
  const participants = await listRoomParticipants(supabase, roomId, { activeOnly: false });
  const messages = await loadRoomMessages(supabase, roomId);
  if (messages.length === 0) {
    return { ok: false, error: "This Room has no shared conversation yet." };
  }

  const hasYouth = participants.some((p) => !!p.developmental_band);
  const system = `${roomSystemPromptFor(
    participants.map((p) => p.name),
    hasYouth
  )}\n\n${"=".repeat(60)}\n\n${ROOM_REFERRAL_FORMAT}`;

  const history: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role === "guide" ? ("assistant" as const) : ("user" as const),
    content: m.role === "participant" ? `[${m.speaker_name ?? "Participant"}]: ${m.content}` : m.content,
  }));
  history.push({
    role: "user",
    content:
      "The Table is closing this Room now. Using everything in this Room's shared conversation, produce the Shared Room closing record now as structured data. Do not address anyone -- output only the fields.",
  });

  let content: unknown;
  try {
    const client = anthropic();
    const resp: any = await client.messages.create({
      model: AVAIA_MODEL,
      max_tokens: 2048,
      system,
      messages: history,
      output_config: { format: { type: "json_schema", schema: ROOM_REFERRAL_SCHEMA } },
    } as any);
    await recordAiUsage({
      hostId: guideId,
      conversationId: null,
      feature: "room_referral",
      stage: null,
      model: resp.model,
      usage: resp.usage,
    });
    const text = (resp.content as Array<{ type: string; text?: string }>).find((b) => b.type === "text")
      ?.text;
    content = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, error: "Could not generate the Room's closing record. Please try again." };
  }

  const finalContent = content as Record<string, unknown>;
  const { error: insertError } = await supabase
    .from("room_referrals")
    .insert({ room_id: roomId, content: finalContent });
  if (insertError) return { ok: false, error: "Could not save the Room's closing record." };

  await supabase
    .from("rooms")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", roomId);

  const title = (finalContent as { roomTitle?: string | null }).roomTitle;
  if (title) await updateRoomTitle(supabase, roomId, title);

  return { ok: true, content: finalContent };
}

export async function getRoomReferral(
  supabase: SupabaseClient,
  roomId: string
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("room_referrals")
    .select("content")
    .eq("room_id", roomId)
    .maybeSingle();
  return (data?.content as Record<string, unknown>) ?? null;
}

/** Active (not yet returned) private sessions for a Room -- lets the Room
 *  UI show which participants are currently away in private processing. */
export async function listActivePrivateSessions(
  supabase: SupabaseClient,
  roomId: string
): Promise<Array<{ id: string; participant_id: string; conversation_id: string }>> {
  const { data } = await supabase
    .from("room_private_sessions")
    .select("id, participant_id, conversation_id")
    .eq("room_id", roomId)
    .is("returned_at", null);
  return (data as any[]) ?? [];
}
