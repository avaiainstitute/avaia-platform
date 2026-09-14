import "server-only";
import { anthropic } from "@/lib/engine/anthropic";
import { AVAIA_MODEL } from "@/lib/engine/prompts";
import { recordAiUsage } from "@/lib/engine/ai-usage";
import { EXPERIENCE_TYPES } from "@/lib/experiences-agent";

// Round 4 (Automation Blueprint): Founder Idea Catcher, Decision Keeper,
// Follow-up Memory, and After-Meeting Capture -- four clearly distinct
// KINDS of the same underlying act (Dorian records something in his own
// words so it isn't lost), sharing one table (founder_notes, migration
// 0073) and this one module.
//
// CRITICAL, per Dorian's own instruction: an idea is not a decision, a
// decision is not a task, and none of the three is ever inferred beyond
// what Dorian actually said. This module never invents a commitment, never
// promotes an idea into a decision, and never lets an AI-assisted parse
// save itself -- extractNoteFields() only ever returns a *proposal* for a
// human (Dorian, via the admin UI) to review and edit before saveFounderNote()
// is called with whatever they actually confirmed.

export type FounderNoteKind = "idea" | "decision" | "follow_up" | "meeting_note";

export type FounderNoteExtraction = {
  title: string;
  personName: string | null;
  organizationName: string | null;
  nextAction: string | null;
  followUpDate: string | null; // YYYY-MM-DD
  relatedExperience: string | null;
  category: string | null;
};

const CATEGORY_VALUES = [
  "avaia", "pink_shoelace", "program", "experience", "website", "future", "follow_up", "other",
] as const;

/** Asks Claude to propose structured fields from Dorian's own raw text --
 *  a plain extraction, no web search, no judgment calls about what Dorian
 *  "meant" beyond what the text says. Used only for kind = 'follow_up' or
 *  'meeting_note', the two kinds where typing everything twice (once as a
 *  sentence, again as separate fields) would otherwise be real duplicate
 *  data entry. Returns a best-effort proposal; the caller (app/api/notes/
 *  parse/route.ts) hands it back to the browser for Dorian to review, and
 *  nothing is written to the database from this function. */
export async function extractNoteFields(
  kind: "follow_up" | "meeting_note",
  rawText: string
): Promise<FounderNoteExtraction | null> {
  const client = anthropic();
  const system = `You extract structured fields from a short note a nonprofit founder just
typed or dictated for himself, right after a call or meeting. You never
add information that isn't in the text, and you never invent a promise or
commitment he didn't actually state. If a field isn't mentioned, use null.

Respond with ONLY a JSON object (no prose, no markdown fences) of this shape:
{
  "title": string (a short, plain label for this note, under 80 characters),
  "personName": string | null,
  "organizationName": string | null,
  "nextAction": string | null (what he said he would do or needs to do, in his own words -- never invented),
  "followUpDate": string | null (an ISO date YYYY-MM-DD, ONLY if a specific date, or an unambiguous relative time like "in three weeks" from today, ${new Date().toISOString().slice(0, 10)}, was actually stated -- otherwise null, never guessed),
  "relatedExperience": one of ${EXPERIENCE_TYPES.join(", ")} if the note clearly references that established AVAIA offering, otherwise null,
  "category": one of ${CATEGORY_VALUES.join(", ")} if reasonably clear, otherwise null
}`;

  let resp: any;
  try {
    resp = await client.messages.create({
      model: AVAIA_MODEL,
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: rawText.slice(0, 4000) }],
    });
  } catch (e) {
    console.error("Founder note extraction: Anthropic call failed:", e);
    return null;
  }

  try {
    await recordAiUsage({
      hostId: null,
      conversationId: null,
      feature: "founder_note_extraction",
      stage: null,
      model: resp.model,
      usage: resp.usage,
    });
  } catch {
    // best-effort telemetry only
  }

  const textBlocks = (resp.content as Array<{ type: string; text?: string }>).filter(
    (b) => b.type === "text" && b.text
  );
  const lastText = textBlocks[textBlocks.length - 1]?.text?.trim();
  if (!lastText) return null;

  try {
    const cleaned = lastText.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object") return null;

    const dateOk =
      typeof parsed.followUpDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.followUpDate)
        ? parsed.followUpDate
        : null;

    return {
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim().slice(0, 200) : (kind === "meeting_note" ? "Meeting note" : "Follow-up"),
      personName: parsed.personName ? String(parsed.personName).trim().slice(0, 200) : null,
      organizationName: parsed.organizationName ? String(parsed.organizationName).trim().slice(0, 300) : null,
      nextAction: parsed.nextAction ? String(parsed.nextAction).trim().slice(0, 1000) : null,
      followUpDate: dateOk,
      relatedExperience: EXPERIENCE_TYPES.includes(parsed.relatedExperience) ? parsed.relatedExperience : null,
      category: (CATEGORY_VALUES as readonly string[]).includes(parsed.category) ? parsed.category : null,
    };
  } catch (e) {
    console.error("Founder note extraction: failed to parse model output as JSON:", e);
    return null;
  }
}
