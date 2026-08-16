// Conservative, server-side detection of a Host indicating -- in ordinary
// typed language, not the "I'm ready to move forward" button -- that they
// want to end the current stage and receive its referral/handoff. Used by
// /api/conversation to route straight to the same generateReferral() the
// button calls, uniformly for IAP, CAT, and InnerCompass.
//
// This performs a real server-side action (ending a stage, generating and
// storing a referral, advancing to the next conversation), so a false
// positive is materially worse than a false negative: ending a stage the
// Host didn't ask to end is a real loss, while missing a genuine request
// just falls through to a normal reply -- the button is always still
// there, and the Host can simply ask again more plainly. Every design
// choice here follows from that asymmetry.
//
// Approach: split the message into sentences and match each sentence
// against a small set of fixed shapes, rather than scanning the whole
// message for keywords. Most negative cases found in review are excluded
// because they simply don't fit any of these shapes -- not because a veto
// caught them after the fact. Two exceptions:
// - "I'm ready to move forward"/"move on" describes the Host's life, a
//   decision, or a relationship far more often than it describes this
//   website's stage transition. It is never a trigger on its own; only
//   when the sentence itself names the conversation/handoff directly.
// - A referral/summary request's real phrasing varies too much to fully
//   anchor ("Please provide a referral." vs. "Will you please put
//   together a referral for me so that I can move on?"), so it's matched
//   as a contained clause and protected by CONDITIONAL_VETO instead --
//   "Can you give me a referral after we talk about one more thing?" must
//   not trigger merely because the clause appears in the sentence.

function splitSentences(message: string): string[] {
  return message
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Applied to whatever sentence matched a pattern below, regardless of
// category -- defense in depth, not the primary mechanism (the anchored
// patterns already exclude most of this on their own).
const CONTINUATION_VETO =
  /\b(but|except|although|though|part|for now|with that|with this|just that|not the whole|one thing)\b/i;

// A trigger phrase inside a conditional or future clause ("when I'm ready
// to finish", "after we talk about one more thing") describes a later
// moment, not this one.
const CONDITIONAL_VETO = /\b(after|before|once|until|when|if)\b/i;

function isVetoed(sentence: string): boolean {
  return CONTINUATION_VETO.test(sentence) || CONDITIONAL_VETO.test(sentence);
}

// Whole-sentence shapes only (optional leading filler / trailing
// punctuation). Deliberately excludes bare "I'm ready" / "I'm ready now"
// -- ordinary conversational answers that could occur anywhere in any
// stage, not a request to end one.
const READY_FINISH_PATTERNS: RegExp[] = [
  /^(ok(ay)?,? )?(i think )?i'?m ready to (finish|wrap up)[.!]?$/,
  /^(ok(ay)?,? )?(i think )?i'?m (finished|done)[.!]?$/,
  /^let'?s (finish|wrap up)[.!]?$/,
  /^can we (finish|wrap up)[.!?]?$/,
  /^(i'?d like to|i want to) (finish|wrap up)( now)?[.!]?$/,
];

const CAPACITY_PATTERNS: RegExp[] = [
  /^(i think )?i'?m at (my )?capacity( for this conversation)?[.!]?$/,
  /^(i think )?i'?ve reached (my )?capacity[.!]?$/,
];

// Only the two phrasings clearly about the whole conversation, not a
// subject within it. "I don't have anything else to add" and "That's all
// I have" are deliberately absent -- common answers to a single question,
// not conversation-level statements. They never trigger, alone or
// otherwise; if the Host also states a real completion signal elsewhere
// in the same message, that signal triggers on its own regardless.
const DONE_ENOUGH_PATTERNS: RegExp[] = [
  /^(i think )?(that'?s|thats) enough( for today)?[.!]?$/,
  /^i think we'?re done[.!]?$/,
];

// See file header -- "ready to move forward" alone must never trigger.
// Only fires when the sentence itself names the conversation/handoff.
const MOVE_FORWARD_PATTERNS: RegExp[] = [
  /^(ok(ay)?,? )?(i think )?i'?m ready to move (forward|on) (with (the|my) referral|to (the )?next (conversation|stage))[.!]?$/,
  /^(i'?d like to|i want to) move (forward|on) to (the )?next (conversation|stage)[.!]?$/,
];

const REFERRAL_REQUEST_PATTERN =
  /(please |will you |can you |could you )?(provide|give|produce|write|put together)( me)? (a |the |my )?referral\b/i;

// "Can you refer me to a therapist/counselor" is realistic language this
// app could receive (AVAIA is explicitly not therapy or crisis care) and
// must not be mistaken for a request for the AVAIA Standard Referral.
const PROFESSIONAL_REFERRAL_VETO = /referral\s+(to|for)\s+(a|an|someone|some)\b/i;

function matchesAny(sentence: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(sentence));
}

export function isFinishIntent(message: string): boolean {
  const sentences = splitSentences(message.trim().toLowerCase());
  for (const sentence of sentences) {
    if (isVetoed(sentence)) continue;
    if (matchesAny(sentence, READY_FINISH_PATTERNS)) return true;
    if (matchesAny(sentence, CAPACITY_PATTERNS)) return true;
    if (matchesAny(sentence, DONE_ENOUGH_PATTERNS)) return true;
    if (matchesAny(sentence, MOVE_FORWARD_PATTERNS)) return true;
    if (REFERRAL_REQUEST_PATTERN.test(sentence) && !PROFESSIONAL_REFERRAL_VETO.test(sentence)) {
      return true;
    }
  }
  return false;
}
