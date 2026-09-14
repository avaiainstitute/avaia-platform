import "server-only";
import { anthropic } from "@/lib/engine/anthropic";
import { AVAIA_MODEL } from "@/lib/engine/prompts";
import { recordAiUsage } from "@/lib/engine/ai-usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { EXPERIENCE_TYPES } from "@/lib/experiences-agent";

// Outbound-research capability for Agents 3 (Partnership), 4 (Donor &
// Sponsor), and 8 (Programs & Experiences), Automation Blueprint Round 3.
//
// This is a genuinely new pattern for this codebase: every existing
// Anthropic call here drives a Host-facing conversation or extracts
// structured content from one. This module instead asks the model to use
// its server-side web_search tool to find real, publicly-discoverable
// organizations that plausibly fit Pink Shoelace's or AVAIA's already-
// established work, and to describe (never contact) them.
//
// Deliberately conservative by design, per Dorian's own instruction:
//  - Read-only. Nothing in this file ever sends an email, a message, or
//    any outbound contact to a prospect. It only ever writes a row into
//    one of this app's own prospect tables (see migration 0072).
//  - Capped. Each run asks for at most maxResults new candidates and the
//    caller (the cron route, or an admin's manual "Run research now")
//    decides how often that happens -- nothing here loops or self-
//    schedules more work.
//  - Deduplicated. Existing organization names/websites are always passed
//    back to the model as "already known, do not repeat," and the insert
//    itself is guarded by the unique indexes from migration 0072 as a
//    second, structural line of defense (23505 is treated as an expected,
//    silent no-op, exactly like lib/pink/linking.ts already does).
//  - Never invents a program, a package, or a relationship that doesn't
//    exist -- the prompts below describe only the real, established work
//    (the exact language Dorian himself used in his instruction, or
//    already-published copy from lib/institution.ts and the site itself),
//    and the model is instructed to describe a prospect's plausible fit
//    in its own words, not to assert a relationship that hasn't happened.

export type ProspectVertical = "partnership" | "donor" | "program";

export type ProspectCandidate = {
  organizationName: string;
  organizationType: string | null;
  location: string | null;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  whyRelevant: string;
  relevance: "pink" | "avaia" | "both" | null;
  relevantExperience: string | null;
  researchNotes: string | null;
};

const PARTNERSHIP_ORG_TYPES = [
  "school", "business", "hospice", "funeral_home", "community_organization",
  "youth_organization", "conference", "employer", "other",
] as const;

const DONOR_ORG_TYPES = [
  "individual", "business", "foundation", "community_organization", "employer", "other",
] as const;

const PROGRAM_ORG_TYPES = [
  "school", "conference", "business", "faith_community", "community_organization", "other",
] as const;

// Reuses Agent 8's own established Experience list (lib/experiences-agent.ts)
// rather than a second copy, so the two can never drift apart.
const EXPERIENCE_VALUES = EXPERIENCE_TYPES;

function systemPromptFor(vertical: ProspectVertical): string {
  const shared = `You are a careful research assistant. You use web search to find REAL,
publicly-discoverable organizations -- never invent an organization, a
person, a URL, or a fact. If you cannot verify something with search
results, leave that field null rather than guessing. You never suggest
contacting anyone; you only describe why an organization might plausibly
be a good fit for future outreach that a human will decide on and carry
out themselves.

Respond with ONLY a JSON array (no prose, no markdown fences) of objects
matching this shape:
{
  "organizationName": string,
  "organizationType": string | null,
  "location": string | null (city/state or region),
  "website": string | null,
  "contactName": string | null (a real named public contact if genuinely findable, e.g. a listed director or community-outreach contact -- otherwise null),
  "contactEmail": string | null (only a real, publicly-listed general/organizational email -- never a guess),
  "contactPhone": string | null,
  "whyRelevant": string (one or two sentences, your own words, on why this organization may be a good fit),
  "researchNotes": string | null (anything else useful: what you found, sources, uncertainty)
}
Return an empty array [] if you cannot find genuinely good, verifiable candidates -- never pad the list with weak or invented matches.`;

  if (vertical === "partnership") {
    return `${shared}

Also include "relevance": "pink" | "avaia" | "both" on each object.

Find legitimate partnership/collaboration prospects for two related
organizations:

The Pink Shoelace Foundation -- a grief-support nonprofit ("People walking
with people. Different losses. Different grief.") that supports people who
are grieving and those who want to walk alongside them, including a
"wear a pink shoelace" awareness effort.

AVAIA -- a grief education and restoration institute whose flagship
program is Defying Grief, with Workshops & Speaking as an established
form of educational outreach.

organizationType must be one of: ${PARTNERSHIP_ORG_TYPES.join(", ")}.

Look specifically among: schools, businesses, hospices, funeral homes,
community organizations, youth organizations, conferences, and employers
that would plausibly welcome a grief-support or grief-education
partnership (e.g. an employee-wellness contact at a business, a
bereavement or family-support program at a hospice or funeral home, a
school counseling department, a relevant conference).`;
  }

  if (vertical === "donor") {
    return `${shared}

Find legitimate potential sponsors/supporters that appear genuinely
aligned with The Pink Shoelace Foundation's mission: grief support and
"people walking with people" through different kinds of loss. Do not
suggest anyone already known to be a national grief-charity competitor in
a way that would be an odd fit; prefer local/regional businesses,
community foundations, employers with visible community-giving programs,
and organizations whose own public material shows an interest in grief,
loss, mental health, or community support.

organizationType must be one of: ${DONOR_ORG_TYPES.join(", ")}.`;
  }

  return `${shared}

Also include "relevantExperience": one of ${EXPERIENCE_VALUES.join(", ")} on
each object, whichever established AVAIA offering seems like the best fit:
 - defying_grief: AVAIA's flagship grief education and restoration program; can be facilitated live, through a workshop, or through a school/organization program.
 - youth_defying_grief: the youth-adapted version, delivered to a group, workshop, or school program, always requiring guardian permission.
 - workshops_and_speaking: general educational outreach introducing AVAIA's principles and method (a presentation/talk format).
 - chemistry_of_virtue: a guided reflection on the virtues and qualities that remain after loss.
 - unsung_heroes: a recognition-focused offering.
 - view_from_above: a perspective-taking offering.

Find organizations, conferences, schools, businesses, and communities
where one of these established AVAIA offerings could plausibly fit --
for example a school district's counseling or wellness department, a
grief/hospice conference, a faith community's care ministry, or a
business's employee-wellness program. Do not invent a package or price;
you are only identifying a plausible setting.

organizationType must be one of: ${PROGRAM_ORG_TYPES.join(", ")}.`;
}

async function callResearch(
  vertical: ProspectVertical,
  excludeNames: string[],
  maxResults: number
): Promise<ProspectCandidate[]> {
  const client = anthropic();
  const exclude = excludeNames.length
    ? `\n\nThese organizations are already known/tracked -- do not repeat them: ${excludeNames.slice(0, 200).join("; ")}.`
    : "";

  let resp: any;
  try {
    resp = await client.messages.create({
      model: AVAIA_MODEL,
      max_tokens: 4000,
      system: systemPromptFor(vertical),
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 } as any],
      messages: [
        {
          role: "user",
          content: `Find up to ${maxResults} strong, real, verifiable candidates.${exclude}`,
        },
      ],
    });
  } catch (e) {
    console.error(`Prospect research (${vertical}): Anthropic call failed:`, e);
    return [];
  }

  try {
    await recordAiUsage({
      hostId: null,
      conversationId: null,
      feature: "prospect_research",
      stage: null,
      model: resp.model,
      usage: resp.usage,
    });
  } catch {
    // best-effort telemetry only, never blocks the research result itself
  }

  const textBlocks = (resp.content as Array<{ type: string; text?: string }>).filter(
    (b) => b.type === "text" && b.text
  );
  const lastText = textBlocks[textBlocks.length - 1]?.text?.trim();
  if (!lastText) return [];

  try {
    // The model is instructed to return only JSON, but strip a stray code
    // fence defensively rather than fail the whole run on formatting.
    const cleaned = lastText.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p.organizationName === "string" && p.organizationName.trim())
      .map((p) => ({
        organizationName: String(p.organizationName).trim().slice(0, 300),
        organizationType: p.organizationType ? String(p.organizationType).trim() : null,
        location: p.location ? String(p.location).trim().slice(0, 300) : null,
        website: p.website ? String(p.website).trim().slice(0, 500) : null,
        contactName: p.contactName ? String(p.contactName).trim().slice(0, 300) : null,
        contactEmail: p.contactEmail ? String(p.contactEmail).trim().slice(0, 300) : null,
        contactPhone: p.contactPhone ? String(p.contactPhone).trim().slice(0, 100) : null,
        whyRelevant: p.whyRelevant ? String(p.whyRelevant).trim().slice(0, 2000) : "",
        relevance:
          p.relevance === "pink" || p.relevance === "avaia" || p.relevance === "both" ? p.relevance : null,
        relevantExperience: EXPERIENCE_VALUES.includes(p.relevantExperience)
          ? p.relevantExperience
          : null,
        researchNotes: p.researchNotes ? String(p.researchNotes).trim().slice(0, 3000) : null,
      }));
  } catch (e) {
    console.error(`Prospect research (${vertical}): failed to parse model output as JSON:`, e);
    return [];
  }
}

type InsertResult = { inserted: number; skipped: number };

async function insertCandidates(
  table: "pink_partnership_prospects" | "pink_donor_prospects" | "avaia_experience_prospects",
  vertical: ProspectVertical,
  candidates: ProspectCandidate[]
): Promise<InsertResult> {
  const admin = createAdminClient();
  let inserted = 0;
  let skipped = 0;

  for (const c of candidates) {
    if (!c.organizationName || !c.whyRelevant) {
      skipped++;
      continue;
    }
    const row: Record<string, unknown> = {
      organization_name: c.organizationName,
      organization_type: c.organizationType,
      location: c.location,
      website: c.website,
      contact_name: c.contactName,
      contact_email: c.contactEmail,
      contact_phone: c.contactPhone,
      why_relevant: c.whyRelevant,
      research_notes: c.researchNotes,
      discovered_via: "outbound_research",
    };
    if (vertical === "partnership") row.relevance = c.relevance ?? "both";
    if (vertical === "program") row.relevant_experience = c.relevantExperience;

    const { error } = await admin.from(table).insert(row);
    if (error) {
      if (error.code === "23505") {
        // Already tracked (dedup index caught it) -- expected, silent no-op,
        // same posture as lib/pink/linking.ts.
        skipped++;
      } else {
        console.error(`Prospect research: failed to insert into ${table}:`, error.message);
        skipped++;
      }
    } else {
      inserted++;
    }
  }

  return { inserted, skipped };
}

/** Runs outbound research for one vertical: fetches currently-known
 *  organization names (so the model doesn't waste a search re-finding
 *  them), asks the model to find up to maxResults new ones, and inserts
 *  whatever survives validation + dedup. Always best-effort -- a failure
 *  in one vertical never should block another; callers run each vertical
 *  in its own try/catch (see app/api/cron/prospect-research/route.ts and
 *  the admin "Run research now" actions). */
export async function runProspectResearch(
  vertical: ProspectVertical,
  maxResults: number = 5
): Promise<InsertResult> {
  const admin = createAdminClient();
  const table =
    vertical === "partnership"
      ? "pink_partnership_prospects"
      : vertical === "donor"
        ? "pink_donor_prospects"
        : "avaia_experience_prospects";

  const { data: existing } = await admin.from(table).select("organization_name").limit(500);
  const excludeNames = (existing ?? []).map((r: { organization_name: string }) => r.organization_name);

  const candidates = await callResearch(vertical, excludeNames, maxResults);
  if (!candidates.length) return { inserted: 0, skipped: 0 };

  return insertCandidates(table, vertical, candidates);
}
