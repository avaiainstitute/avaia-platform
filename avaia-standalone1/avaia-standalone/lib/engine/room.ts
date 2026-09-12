import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "crypto";
import { anthropic, detectCrisis } from "./anthropic";
import {
  AVAIA_MODEL,
  roomSystemPromptFor,
  ROOM_REFERRAL_FORMAT,
  ROOM_BRING_FORWARD_SUGGESTION,
  type Program,
  type OriginContextInput,
} from "./prompts";
import { createConversation, createJourney, loadMessages, toAnthropicMessages } from "./conversation";
import { generateIapOriginOpening } from "./openings";
import { recordAiUsage } from "./ai-usage";
import { isParticipantClearedToParticipate } from "../guardian-consent";
import { createAdminClient } from "../supabase/admin";

// Every ongoing per-turn Room AI call windows history to the most recent
// messages (see postRoomMessage), so a long Room doesn't resend its entire
// transcript, and cost/latency, to the model on every single turn. This
// bounds only what the MODEL sees per turn; loadRoomMessages (the
// persistent, human-readable record) is never truncated, and closeRoom's
// one-time closing record deliberately reads the full, untruncated
// transcript, it needs completeness, not recency.
const ROOM_HISTORY_WINDOW = 40;

export type DbRoom = {
  id: string;
  guide_id: string;
  title: string | null;
  program: Program;
  status: "active" | "paused" | "complete" | "archived";
  floor_participant_id: string | null;
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
  last_seen_at: string | null;
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

// The Room's own closing record, see ROOM_REFERRAL_FORMAT in prompts.ts
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
 *  found its own identity (see updateRoomTitle), never guessed at
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
 *  (isParticipantClearedToParticipate), a Youth cannot be added to a
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

/** Removes a seat, soft-removal only. Nothing this participant already
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
    .select("id, guide_participant_id, added_at, removed_at, last_seen_at")
    .eq("room_id", roomId)
    .order("added_at", { ascending: true });
  if (activeOnly) query = query.is("removed_at", null);
  const { data: rows } = await query;
  const seats =
    (rows as { id: string; guide_participant_id: string; added_at: string; removed_at: string | null; last_seen_at: string | null }[]) ?? [];
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
      last_seen_at: s.last_seen_at,
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
 *  transcript is what the model sees, never any participant's private
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
  // Windowed for the model's own context only, see ROOM_HISTORY_WINDOW's
  // comment, the persistent record above (and what loadRoomMessages
  // returns to every reader) is never truncated.
  const windowed = messages.slice(-ROOM_HISTORY_WINDOW);
  const history: Anthropic.MessageParam[] = windowed.map((m) => ({
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
 *  own account, the actual mechanism that makes it inaccessible to the
 *  Guide by default (every existing conversations/messages/referrals RLS
 *  policy already excludes anyone but auth.uid() = host_id; this is what
 *  makes that auth.uid() the participant's, not the Guide's).
 *
 *  Reuses guide_participants.linked_host_id exactly as it already works
 *  for a self-serve Host account found by email (see app/toolkit/page.tsx's
 *  findHostIdByEmail), if already set, that identity is reused as-is
 *  the same way every day. If not set and the participant has a real email
 *  on file, a new Supabase account is created for that address (no
 *  password; access only ever happens through the one-time link this flow
 *  generates). If no email is on file, a private, unreachable placeholder
 *  address is used instead, this account is never used for anything
 *  except this identity boundary; nothing is ever sent to it. Either way
 *  this is the SAME auth.users table and the SAME RLS every other Host
 *  already runs on, not a parallel identity system. */
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
 *  Room. This is still not a new engine, it's the exact same IAP-shaped
 *  conversation (createConversation/createJourney) every individual Host
 *  gets, but it is now provisioned under the PARTICIPANT's own identity
 *  (via the admin client, the one narrow, deliberate use of service-role
 *  privilege in this flow) rather than the Guide's. No guide_sessions row
 *  is created for it, unlike before, this conversation must NOT surface
 *  in the Guide's own Record/participant-history views, and creating that
 *  row was the one thing that would have made it do so.
 *
 *  Returns a one-time access URL for the participant, not the conversation
 *  itself, the Guide's own UI never receives anything that could be used
 *  to read the private conversation, only a link meant to be handed to the
 *  participant and opened in their own, separate browser context. */
/** What the participant themselves chose to bring forward as context,
 *  resolved into the same OriginContextInput shape the adult Chemistry/
 *  View From Above flow already uses. "none" is the default, and is what
 *  every existing caller (unchanged) gets: nothing about a step-out
 *  requires bringing anything in. The other three modes are exactly the
 *  choices the participant is offered: their own contributions only,
 *  specific statements they picked, or, if they intentionally choose it,
 *  the whole Room. */
export type RoomContextSelection =
  | { mode: "none" }
  | { mode: "own"; participantId: string }
  | { mode: "messageIds"; messageIds: string[] }
  | { mode: "all" }
  // Lets a participant carry Shared Workbook items (not raw shared-thread
  // messages) into a new private conversation, the one place the Shared
  // Room Workbook connects to a participant's OWN personal Workbook: once
  // that private IAP exists, it's an ordinary conversation and already
  // shows up in /workbook like any other, no separate "personal saved
  // items" concept invented for this. See buildRoomOriginContext below.
  | { mode: "workbookItemIds"; itemIds: string[] };

/** Resolves a participant's own Room-material choice into origin context
 *  for their private conversation. Reads only room_messages (the shared
 *  thread), never any other participant's private conversation, which has
 *  no relationship to this Room's messages at all. Only 'participant'-role
 *  turns are offered, the model's own Room replies aren't "someone's
 *  contribution" to bring forward. */
export async function buildRoomOriginContext(
  supabase: SupabaseClient,
  roomId: string,
  selection: RoomContextSelection
): Promise<OriginContextInput | null> {
  if (selection.mode === "none") return null;

  if (selection.mode === "workbookItemIds") {
    const { data: rows } = await supabase
      .from("room_workbook_items")
      .select("content, speaker_name")
      .eq("room_id", roomId)
      .in("id", selection.itemIds);
    const items = ((rows as { content: string; speaker_name: string | null }[]) ?? []).map((r) => ({
      speakerName: r.speaker_name ?? "The Room",
      content: r.content,
    }));
    if (items.length === 0) return null;
    const room = await getRoom(supabase, roomId);
    return { source: "shared-room", roomTitle: room?.title ?? null, items };
  }

  const room = await getRoom(supabase, roomId);
  const allMessages = await loadRoomMessages(supabase, roomId);

  let chosen = allMessages;
  if (selection.mode === "messageIds") {
    const idSet = new Set(selection.messageIds);
    chosen = allMessages.filter((m) => idSet.has(m.id));
  } else if (selection.mode === "own") {
    chosen = allMessages.filter((m) => m.speaker_participant_id === selection.participantId);
  }
  // mode "all" keeps every message, exactly as chosen.

  const items = chosen
    .filter((m) => m.role === "participant")
    .map((m) => ({ speakerName: m.speaker_name ?? "Participant", content: m.content }));
  if (items.length === 0) return null;

  return { source: "shared-room", roomTitle: room?.title ?? null, items };
}

export async function startPrivateProcessing(
  supabase: SupabaseClient,
  roomId: string,
  participantId: string,
  program: Program = "general",
  origin: string,
  contextSelection: RoomContextSelection = { mode: "none" }
): Promise<{ accessUrl: string; roomPrivateSessionId: string } | { error: string }> {
  // Defense-in-depth: addParticipantToRoom already enforces this gate before
  // a Youth can be seated at all, but this endpoint must not assume its
  // caller always seats first, found live, exactly this way, before
  // shipping (a direct call with an unconsented participantId, skipping
  // room seating entirely, succeeded until this check was added).
  const cleared = await isParticipantClearedToParticipate(supabase, participantId);
  if (!cleared) {
    return { error: "This participant needs an active guardian consent on file before private processing." };
  }

  const admin = createAdminClient();
  const participantUserId = await ensureParticipantAuthUser(admin, supabase, participantId);

  // The participant's own choice of what to bring forward, resolved from
  // room_messages (the shared thread only) before their private
  // conversation exists, so it can seed that conversation's opening
  // exactly the same way an adult Chemistry/View From Above origin
  // already does, same mechanism, same jsonb column, nothing new.
  const originContext = await buildRoomOriginContext(supabase, roomId, contextSelection);
  const originOpening = originContext ? await generateIapOriginOpening(originContext, participantUserId, null) : undefined;
  const journeyId = await createJourney(admin, participantUserId, program);
  const conversation = await createConversation(
    admin,
    participantUserId,
    "iap",
    originOpening,
    program,
    journeyId,
    originContext
  );

  const { data: rps, error: rpsError } = await supabase
    .from("room_private_sessions")
    .insert({ room_id: roomId, participant_id: participantId, conversation_id: conversation.id })
    .select("id")
    .single();
  if (rpsError) throw new Error(rpsError.message);
  const roomPrivateSessionId = (rps as { id: string }).id;

  // The real Supabase magic-link token is deliberately generated later, at
  // consume time (see consumePrivateAccessToken), not here, generateLink's
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
 *  here, there is no signed-in user yet to check RLS against), but never
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
  // than reusing the one generated at creation time, generateLink's
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

/** Offers ONE possible way to put what the participant already said into
 *  words for the Room, never generated automatically, never auto-filled
 *  without the participant asking for it, never able to see anything they
 *  didn't already say to AVAIA themselves. `supabase` must be the
 *  participant's OWN bearer-scoped, RLS-respecting client (see
 *  app/api/room-access/suggest/route.ts), the same self-only
 *  conversations/messages RLS that keeps this conversation invisible to
 *  the Guide also means this function structurally cannot run against a
 *  conversation the caller doesn't themselves own. Non-streaming, one-shot,
 *  matching /api/room-access/message's own scope choice. */
export async function suggestBringForward(
  supabase: SupabaseClient,
  hostId: string,
  conversationId: string
): Promise<{ suggestion: string } | { error: string }> {
  const messages = await loadMessages(supabase, conversationId);
  if (messages.length <= 1) {
    return { error: "There's nothing in this conversation yet to suggest from." };
  }

  const history = toAnthropicMessages(messages);
  history.push({
    role: "user",
    content:
      "Looking back at everything above, suggest what I might want to bring forward to the Room, following your instructions exactly.",
  });

  const client = anthropic();
  const resp: any = await client.messages.create({
    model: AVAIA_MODEL,
    max_tokens: 300,
    system: ROOM_BRING_FORWARD_SUGGESTION,
    messages: history,
  });
  await recordAiUsage({
    hostId,
    conversationId,
    feature: "room_bring_forward_suggestion",
    stage: null,
    model: resp.model,
    usage: resp.usage,
  });
  const suggestion =
    (resp.content as Array<{ type: string; text?: string }>).find((b) => b.type === "text")?.text?.trim() ??
    "";
  if (!suggestion) return { error: "Could not generate a suggestion right now. Please try again." };
  return { suggestion };
}

/** Returns from private processing, called by the PARTICIPANT's own
 *  authenticated request (see app/api/room-access/return/route.ts), never
 *  by the Guide. `bearerUserId` is that participant's own auth.uid(),
 *  already verified by the caller via their bearer token before this runs.
 *  This function independently re-confirms that roomPrivateSessionId
 *  actually belongs to a private conversation THIS user owns before doing
 *  anything, a participant cannot act on another participant's private
 *  session by guessing its id.
 *
 *  `choice: "keep_private"` ends it with nothing crossing back into the
 *  Room, the Room only ever learns that this participant stepped away
 *  and returned, never why or what was said. `choice: "brought_forward"`
 *  requires `content`: the participant's OWN chosen wording. That wording
 *  becomes a room_shared_items row AND is posted into the shared thread as
 *  this participant's own turn, through the same postRoomMessage every
 *  ordinary Room turn uses, nothing about how it re-enters the Room is a
 *  separate, hidden mechanism. The actual writes use the admin client
 *  (room_shared_items/room_messages are Guide-owned tables by RLS),
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
 *  Only ever reads room_messages (the shared thread), never any
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
      "The Table is closing this Room now. Using everything in this Room's shared conversation, produce the Shared Room closing record now as structured data. Do not address anyone, output only the fields.",
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
  // Upsert, not insert: a Room can now be reopened (see reopenRoom) and
  // closed again later, room_referrals stays one row per Room, most
  // recent closing record, room_id's own UNIQUE constraint is what makes
  // this safe as an upsert rather than a growing history of records.
  const { error: insertError } = await supabase
    .from("room_referrals")
    .upsert({ room_id: roomId, content: finalContent }, { onConflict: "room_id" });
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

/** Active (not yet returned) private sessions for a Room, lets the Room
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

// ===========================================================================
// PARTICIPANT ACCESS TO THE ROOM ITSELF
//
// Everything below gives a participant their own device/account entry into
// the live Room, distinct from (and built entirely on top of) the private
// step-out flow above, which is unchanged. It reuses the exact same
// identity mechanism (ensureParticipantAuthUser, the isolated bearer-token
// client, the admin-client-plus-explicit-ownership-check pattern already
// proven by returnToRoomAsParticipant) rather than inventing a second one.
// ===========================================================================

/** Finds or creates a durable, reusable Room-join invitation for one
 *  participant. Unlike room_private_access_tokens (single-use, 30-minute,
 *  one specific step-out), this token is meant to be opened again and
 *  again, the same participant returning to the same Room tomorrow or
 *  next week is the normal case, not an edge case, see Part G. Revoking
 *  access (revokeRoomInvitation) is the only way it stops working. */
export async function getOrCreateRoomInvitation(
  supabase: SupabaseClient,
  roomId: string,
  participantId: string,
  origin: string
): Promise<{ inviteUrl: string } | { error: string }> {
  const admin = createAdminClient();
  // Reuses the same identity a private step-out would give this
  // participant, so "enter the Room" and "step out privately" are always
  // the same person, not two different accounts.
  await ensureParticipantAuthUser(admin, supabase, participantId);

  const { data: existing } = await supabase
    .from("room_invitations")
    .select("token")
    .eq("room_id", roomId)
    .eq("participant_id", participantId)
    .is("revoked_at", null)
    .maybeSingle();
  if (existing) return { inviteUrl: `${origin}/room-join/${existing.token}` };

  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase
    .from("room_invitations")
    .insert({ room_id: roomId, participant_id: participantId, token });
  if (error) return { error: error.message };
  return { inviteUrl: `${origin}/room-join/${token}` };
}

export async function revokeRoomInvitation(
  supabase: SupabaseClient,
  roomId: string,
  participantId: string
): Promise<void> {
  await supabase
    .from("room_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("participant_id", participantId)
    .is("revoked_at", null);
}

/** Consumes a Room invitation (NOT single-use, see getOrCreateRoomInvitation)
 *  and returns what the participant's isolated client needs to establish
 *  its own session, the exact same verifyOtp() handoff
 *  consumePrivateAccessToken already uses. Runs entirely on the admin
 *  client, there is no signed-in user yet to check RLS against, the token
 *  itself (validated here) is the credential. */
export async function consumeRoomInvitation(token: string): Promise<
  | { tokenHash: string; email: string; roomId: string; roomTitle: string | null; participantId: string; participantName: string }
  | { error: string }
> {
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("room_invitations")
    .select("id, room_id, participant_id, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!invite) return { error: "This invitation isn't valid." };
  if (invite.revoked_at) return { error: "This invitation is no longer active. Please ask your Guide for a new one." };

  const { data: participant } = await admin
    .from("guide_participants")
    .select("id, name, linked_host_id")
    .eq("id", invite.participant_id as string)
    .maybeSingle();
  if (!participant?.linked_host_id) return { error: "This invitation isn't valid." };

  const { data: authUser } = await admin.auth.admin.getUserById(participant.linked_host_id as string);
  const email = authUser?.user?.email;
  if (!email) return { error: "This invitation isn't valid." };

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link) return { error: "Could not open this invitation. Please ask your Guide for a new one." };
  const tokenHash = (link.properties as { hashed_token?: string } | undefined)?.hashed_token;
  if (!tokenHash) return { error: "Could not open this invitation. Please ask your Guide for a new one." };

  await admin.from("room_invitations").update({ last_used_at: new Date().toISOString() }).eq("id", invite.id);

  const { data: room } = await admin.from("rooms").select("title").eq("id", invite.room_id as string).maybeSingle();

  return {
    tokenHash,
    email,
    roomId: invite.room_id as string,
    roomTitle: (room?.title as string | null) ?? null,
    participantId: invite.participant_id as string,
    participantName: participant.name as string,
  };
}

/** Resolves which seated guide_participant a bearer-authenticated caller
 *  actually is for a SPECIFIC Room, and confirms they are currently seated
 *  (not removed) in it. Scoped to this Room's own current seats first, so
 *  a person seated in more than one Room across different Guides can
 *  never resolve ambiguously. Returns null (never throws) if either check
 *  fails, every caller below must treat that as "not authorized here." */
async function resolveSeatedParticipant(
  admin: ReturnType<typeof createAdminClient>,
  roomId: string,
  bearerUserId: string
): Promise<{ participantId: string; name: string } | null> {
  const { data: seats } = await admin
    .from("room_participants")
    .select("guide_participant_id")
    .eq("room_id", roomId)
    .is("removed_at", null);
  const seatedIds = ((seats as { guide_participant_id: string }[]) ?? []).map((s) => s.guide_participant_id);
  if (seatedIds.length === 0) return null;

  const { data: participant } = await admin
    .from("guide_participants")
    .select("id, name")
    .eq("linked_host_id", bearerUserId)
    .in("id", seatedIds)
    .maybeSingle();
  if (!participant) return null;
  return { participantId: participant.id as string, name: participant.name as string };
}

/** Everything a participant's own Room view needs to render: the Room
 *  itself, its roster, the shared thread, and this participant's own
 *  identity within it. `supabase` here is always the admin client, since
 *  rooms/room_participants/room_messages are Guide-owned by RLS; the
 *  explicit resolveSeatedParticipant check above is what stands in place
 *  of RLS for this caller. */
export async function getRoomForParticipant(
  roomId: string,
  bearerUserId: string
): Promise<
  | {
      room: DbRoom;
      participants: RoomParticipant[];
      messages: RoomMessage[];
      me: { participantId: string; name: string };
      // The participant's own last_seen_at as it stood BEFORE this call
      // updates it below, so the client can draw a "while you were away"
      // divider against messages newer than this. Null the first time a
      // participant ever opens the Room.
      myLastSeenAt: string | null;
      pendingTurnRequests: TurnRequest[];
      myTurnRequest: TurnRequest | null;
    }
  | { error: string }
> {
  const admin = createAdminClient();
  const seated = await resolveSeatedParticipant(admin, roomId, bearerUserId);
  if (!seated) return { error: "You aren't currently seated in this Room." };

  const room = await getRoom(admin, roomId);
  if (!room) return { error: "Room not found." };

  const [participants, messages, pendingTurnRequests] = await Promise.all([
    listRoomParticipants(admin, roomId),
    loadRoomMessages(admin, roomId),
    listPendingTurnRequests(admin, roomId),
  ]);

  const myLastSeenAt = participants.find((p) => p.participant_id === seated.participantId)?.last_seen_at ?? null;

  await admin
    .from("room_participants")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("guide_participant_id", seated.participantId);

  return {
    room,
    participants,
    messages,
    me: seated,
    myLastSeenAt,
    pendingTurnRequests,
    myTurnRequest: pendingTurnRequests.find((r) => r.participant_id === seated.participantId) ?? null,
  };
}

/** A participant posting their OWN turn directly, from their OWN device,
 *  no Guide relay. Deliberately not blocked by floor_participant_id, see
 *  requestTurn/recognizeTurn's own comments for why the floor is a
 *  visible signal the Guide manages, not a hard lock, every seated
 *  participant can always speak. Speaking clears the floor automatically
 *  if it was theirs, so it never gets stuck on one person. */
export async function postRoomMessageAsParticipant(
  roomId: string,
  bearerUserId: string,
  content: string
): Promise<{ reply: string; crisis: boolean } | { error: string }> {
  const admin = createAdminClient();
  const room = await getRoom(admin, roomId);
  if (!room) return { error: "Room not found." };
  if (room.status !== "active") return { error: "This Room isn't open for conversation right now." };

  const seated = await resolveSeatedParticipant(admin, roomId, bearerUserId);
  if (!seated) return { error: "You aren't currently seated in this Room." };

  const result = await postRoomMessage(admin, room.guide_id, roomId, seated.participantId, content);

  if (room.floor_participant_id === seated.participantId) {
    await admin.from("rooms").update({ floor_participant_id: null }).eq("id", roomId);
  }
  // A pending raise-hand this participant already had is naturally
  // resolved by their own turn landing, whether or not a Guide formally
  // recognized it first.
  await admin
    .from("room_turn_requests")
    .update({ status: "withdrawn", resolved_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("participant_id", seated.participantId)
    .eq("status", "pending");

  return result;
}

/** The participant-initiated equivalent of the Guide-side "start private
 *  processing" button, for someone joining and speaking from their own
 *  device via app/room-join. Reuses startPrivateProcessing verbatim,
 *  passing the ADMIN client as its `supabase` argument: every read inside
 *  that function (guardian consent, room_messages for origin context) is
 *  against Guide-owned rows this participant's own bearer-scoped client
 *  could never pass RLS for, exactly like every other participant-facing
 *  function in this file, resolveSeatedParticipant stands in for RLS
 *  here instead. The participant chooses their own contextSelection, see
 *  RoomContextSelection, nothing is brought forward without that choice. */
export async function startPrivateProcessingForParticipant(
  roomId: string,
  bearerUserId: string,
  origin: string,
  contextSelection: RoomContextSelection = { mode: "none" }
): Promise<{ accessUrl: string; roomPrivateSessionId: string } | { error: string }> {
  const admin = createAdminClient();
  const room = await getRoom(admin, roomId);
  if (!room) return { error: "Room not found." };

  const seated = await resolveSeatedParticipant(admin, roomId, bearerUserId);
  if (!seated) return { error: "You aren't currently seated in this Room." };

  return startPrivateProcessing(admin, roomId, seated.participantId, room.program, origin, contextSelection);
}

export type TurnRequest = {
  id: string;
  participant_id: string;
  name: string;
  status: "pending" | "recognized" | "withdrawn";
  requested_at: string;
};

/** Raises this participant's hand. Simple and idempotent: a second
 *  request while one is already pending is a no-op, not a stacked queue
 *  entry, keeping "who's waiting" always a clean, deduplicated list. */
export async function requestTurn(roomId: string, bearerUserId: string): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient();
  const seated = await resolveSeatedParticipant(admin, roomId, bearerUserId);
  if (!seated) return { error: "You aren't currently seated in this Room." };

  const { data: existing } = await admin
    .from("room_turn_requests")
    .select("id")
    .eq("room_id", roomId)
    .eq("participant_id", seated.participantId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return { ok: true };

  const { error } = await admin
    .from("room_turn_requests")
    .insert({ room_id: roomId, participant_id: seated.participantId });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function withdrawTurnRequest(roomId: string, bearerUserId: string): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient();
  const seated = await resolveSeatedParticipant(admin, roomId, bearerUserId);
  if (!seated) return { error: "You aren't currently seated in this Room." };

  await admin
    .from("room_turn_requests")
    .update({ status: "withdrawn", resolved_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("participant_id", seated.participantId)
    .eq("status", "pending");
  return { ok: true };
}

export async function listPendingTurnRequests(
  supabase: SupabaseClient,
  roomId: string
): Promise<TurnRequest[]> {
  const { data: rows } = await supabase
    .from("room_turn_requests")
    .select("id, participant_id, status, requested_at")
    .eq("room_id", roomId)
    .eq("status", "pending")
    .order("requested_at", { ascending: true });
  const requests =
    (rows as { id: string; participant_id: string; status: "pending"; requested_at: string }[]) ?? [];
  if (requests.length === 0) return [];

  const { data: people } = await supabase
    .from("guide_participants")
    .select("id, name")
    .in("id", requests.map((r) => r.participant_id));
  const namesById = new Map(((people as { id: string; name: string }[]) ?? []).map((p) => [p.id, p.name]));

  return requests.map((r) => ({
    id: r.id,
    participant_id: r.participant_id,
    name: namesById.get(r.participant_id) ?? "Participant",
    status: r.status,
    requested_at: r.requested_at,
  }));
}

/** Guide recognizes one raised hand. This sets a visible "who has the
 *  floor" signal for everyone reading the Room, it does not silence
 *  anyone else, see postRoomMessageAsParticipant. The purpose is what
 *  Part B asked for: everyone can see who is speaking and the Guide
 *  protects the Table, not a locking mechanism to enforce. */
export async function recognizeTurn(supabase: SupabaseClient, roomId: string, requestId: string): Promise<void> {
  const { data: req } = await supabase
    .from("room_turn_requests")
    .select("participant_id")
    .eq("id", requestId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (!req) return;
  await supabase
    .from("room_turn_requests")
    .update({ status: "recognized", resolved_at: new Date().toISOString() })
    .eq("id", requestId);
  await supabase.from("rooms").update({ floor_participant_id: req.participant_id }).eq("id", roomId);
}

export async function clearFloor(supabase: SupabaseClient, roomId: string): Promise<void> {
  await supabase.from("rooms").update({ floor_participant_id: null }).eq("id", roomId);
}

// ===========================================================================
// LIFECYCLE: active / paused / complete / archived, all reversible. Nothing
// here ever deletes room_messages/room_referrals; every transition is a
// plain status update, matching the audit's own finding that a Room's
// history was already preserved after 'complete', only the ability to
// revisit it was missing (now closed by the participant-access functions
// above, not by anything in this section).
// ===========================================================================

export async function pauseRoom(supabase: SupabaseClient, roomId: string): Promise<void> {
  await supabase.from("rooms").update({ status: "paused" }).eq("id", roomId);
}

/** Reopens a paused OR previously-complete Room back to active, with its
 *  full message history intact either way. A Room that was 'complete'
 *  keeps its existing closing record (room_referrals) until closeRoom is
 *  called again, at which point that record is replaced with a fresh one
 *  reflecting the continued conversation (see closeRoom's own upsert). */
export async function reopenRoom(supabase: SupabaseClient, roomId: string): Promise<void> {
  await supabase.from("rooms").update({ status: "active", completed_at: null }).eq("id", roomId);
}

export async function archiveRoom(supabase: SupabaseClient, roomId: string): Promise<void> {
  await supabase.from("rooms").update({ status: "archived" }).eq("id", roomId);
}

/** Unarchives back to 'complete' (not 'active'), archiving only ever
 *  applies to a Room that was already finished; if the Guide wants to
 *  actively continue it after unarchiving, reopenRoom is the next step,
 *  same as it would be for any other completed Room. */
export async function unarchiveRoom(supabase: SupabaseClient, roomId: string): Promise<void> {
  await supabase.from("rooms").update({ status: "complete" }).eq("id", roomId);
}

/** For Nav's "Shared Room" link: a signed-in Host is sometimes ALSO a
 *  seated Room participant, when guide_participants.linked_host_id (an
 *  existing, pre-Room mechanism, see lib/guide.ts's findHostIdByEmail) was
 *  set to this same account. Finds their most recently-added still-seated
 *  spot in a Room that's still active or paused (a complete/archived Room
 *  isn't worth surfacing here, it's still reachable by whoever hands the
 *  Guide's invitation link out again) and returns a ready-to-use, relative
 *  join path. Runs on the admin client: this Host's own RLS identity has
 *  no policy granting them read access to someone else's Room tables,
 *  same reasoning as every other participant-facing function above. */
export async function findActiveRoomForHost(hostId: string): Promise<{ joinPath: string } | null> {
  const admin = createAdminClient();
  const { data: asParticipant } = await admin
    .from("guide_participants")
    .select("id")
    .eq("linked_host_id", hostId);
  const participantIds = ((asParticipant as { id: string }[]) ?? []).map((p) => p.id);
  if (participantIds.length === 0) return null;

  const { data: seats } = await admin
    .from("room_participants")
    .select("room_id, guide_participant_id, added_at")
    .in("guide_participant_id", participantIds)
    .is("removed_at", null)
    .order("added_at", { ascending: false });
  const rows = (seats as { room_id: string; guide_participant_id: string; added_at: string }[]) ?? [];
  if (rows.length === 0) return null;

  const { data: rooms } = await admin
    .from("rooms")
    .select("id, status")
    .in("id", rows.map((r) => r.room_id))
    .in("status", ["active", "paused"]);
  const liveRoomIds = new Set(((rooms as { id: string; status: string }[]) ?? []).map((r) => r.id));
  const match = rows.find((r) => liveRoomIds.has(r.room_id));
  if (!match) return null;

  const result = await getOrCreateRoomInvitation(admin, match.room_id, match.guide_participant_id, "");
  if ("error" in result) return null;
  return { joinPath: result.inviteUrl };
}

// ===========================================================================
// SHARED ROOM WORKBOOK ("OURS"), never merged with a Host's own private
// Workbook, which stays exactly what it already is: a derived view over
// that Host's own conversations/referrals/Virtue Signature, see
// app/workbook/page.tsx. This Room-owned equivalent is a curated list of
// what the Table intentionally chose to KEEP, not a copy of the full
// conversation (room_messages already IS that complete record, and stays
// completely unread by anything in this section except the one explicit
// "save this message" action below).
//
// Two sources are unioned into one Workbook feed:
//   - room_workbook_items (migration 0068): a saved shared-thread message,
//     or a freeform note, either added by the Guide or by a seated
//     participant.
//   - room_shared_items (migration 0051, untouched): private material a
//     participant already explicitly chose to bring forward via the
//     existing, already-tested private step-out "brought forward" flow.
//     Reading it here does not change what that flow does.
//
// Same ownership posture as every other Room table: guide-owner RLS for
// the Guide's own cookie-scoped client, admin-client-plus-
// resolveSeatedParticipant for a participant, exactly like every other
// participant-facing function above. Room authorization is the only gate;
// nothing here checks any OTHER AVAIA role.
// ===========================================================================

export type RoomWorkbookItem = {
  id: string;
  content: string;
  /** Whose words this is, when that's meaningful; null for a Room-level
   *  note or a saved AVAIA/Witness turn. */
  speakerName: string | null;
  source: "room_message" | "note" | "private_share";
  /** Who performed the save/share action, distinct from speakerName. */
  addedByName: string;
  createdAt: string;
  /** Which room_messages row this came from, when source='room_message';
   *  lets the shared-thread UI show "Saved" instead of a duplicate save
   *  button for a message already kept. */
  sourceRoomMessageId: string | null;
};

export async function listRoomWorkbookItems(
  supabase: SupabaseClient,
  roomId: string
): Promise<RoomWorkbookItem[]> {
  const [{ data: items }, { data: shared }] = await Promise.all([
    supabase
      .from("room_workbook_items")
      .select("id, content, speaker_name, source, added_by_name, created_at, source_room_message_id")
      .eq("room_id", roomId),
    supabase
      .from("room_shared_items")
      .select("id, participant_id, content, created_at")
      .eq("room_id", roomId),
  ]);

  const sharedRows =
    (shared as { id: string; participant_id: string; content: string; created_at: string }[]) ?? [];
  let namesById = new Map<string, string>();
  if (sharedRows.length > 0) {
    const { data: people } = await supabase
      .from("guide_participants")
      .select("id, name")
      .in("id", sharedRows.map((r) => r.participant_id));
    namesById = new Map(((people as { id: string; name: string }[]) ?? []).map((p) => [p.id, p.name]));
  }

  const fromWorkbook: RoomWorkbookItem[] = (
    (items as {
      id: string;
      content: string;
      speaker_name: string | null;
      source: "room_message" | "note";
      added_by_name: string;
      created_at: string;
      source_room_message_id: string | null;
    }[]) ?? []
  ).map((r) => ({
    id: r.id,
    content: r.content,
    speakerName: r.speaker_name,
    source: r.source,
    addedByName: r.added_by_name,
    createdAt: r.created_at,
    sourceRoomMessageId: r.source_room_message_id,
  }));

  const fromShared: RoomWorkbookItem[] = sharedRows.map((r) => {
    const name = namesById.get(r.participant_id) ?? "Participant";
    return {
      id: r.id,
      content: r.content,
      speakerName: name,
      source: "private_share" as const,
      addedByName: name,
      createdAt: r.created_at,
      sourceRoomMessageId: null,
    };
  });

  return [...fromWorkbook, ...fromShared].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Guide-side ownership check + fetch, mirrors the pattern every
 *  app/api/room/[roomId]/* route already uses (getRoom, compare guide_id
 *  to the signed-in user, 404 rather than 403 on mismatch). */
export async function getRoomWorkbookForGuide(
  supabase: SupabaseClient,
  roomId: string
): Promise<RoomWorkbookItem[]> {
  return listRoomWorkbookItems(supabase, roomId);
}

export async function getRoomWorkbookForParticipant(
  roomId: string,
  bearerUserId: string
): Promise<{ items: RoomWorkbookItem[] } | { error: string }> {
  const admin = createAdminClient();
  const seated = await resolveSeatedParticipant(admin, roomId, bearerUserId);
  if (!seated) return { error: "You aren't currently seated in this Room." };
  const items = await listRoomWorkbookItems(admin, roomId);
  return { items };
}

async function insertWorkbookItemFromMessage(
  client: SupabaseClient,
  roomId: string,
  messageId: string,
  addedBy: { participantId: string | null; name: string }
): Promise<{ ok: true } | { error: string }> {
  const { data: message } = await client
    .from("room_messages")
    .select("id, speaker_participant_id, content")
    .eq("id", messageId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (!message) return { error: "That message could not be found." };

  let speakerName: string | null = null;
  if (message.speaker_participant_id) {
    const { data: person } = await client
      .from("guide_participants")
      .select("name")
      .eq("id", message.speaker_participant_id as string)
      .maybeSingle();
    speakerName = (person?.name as string | undefined) ?? null;
  }

  const { error } = await client.from("room_workbook_items").insert({
    room_id: roomId,
    content: message.content,
    speaker_name: speakerName,
    source: "room_message",
    source_room_message_id: message.id,
    added_by_participant_id: addedBy.participantId,
    added_by_name: addedBy.name,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function saveRoomMessageToWorkbookAsGuide(
  supabase: SupabaseClient,
  roomId: string,
  messageId: string
): Promise<{ ok: true } | { error: string }> {
  return insertWorkbookItemFromMessage(supabase, roomId, messageId, { participantId: null, name: "Your Guide" });
}

export async function saveRoomMessageToWorkbookAsParticipant(
  roomId: string,
  bearerUserId: string,
  messageId: string
): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient();
  const seated = await resolveSeatedParticipant(admin, roomId, bearerUserId);
  if (!seated) return { error: "You aren't currently seated in this Room." };
  return insertWorkbookItemFromMessage(admin, roomId, messageId, {
    participantId: seated.participantId,
    name: seated.name,
  });
}

async function insertWorkbookNote(
  client: SupabaseClient,
  roomId: string,
  content: string,
  addedBy: { participantId: string | null; name: string }
): Promise<{ ok: true } | { error: string }> {
  const trimmed = content.trim();
  if (!trimmed) return { error: "Nothing to save." };
  const { error } = await client.from("room_workbook_items").insert({
    room_id: roomId,
    content: trimmed,
    speaker_name: null,
    source: "note",
    added_by_participant_id: addedBy.participantId,
    added_by_name: addedBy.name,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function addRoomWorkbookNoteAsGuide(
  supabase: SupabaseClient,
  roomId: string,
  content: string
): Promise<{ ok: true } | { error: string }> {
  return insertWorkbookNote(supabase, roomId, content, { participantId: null, name: "Your Guide" });
}

export async function addRoomWorkbookNoteAsParticipant(
  roomId: string,
  bearerUserId: string,
  content: string
): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient();
  const seated = await resolveSeatedParticipant(admin, roomId, bearerUserId);
  if (!seated) return { error: "You aren't currently seated in this Room." };
  return insertWorkbookNote(admin, roomId, content, { participantId: seated.participantId, name: seated.name });
}
