// The AVAIA Guide Toolkit's canonical tool registry — not server-only,
// since it's just static data (no secrets, no DB access) that both the
// dashboard and the participant-creation form need to render/validate
// against, and a plain object is simplest for both server and client use.
//
// This represents the *complete* canonical inventory now, per the approved
// build direction, even though only IAP has an installed route so far.
// "installed" = has a working route in this app. "specified-not-installed"
// = fully specified in the existing engine/content but not yet wired into
// the Toolkit shell. "not-yet-specified" = named and real in AVAIA's own
// institutional source (institution/source/*.md) but has no behavioral
// specification anywhere yet -- not invented here, not blocking the build.

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
    description: "Prepares the Guide before a conversation by organizing available information. Occurs before any core conversation.",
    status: "not-yet-specified",
    href: null,
  },
  {
    key: "iap",
    label: "Individual Awareness Profile",
    description: "Creates Awareness. The same canonical IAP engine used by the public Journey.",
    status: "installed",
    href: "/toolkit/iap",
  },
  {
    key: "cat",
    label: "Conversations Across Time",
    description: "Creates Understanding.",
    status: "specified-not-installed",
    href: null,
  },
  {
    key: "innercompass",
    label: "InnerCompass",
    description: "Creates Agency.",
    status: "specified-not-installed",
    href: null,
  },
  {
    key: "secondary-loss",
    label: "Secondary Loss Engine",
    description: "Why a loss can affect more than what was directly taken.",
    status: "specified-not-installed",
    href: null,
  },
  {
    key: "chemistry",
    label: "Chemistry of Virtue",
    description: "The 123 elements of virtue, and Virtue Formulas.",
    status: "specified-not-installed",
    href: null,
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
    description: "AVAIA applied specifically to loss and disruption.",
    status: "specified-not-installed",
    href: null,
  },
  {
    key: "unsung-heroes",
    label: "Unsung Heroes",
    description: "Noticing, recognizing, and making visible quiet acts of virtue.",
    status: "specified-not-installed",
    href: null,
  },
  {
    key: "library",
    label: "Library",
    description: "Browsable AVAIA resources. A complete implementation exists on an unmerged branch, preserved as source material to port from.",
    status: "specified-not-installed",
    href: null,
  },
  {
    key: "youth-group",
    label: "Youth & Group Adaptations",
    description: "Age-appropriate and group-facilitated versions of the core conversations. A draft youth IAP adaptation exists but isn't yet integrated into the engine.",
    status: "not-yet-specified",
    href: null,
  },
];

export function toolLabel(key: ToolKey): string {
  return TOOL_REGISTRY.find((t) => t.key === key)?.label ?? key;
}
