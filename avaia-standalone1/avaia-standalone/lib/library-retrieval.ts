import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeVirtueClassifications } from "./engine/referral-provenance";
import type { Program } from "./engine/prompts";
import { VIRTUE_FAMILIES, type VirtueFamilyKey } from "./virtues";
import { SECONDARY_LOSSES } from "./institution";
import type { LibraryEntry } from "./library";

// Deterministic, explainable Phase 1 retrieval -- reuses the frozen
// referral engine's own already-validated output (normalizeVirtueClassifications
// from lib/engine/referral-provenance.ts, untouched), adding no new
// inference of its own. Only three signal types are used, per the approved
// scope: validated Secondary Losses, validated virtues, and program
// context. Host-authored free text (anchorStatements, questionsWorthCarrying,
// desiredDirection, nextStep, etc.) is deliberately NOT read here -- there
// is no explicit, deterministic connection from that prose to a specific
// Library Entry in this build, and guessing one from keywords is exactly
// the kind of semantic interpretation Phase 1 rules out. If fewer than 3
// entries legitimately match, the result falls back to a broad, unpersonalized
// set rather than stretch to fill 5.
//
// Note: referrals.content stores a matched virtue's family as its display
// name (e.g. "Positive Attitude", via normalizeVirtueClassifications),
// while library_entries.virtues stores the family as its short key (e.g.
// "positive-attitude", via lib/library.ts's validateVirtueTag). Both are
// the existing, already-established representations for those two
// different tables -- this file is simply the first place both are read
// together, so the name->key conversion happens once, here.

export type RetrievalReason =
  | { type: "secondary_loss"; value: string }
  | { type: "virtue"; family: VirtueFamilyKey; element: string | null }
  | { type: "program"; value: Program };

export type RetrievedEntry = {
  entry: LibraryEntry;
  /** Empty in broad (unpersonalized) mode -- never fabricated. */
  reasons: RetrievalReason[];
};

export type RetrievalResult = {
  mode: "personalized" | "broad";
  entries: RetrievedEntry[];
  /** The Host's own Journey this retrieval actually drew from, if a valid
   *  one was given -- present even when mode ends up "broad" (not enough
   *  matched), so the caller can say so honestly rather than silently
   *  falling back. */
  journeyId: string | null;
};

function scoreEntry(
  entry: LibraryEntry,
  matchedLossCategories: Set<string>,
  matchedVirtueFamilies: Map<VirtueFamilyKey, Set<string | null>>,
  program: Program | null
): RetrievedEntry {
  const reasons: RetrievalReason[] = [];

  for (const loss of entry.secondary_losses) {
    if (matchedLossCategories.has(loss)) reasons.push({ type: "secondary_loss", value: loss });
  }

  const reasonedFamilies = new Set<VirtueFamilyKey>();
  for (const v of entry.virtues) {
    if (reasonedFamilies.has(v.family)) continue;
    const elements = matchedVirtueFamilies.get(v.family);
    if (!elements) continue;
    reasonedFamilies.add(v.family);
    const matchedElement = v.element && elements.has(v.element) ? v.element : null;
    reasons.push({ type: "virtue", family: v.family, element: matchedElement });
  }

  // 'general' is the default for nearly every Journey and nearly every
  // entry -- matching on it wouldn't personalize anything, just relabel
  // the default case as "personalized." Only 'defying-grief' is actually
  // distinguishing.
  if (program === "defying-grief" && entry.programs.includes(program)) {
    reasons.push({ type: "program", value: program });
  }

  return { entry, reasons };
}

/** Deterministic Phase 1 retrieval for a signed-in Host. `journeyId` is
 *  optional and, when given, is re-verified as actually belonging to this
 *  Host before anything is drawn from it (RLS backs this up regardless,
 *  but the check keeps the "why this appeared" trail honest even for a
 *  stale or tampered URL). Never reads anything beyond the three approved
 *  signal types. */
export async function getLibraryEntriesForHost(
  supabase: SupabaseClient,
  hostId: string,
  journeyId: string | null,
  viewerIsMember: boolean
): Promise<RetrievalResult> {
  let validJourneyId: string | null = null;
  let program: Program | null = null;
  const matchedLossCategories = new Set<string>();
  const matchedVirtueFamilies = new Map<VirtueFamilyKey, Set<string | null>>();

  if (journeyId) {
    const { data: journey } = await supabase
      .from("journeys")
      .select("id, program")
      .eq("id", journeyId)
      .eq("host_id", hostId)
      .maybeSingle();

    if (journey) {
      validJourneyId = journey.id as string;
      program = journey.program as Program;

      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .eq("journey_id", journeyId)
        .eq("host_id", hostId);
      const convoIds = ((convos as { id: string }[]) ?? []).map((c) => c.id);

      if (convoIds.length > 0) {
        const { data: referralRows } = await supabase
          .from("referrals")
          .select("content")
          .eq("host_id", hostId)
          .in("conversation_id", convoIds);

        for (const r of (referralRows as { content: Record<string, unknown> }[]) ?? []) {
          const content = r.content ?? {};

          // Secondary Losses: IAP writes secondaryLossesIdentified, CAT
          // writes significantSecondaryLosses. A legacy free-prose string
          // (pre-dating the validated {category, description} shape) is
          // only used if it happens to exactly match one of the ten
          // canonical categories -- never guessed at, matching
          // isValidSecondaryLoss's own existing discipline.
          for (const key of ["secondaryLossesIdentified", "significantSecondaryLosses"]) {
            const raw = content[key];
            if (!Array.isArray(raw)) continue;
            for (const item of raw) {
              const category =
                typeof item === "string"
                  ? item
                  : item && typeof item === "object"
                    ? (item as { category?: unknown }).category
                    : undefined;
              if (typeof category !== "string") continue;
              const canonical = SECONDARY_LOSSES.find(
                (s) => s.loss.toLowerCase() === category.trim().toLowerCase()
              );
              if (canonical) matchedLossCategories.add(canonical.loss);
            }
          }

          // Virtues: CAT writes relevantVirtues, InnerCompass writes
          // virtuesInvolved -- both already validated and normalized by
          // the frozen engine's own normalizeVirtueClassifications.
          for (const key of ["relevantVirtues", "virtuesInvolved"]) {
            for (const c of normalizeVirtueClassifications(content[key])) {
              const familyKey = VIRTUE_FAMILIES.find((f) => f.name === c.family)?.key;
              if (!familyKey) continue;
              if (!matchedVirtueFamilies.has(familyKey)) matchedVirtueFamilies.set(familyKey, new Set());
              matchedVirtueFamilies.get(familyKey)!.add(c.element ?? null);
            }
          }
        }
      }
    }
  }

  const { data: publishedData } = await supabase
    .from("library_entries")
    .select("*")
    .eq("status", "published")
    .limit(500);
  // Same visibility filter as lib/library-search.ts -- applied once here,
  // before scoring, so a member-only entry can never surface in either
  // personalized or broad results for a non-member.
  const published = ((publishedData as LibraryEntry[]) ?? []).filter(
    (e) => viewerIsMember || e.visibility === "public"
  );

  const hasSignal =
    matchedLossCategories.size > 0 || matchedVirtueFamilies.size > 0 || program === "defying-grief";
  let mode: "personalized" | "broad" = "broad";
  let entries: RetrievedEntry[] = [];

  if (hasSignal) {
    const scored = published
      .map((entry) => scoreEntry(entry, matchedLossCategories, matchedVirtueFamilies, program))
      .filter((r) => r.reasons.length > 0)
      .sort(
        (a, b) =>
          b.reasons.length - a.reasons.length || b.entry.created_at.localeCompare(a.entry.created_at)
      );
    // Not enough legitimate evidence to personalize safely -- fall back
    // below rather than stretch a thin match into a "front hall."
    if (scored.length >= 3) {
      mode = "personalized";
      entries = scored.slice(0, 5);
    }
  }

  if (entries.length === 0) {
    mode = "broad";
    entries = [...published]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map((entry) => ({ entry, reasons: [] }));
  }

  return { mode, entries, journeyId: validJourneyId };
}

/** Plain-language rendering of one reason, traceable directly back to the
 *  persisted signal it came from -- never a fabricated explanation. */
export function formatReason(reason: RetrievalReason): string {
  if (reason.type === "secondary_loss") return `Secondary Loss: ${reason.value}`;
  if (reason.type === "virtue") {
    const family = VIRTUE_FAMILIES.find((f) => f.key === reason.family)?.name ?? reason.family;
    return reason.element ? `${family} — ${reason.element}` : family;
  }
  return reason.value === "defying-grief" ? "Defying Grief" : "Your Journey";
}
