import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, detectCrisis } from "./anthropic";
import { AVAIA_MODEL, roomSystemPromptFor, ROOM_REFERRAL_FORMAT, type Program } from "./prompts";
import { createConversation, createJourney, type DbConversation } from "./conversation";
import { recordAiUsage } from "./ai-usage";
import { isParticipantClearedToParticipate } from "../guardian-consent";

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

/** Opens protected private processing for one participant, from inside a
 *  Room. This is NOT a new engine -- it is an ordinary IAP-shaped
 *  conversation (same createConversation/createJourney every individual
 *  Host gets), only remembered here as Room-linked via
 *  room_private_sessions. Also creates a normal guide_sessions row for
 *  this participant so the existing Guide's Record / participant-history
 *  views pick it up for free, exactly like any other Guide-facilitated
 *  session -- no new continuity surface invented. */
export async function startPrivateProcessing(
  supabase: SupabaseClient,
  guideId: string,
  roomId: string,
  participantId: string,
  program: Program = "general"
): Promise<{ conversation: DbConversation; roomPrivateSessionId: string; guideSessionId: string }> {
  const journeyId = await createJourney(supabase, guideId, program);
  const conversation = await createConversation(supabase, guideId, "iap", undefined, program, journeyId);

  const { data: session, error: sessionError } = await supabase
    .from("guide_sessions")
    .insert({
      guide_id: guideId,
      participant_id: participantId,
      tool: "iap",
      conversation_id: conversation.id,
      program: program === "youth" ? "general" : program,
      session_context: "adult_individual",
    })
    .select("id")
    .single();
  if (sessionError) throw new Error(sessionError.message);

  const { data: rps, error: rpsError } = await supabase
    .from("room_private_sessions")
    .insert({ room_id: roomId, participant_id: participantId, conversation_id: conversation.id })
    .select("id")
    .single();
  if (rpsError) throw new Error(rpsError.message);

  return {
    conversation,
    roomPrivateSessionId: (rps as { id: string }).id,
    guideSessionId: (session as { id: string }).id,
  };
}

/** Closes out a private-processing session. `choice: "keep_private"` ends
 *  it with nothing crossing back into the Room -- the Room only ever
 *  learns that this participant stepped away and returned, never why or
 *  what was said. `choice: "brought_forward"` requires `content`: the
 *  participant's OWN chosen wording (accepted as suggested, or edited /
 *  retyped -- "say it myself instead" is just this field, hand-authored).
 *  That wording becomes a room_shared_items row AND is posted into the
 *  shared thread as this participant's own turn, followed by AVAIA's own
 *  Witness-function reply acknowledging it -- the same path any ordinary
 *  Room turn takes, so nothing about how it re-enters the Room is special
 *  or hidden. */
export async function returnToRoom(
  supabase: SupabaseClient,
  guideId: string,
  roomPrivateSessionId: string,
  choice: "keep_private" | "brought_forward",
  content?: string
): Promise<{ reply: string | null }> {
  const { data: rps } = await supabase
    .from("room_private_sessions")
    .select("id, room_id, participant_id")
    .eq("id", roomPrivateSessionId)
    .maybeSingle();
  if (!rps) throw new Error("Private session not found.");

  await supabase
    .from("room_private_sessions")
    .update({ returned_at: new Date().toISOString(), return_choice: choice })
    .eq("id", roomPrivateSessionId);

  if (choice === "keep_private" || !content?.trim()) {
    return { reply: null };
  }

  await supabase.from("room_shared_items").insert({
    room_id: rps.room_id,
    participant_id: rps.participant_id,
    source_private_session_id: roomPrivateSessionId,
    content: content.trim(),
  });

  const { reply } = await postRoomMessage(supabase, guideId, rps.room_id, rps.participant_id, content.trim());
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
