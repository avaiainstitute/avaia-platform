import "server-only";
import { anthropic } from "@/lib/engine/anthropic";
import { AVAIA_MODEL, preparationSnapshotSystemPrompt, UNSUNG_HEROES_PATH_LABEL } from "@/lib/engine/prompts";
import { recordAiUsage } from "@/lib/engine/ai-usage";
import {
  formatReferralFields,
  formatVirtueClassifications,
  formatSecondaryLossClassifications,
} from "@/lib/engine/referral-provenance";
import type { ParticipantHistory } from "@/lib/guide";

// Generates the Participant Snapshot -- see PREPARATION_SNAPSHOT_GENERATION's
// own comment in lib/engine/prompts.ts for why this is a single bounded
// generation call, never a conversation. Reuses the exact same ParticipantHistory
// shape /toolkit/preparation/[participantId] already loads via
// getParticipantHistory (lib/guide.ts) -- this function never queries the
// database itself, so it can never see anything the calling route didn't
// already legitimately load under that Guide's own ownership check.

const SNAPSHOT_SCHEMA = {
  type: "object",
  properties: {
    currentFocus: { type: "string" },
    whatsStillActive: { type: "string" },
    strengthsVisible: { type: "string" },
    growthOpportunities: { type: "string" },
    questionsWorthRevisiting: { type: "string" },
    whatHasChanged: { type: "string" },
    guideReminder: { type: "string" },
  },
  required: [
    "currentFocus",
    "whatsStillActive",
    "strengthsVisible",
    "growthOpportunities",
    "questionsWorthRevisiting",
    "whatHasChanged",
    "guideReminder",
  ],
  additionalProperties: false,
} as const;

export type ParticipantSnapshot = {
  currentFocus: string;
  whatsStillActive: string;
  strengthsVisible: string;
  growthOpportunities: string;
  questionsWorthRevisiting: string;
  whatHasChanged: string;
  guideReminder: string;
};

/** Builds the evidence bundle handed to the model -- deliberately narrow:
 *  only a completed session's host_authored / open_unresolved referral
 *  fields (same discipline as the page's own ThreadsRecorded component),
 *  plus whatever virtue/Secondary Loss recognition that session's own
 *  referral already made, plus a saved Unsung Heroes recognition's own
 *  fields. Never the full referral (stage_synthesis, decision_commitment,
 *  boundary_stewardship fields are withheld -- those are the next Guide's
 *  own working material, not preparation evidence), and never anything
 *  from an active/unfinished session. */
function buildEvidenceText(history: ParticipantHistory): string {
  const complete = history.sessions.filter(
    (r) =>
      (r.conversation?.status ?? r.unsungHeroesConversation?.status ?? r.session.status) === "complete"
  );
  if (complete.length === 0) return "Nothing is on record yet for this participant.";

  const blocks = complete.map((r) => {
    const lines: string[] = [];
    const when = new Date(r.session.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    lines.push(`SESSION: ${r.session.tool} (${r.session.program}) — ${when}`);

    if (r.referral) {
      const items = formatReferralFields(r.referral.from_stage, r.referral.content).filter(
        (item) => item.role === "host_authored" || item.role === "open_unresolved"
      );
      for (const item of items) {
        const value = Array.isArray(item.value) ? item.value.join("; ") : item.value;
        if (value) lines.push(`- ${item.label}: ${value}`);
      }
      const content = r.referral.content as Record<string, unknown>;
      const virtues = formatVirtueClassifications(
        content.relevantVirtues ?? content.virtuesInvolved
      );
      if (virtues.length > 0) lines.push(`- Virtues already recognized: ${virtues.join("; ")}`);
      const losses = formatSecondaryLossClassifications(
        content.secondaryLossesIdentified ?? content.significantSecondaryLosses
      );
      if (losses.length > 0) lines.push(`- Secondary Losses already recognized: ${losses.join("; ")}`);
    }

    if (r.recognition) {
      const pathLabel = r.unsungHeroesConversation ? UNSUNG_HEROES_PATH_LABEL[r.unsungHeroesConversation.path] : null;
      lines.push(`- Unsung Heroes${pathLabel ? ` (${pathLabel})` : ""}: "${r.recognition.title}"`);
      lines.push(`  Who became visible: ${r.recognition.who_became_visible}`);
      if (r.recognition.primary_virtue) lines.push(`  Virtue recognized: ${r.recognition.primary_virtue}`);
    }

    return lines.join("\n");
  });

  return blocks.join("\n\n");
}

export async function generateParticipantSnapshot(
  history: ParticipantHistory,
  guideId: string
): Promise<{ ok: true; snapshot: ParticipantSnapshot } | { ok: false; error: string }> {
  const evidence = buildEvidenceText(history);
  try {
    const client = anthropic();
    const params: any = {
      model: AVAIA_MODEL,
      max_tokens: 1536,
      system: preparationSnapshotSystemPrompt(),
      messages: [
        {
          role: "user",
          content: `Here is everything currently on record for ${history.participant.name}:\n\n${evidence}\n\nProduce the Participant Snapshot now as structured data only.`,
        },
      ],
      output_config: { format: { type: "json_schema", schema: SNAPSHOT_SCHEMA } },
    };
    const resp: any = await client.messages.create(params);
    await recordAiUsage({
      hostId: guideId,
      conversationId: null,
      feature: "preparation_snapshot",
      stage: null,
      model: resp.model,
      usage: resp.usage,
    });
    const text = (resp.content as Array<{ type: string; text?: string }>).find(
      (b) => b.type === "text"
    )?.text;
    if (!text) throw new Error("No content returned.");
    const snapshot = JSON.parse(text) as ParticipantSnapshot;
    return { ok: true, snapshot };
  } catch {
    return { ok: false, error: "Could not generate the Participant Snapshot. Please try again." };
  }
}
