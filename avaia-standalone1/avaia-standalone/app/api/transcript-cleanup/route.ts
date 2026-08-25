import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/engine/anthropic";
import { AVAIA_MODEL } from "@/lib/engine/prompts";
import { recordAiUsage } from "@/lib/engine/ai-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately separate from every conversational tool -- this is a
// transcription-formatting utility, not a Guide, and carries no persona,
// method, or behavioral instructions of its own. Called by MicButton
// (components/MicButton.tsx) once dictation ends, before the Host reviews
// and sends -- never touches conversation/referral/recognition content or
// any conversational prompt.
const SYSTEM_PROMPT = `You are a strict transcription-formatting utility. You receive raw speech-to-text output from a browser's speech recognizer. Your ONLY job is to fix mechanical transcription artifacts, in this priority order:

1. Remove punctuation the recognizer inserted in the wrong place -- most commonly a period or question mark that splits one continuous spoken thought into unnatural short fragments.
2. Restore sensible sentence and paragraph boundaries where they are reliably inferable from the wording itself.
3. Fix capitalization to match those boundaries (start of sentences, "I").
4. Correct an obvious homophone transcription error ONLY when context makes the intended word unambiguous (hear/here, their/there/they're, to/too/two, its/it's, and similarly clear-cut cases). If there is any genuine ambiguity about which word was meant, leave the original word exactly as transcribed.

You must NOT, under any circumstances:
- Rewrite grammar, syntax, or sentence structure.
- Remove or smooth over filler words, repetitions, false starts, slang, or incomplete thoughts -- these are part of how the person actually spoke and must survive untouched.
- Change word choice for any reason other than rule 4 above.
- Add any content, or remove any content beyond the wrongly-placed punctuation itself.
- Make the speaker sound more formal, articulate, grammatically correct, or polished than they actually spoke.

The standard: the output should read like a faithful transcript of what was actually said, not like someone edited what they meant. When in doubt about any single change, leave that part exactly as transcribed.

Return ONLY the corrected transcript text. No preamble, no explanation, no quotation marks around it, nothing else.`;

/** A legitimate cleanup pass (punctuation, capitalization, a 1:1 homophone
 *  swap) never meaningfully changes word count. If the model's output
 *  drifts outside a tight band of the original, something went wrong --
 *  content was added or dropped -- and the safest thing is to fall back to
 *  the untouched original rather than trust an out-of-band response. */
function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const text: string = (body?.text ?? "").toString();
  if (!text.trim()) return NextResponse.json({ error: "Missing text." }, { status: 400 });
  // A single dictated turn is never anywhere near this long; a request this
  // large isn't a real dictation, so skip the model call rather than pay
  // for it.
  if (text.length > 8000) return NextResponse.json({ cleaned: text });

  try {
    const client = anthropic();
    const resp = await client.messages.create({
      model: AVAIA_MODEL,
      max_tokens: 2048,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });
    await recordAiUsage({
      hostId: user.id,
      conversationId: null,
      feature: "transcript_cleanup",
      stage: null,
      model: resp.model,
      usage: resp.usage,
    });
    const block = resp.content.find((b) => b.type === "text");
    const cleaned = block && "text" in block ? block.text.trim() : "";
    if (!cleaned) return NextResponse.json({ cleaned: text });

    const before = wordCount(text);
    const after = wordCount(cleaned);
    if (before > 0 && (after < before * 0.85 || after > before * 1.15)) {
      // Suspicious drift -- content was likely added or dropped. Fall back
      // to the original rather than trust it.
      return NextResponse.json({ cleaned: text });
    }

    return NextResponse.json({ cleaned });
  } catch (e) {
    console.error("AVAIA transcript cleanup error:", e);
    return NextResponse.json({ cleaned: text });
  }
}
