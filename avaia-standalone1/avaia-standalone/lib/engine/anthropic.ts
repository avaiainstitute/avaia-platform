import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Server-only Anthropic client. The key never reaches the browser. */
export function anthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

/**
 * Crisis safety net — a conservative keyword pre-check on the Host's message.
 * This is a backstop that logs the event for oversight and lets the UI surface
 * resources; the AI's own system prompt (SHARED_GUARDRAILS) is instructed to
 * step out of the method and provide 988/911/741741 when it detects risk. We
 * favor recall here — a false positive just shows a calm resource note.
 */
const CRISIS_PATTERNS: RegExp[] = [
  /\bkill(?:ing)?\s+my\s?self\b/i,
  /\bkill\s+myself\b/i,
  /\bend(?:ing)?\s+(?:my|it)\s+(?:life|all)\b/i,
  /\b(?:want|going|plan(?:ning)?)\s+to\s+die\b/i,
  /\bi\s+(?:want|wish)\s+(?:to\s+)?(?:be\s+dead|die)\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bself[-\s]?harm\b/i,
  /\b(?:hurt|harm|cut)(?:ing)?\s+my\s?self\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bbetter\s+off\s+dead\b/i,
  /\bhurt\s+(?:someone|somebody|him|her|them|people)\b/i,
];

export function detectCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}
