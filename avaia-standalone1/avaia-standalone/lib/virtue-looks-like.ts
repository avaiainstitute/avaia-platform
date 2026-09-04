import type { VirtueFamilyKey } from "@/lib/virtues";

// AVAIA Chemistry of Virtue -- "what this can look like in ordinary
// life," one set of illustrative expressions per Virtue FAMILY (never
// per individual element, and never prescriptive). This is deliberately
// separate from lib/virtues.ts's own VIRTUE_FAMILIES/VIRTUES arrays,
// which are the immutable official table ("do not make changes") --
// nothing here alters a canonical name or definition; this is AVAIA's
// own supplementary illustrative material, written once, reused
// everywhere a "how does this show up" moment is needed (the Digital
// Chemistry Kit at /chemistry, and originally authored for the ten View
// From Above classes, which import this exact same export rather than
// keeping a second copy -- see lib/view-from-above.ts).
//
// Governing rule, same as everywhere else Chemistry appears: every
// person already carries the full table. These are examples of what a
// family's elements can look like when awake, in different people, in
// different situations -- never a diagnosis, a personality type, or a
// claim that a given moment requires this specific family.

export const VIRTUE_FAMILY_LOOKS_LIKE: Record<VirtueFamilyKey, string[]> = {
  gratitude: [
    "Noticing one true, good thing and letting it stand on its own, without adding “but” to the end of the sentence.",
    "Being able to say “I don't know what the point is yet” without treating that as a failure.",
    "Finding meaning that's being built now, even though it wasn't there before.",
  ],
  humility: [
    "Saying “I don't know” out loud, sincerely, instead of defending a position out of habit.",
    "Being willing to actually look at a belief again, without being obligated to abandon it.",
    "Staying honest in the harder, uncertain middle, instead of rushing to either extreme.",
  ],
  "positive-attitude": [
    "Naming what you actually wanted underneath a lost plan, not just the plan itself.",
    "Taking one small, real step toward a new possibility, without needing the whole path mapped first.",
    "Letting hope and honest grief for what didn't happen sit in the same sentence.",
  ],
  "hard-work": [
    "Completing one small task on purpose, as evidence you can trust your own follow-through.",
    "Separating a role that was lost from your underlying capacity to act, which the loss didn't take.",
    "Choosing a next action sized to what feels safely doable, not to what feels impressive.",
  ],
  fortitude: [
    "Naming which feeling is actually loudest -- fear, guilt, shame, doubt -- instead of one undifferentiated bad feeling.",
    "Building a boundary that makes a hard decision safer to make, without waiting for the feeling to disappear first.",
    "Deciding with the feeling present, not despite pretending it isn't there.",
  ],
  wisdom: [
    "Separating belonging to a place from belonging in a broader sense -- to people, to a role, to your own story.",
    "Letting discernment about a hard question take real time, rather than forcing a quick answer.",
    "Noticing small, unexpected clarity, even before the fuller picture is visible.",
  ],
  justice: [
    "Naming your own experience of a relationship honestly, without needing to prove the other person wrong.",
    "Respecting another person's perspective even while naming that something feels unbalanced.",
    "Asking for something specific and small, rather than staying silently resentful.",
  ],
  "self-control": [
    "Writing two honest lists side by side -- what I can't control, what I can -- and acting only from the second.",
    "Participating fully in something you can't control the outcome of, rather than withdrawing entirely.",
    "Governing your own response and attention, without pretending the feeling isn't there.",
  ],
  integrity: [
    "Naming a value a role let you express (patience, love, responsibility) and recognizing it's still yours, without the role.",
    "Acting from a value that has nothing to do with any title, and noticing that it's still fully you.",
    "Giving yourself real time to answer a hard question about yourself, rather than forcing a quick reinvention.",
  ],
  love: [
    "Holding continuing connection to someone no longer present alongside real, new connection to people who are.",
    "Reaching out and naming, plainly, that a connection matters to you.",
    "Recognizing that an attachment that's changed or ended doesn't retroactively become unreal.",
  ],
};
