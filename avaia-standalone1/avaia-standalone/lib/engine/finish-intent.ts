// Conservative detection of a Host typing readiness to finish directly into
// the chat, instead of clicking the website's own "I'm ready to finish" /
// "I'm ready to move forward" button. Root cause this addresses: InnerCompass
// would sometimes insert one more interpretive turn ("What does 'ready' mean
// for you right now?") before honoring an explicit finish request typed in
// the conversation -- the button always worked correctly; only the typed
// path lacked any server-side recognition that the Host had already said
// they were done. Scoped to InnerCompass only (see api/conversation/route.ts)
// since that is the specific stage the finding was reported against; IAP and
// CAT are unaffected and untouched.
//
// Deliberately conservative in both directions this session's earlier work
// established the same lesson: whole-message match only, capped length, and
// an explicit veto list for continuation phrases ("I'm finished with that
// part, but...") so a Host mid-thought is never short-circuited. A false
// negative just falls through to a normal reply (the button is always still
// there); a false positive would skip a turn the Host didn't ask to skip,
// which is the worse failure mode, so this errs toward under-triggering.

const FINISH_PATTERNS: RegExp[] = [
  /^(ok(ay)?,? )?(i think )?i'?m ready to (finish|wrap up|move forward)\.?!?$/,
  /^(ok(ay)?,? )?(i think )?i'?m (finished|done)\.?!?$/,
  /^let'?s (finish|wrap up|move forward)\.?!?$/,
  /^(i'?d like to|i want to|can we) (finish|wrap up|move forward|move on)( now)?\.?!?$/,
  /^ready to (finish|wrap up|move forward)\.?!?$/,
  /^i'?m ready( now)?\.?!?$/,
];

// Any of these present anywhere in the message vetoes a match, even if a
// pattern above would otherwise fire -- these are the strongest signals
// that "finished"/"ready" refers to something local (a topic, a thought, a
// part of the conversation), not the whole conversation.
const CONTINUATION_VETO = /\b(but|except|although|though|part|for now|with that|with this|just that|not the whole|one thing)\b/;

const MAX_LENGTH = 60;

export function isFinishIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized || normalized.length > MAX_LENGTH) return false;
  if (CONTINUATION_VETO.test(normalized)) return false;
  return FINISH_PATTERNS.some((re) => re.test(normalized));
}
