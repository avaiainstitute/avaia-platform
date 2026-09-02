// The AVAIA Guide Toolkit's canonical tool registry — not server-only,
// since it's just static data (no secrets, no DB access) that both the
// dashboard and the participant-creation form need to render/validate
// against, and a plain object is simplest for both server and client use.
//
// This represents the *complete* canonical inventory, per the approved
// build direction. "installed" = has a working route in this app.
// "specified-not-installed" = fully specified in the existing engine/
// content but not yet wired into the Toolkit shell. "not-yet-specified" =
// named and real in AVAIA's own institutional source
// (institution/source/*.md) but has no behavioral specification anywhere
// yet -- not invented here, not blocking the build.

export type ToolKey =
  | "preparation"
  | "iap"
  | "cat"
  | "innercompass"
  | "secondary-loss"
  | "chemistry"
  | "table-formation"
  | "council"
  | "give"
  | "defying-grief"
  | "unsung-heroes"
  | "library"
  | "youth-defying-grief"
  | "youth-group";

export type ToolStatus = "installed" | "specified-not-installed" | "not-yet-specified";

export type ToolDefinition = {
  key: ToolKey;
  label: string;
  description: string;
  status: ToolStatus;
  /** Where to go to use this tool inside the Toolkit. Null when there's
   *  nothing to link to yet (specified-not-installed or not-yet-specified). */
  href: string | null;
};

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    key: "preparation",
    label: "Preparation",
    description: "Organizes what's already on record for a participant before a session -- never interprets, diagnoses, or prescribes what should happen next.",
    status: "installed",
    href: "/toolkit/preparation",
  },
  {
    key: "iap",
    label: "Individual Awareness Profile",
    description: "Creates Awareness. The same canonical IAP engine used by the public Journey.",
    status: "installed",
    // No /toolkit/iap index route exists -- a Guide starts one from the
    // Dashboard's own "Begin Individual Awareness Profile" form, or
    // continues an existing one from a Participant's own page, matching
    // cat/innercompass's identical null href below.
    href: null,
  },
  {
    key: "cat",
    label: "Conversations Across Time",
    description: "Creates Understanding. Begins as a handoff from a completed IAP session, the same referral-driven progression every Host gets.",
    status: "installed",
    href: null,
  },
  {
    key: "innercompass",
    label: "InnerCompass",
    description: "Creates Agency. Begins as a handoff from a completed CAT session.",
    status: "installed",
    href: null,
  },
  {
    key: "secondary-loss",
    label: "Secondary Loss Engine",
    description: "Why a loss can affect more than what was directly taken.",
    status: "installed",
    href: "/secondary-loss",
  },
  {
    key: "chemistry",
    label: "Chemistry of Virtue",
    description: "The 123 elements of virtue, and Virtue Formulas.",
    status: "installed",
    href: "/chemistry",
  },
  {
    key: "table-formation",
    label: "Table Formation Engine",
    description: "The structural framework for AVAIA conversations -- Host, Guide, Witness, Council, and Relationship/Virtue/Secondary Loss seats.",
    status: "not-yet-specified",
    href: null,
  },
  {
    key: "council",
    label: "Council",
    description: "Expands perspective while preserving the authority of the Host and the responsibility of the Guide. Advisory only.",
    status: "not-yet-specified",
    href: null,
  },
  {
    key: "give",
    label: "GIVE Method",
    description: "AVAIA's foundational methodology -- already documented on the public site.",
    status: "installed",
    href: "/about#give",
  },
  {
    key: "defying-grief",
    label: "Defying Grief",
    description: "AVAIA applied specifically to loss and disruption -- the same IAP/CAT/InnerCompass tools, threaded with the Audacity framing.",
    status: "installed",
    href: "/toolkit/defying-grief",
  },
  {
    key: "unsung-heroes",
    label: "Unsung Heroes",
    description: "Noticing, recognizing, and making visible quiet acts of virtue.",
    status: "installed",
    href: "/toolkit/unsung-heroes",
  },
  {
    key: "library",
    label: "Library",
    description: "Browsable AVAIA resources. Data layer and Guide read access are ported from the unmerged branch; the admin content-management UI is not installed yet.",
    status: "installed",
    href: "/toolkit/library",
  },
  {
    key: "youth-defying-grief",
    label: "Youth Defying Grief",
    description: "Guide-facilitated Youth Individual Awareness Profile, Conversations Across Time, and InnerCompass -- Defying Grief is the Youth program, not a separate add-on, so Stone-and-Ripples and Audacity framing are already layered in. Same canonical Youth engine the public /youth Journey uses, adapted by developmental band (8-11 / 12-14 / 15-17), which the Guide sets when starting a session.",
    status: "installed",
    href: "/toolkit/youth-defying-grief",
  },
  {
    key: "youth-group",
    label: "Youth Group Adaptations",
    description: "Group-format delivery of Youth conversations -- multiple participants in one session. Guide-facilitated Youth INDIVIDUAL sessions are installed separately, above; this entry is specifically about group delivery, which doesn't exist yet.",
    status: "not-yet-specified",
    href: null,
  },
];

export function toolLabel(key: ToolKey): string {
  return TOOL_REGISTRY.find((t) => t.key === key)?.label ?? key;
}
