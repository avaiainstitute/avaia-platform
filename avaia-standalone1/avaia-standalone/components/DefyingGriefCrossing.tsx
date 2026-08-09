import Link from "next/link";
import type { Stage } from "@/lib/engine/prompts";
import { CAT_GPT_URL, INNERCOMPASS_GPT_URL } from "@/lib/defying-grief";

/**
 * The crossing screen shown once a referral has come home from the previous
 * stage's workshop and the next stage's placeholder conversation is waiting
 * (see the generalized receiving endpoint at
 * app/api/gpt-actions/iap-referral/route.ts). Purely presentational — the
 * buttons below just open the next stage's real GPT directly; the website
 * never hosts the conversation itself for any stage of Defying Grief.
 */
export default function DefyingGriefCrossing({
  stage,
  roomTitle,
}: {
  stage: Stage;
  roomTitle: string | null;
}) {
  if (stage === "cat") {
    return (
      <div className="mt-8">
        <p className="label mb-2">Your room has a name</p>

        {roomTitle && (
          <div className="mt-4 rounded-lg border border-rule border-l-2 border-l-[#c1502e] bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
            <p className="font-sans text-xs uppercase tracking-wide text-muted">
              Room Identity — what emerged from your own words
            </p>
            <p className="mt-1 font-serif text-xl text-ink">&ldquo;{roomTitle}&rdquo;</p>
          </div>
        )}

        <p className="mt-6 text-lg text-muted">
          That&rsquo;s not AVAIA&rsquo;s name for what you carry. It&rsquo;s the name that came
          from what you said.
        </p>
        <p className="mt-4 text-lg text-muted">
          From here, the conversation changes shape. This is{" "}
          <span className="text-ink">Conversations Across Time — The Audacity of Grief</span>. It
          moves slower, and it asks harder questions. Somewhere in it, you may notice something
          that isn&rsquo;t sadness and isn&rsquo;t strength exactly — a stubbornness in you that
          kept showing up anyway. That&rsquo;s audacity. You don&rsquo;t have to name it. It will
          be there whether you do or not.
        </p>
        <p className="mt-4 text-lg text-muted">
          This is usually where <span className="text-ink">the audacity to love again</span>{" "}
          first makes itself known — quietly, often as its own kind of grief.
        </p>
        <div className="mt-8">
          <Link
            href={CAT_GPT_URL}
            className="inline-block rounded-md bg-[#c1502e] px-5 py-2.5 font-sans text-sm font-semibold text-[#0c0503] transition-shadow hover:shadow-[0_0_24px_rgba(193,80,46,0.4)]"
          >
            Enter the Room
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted">
          This opens Conversations Across Time in ChatGPT — a new tab, not this site.
        </p>
      </div>
    );
  }

  // stage === "innercompass"
  return (
    <div className="mt-8">
      <p className="label mb-2">What you&rsquo;ve carried this far</p>
      <h2 className="font-serif text-3xl text-ink">The Audacity of Happiness</h2>
      <p className="mt-4 text-lg text-ink">
        You have been recognized. Nothing here required you to be resolved — only witnessed.
      </p>
      <p className="mt-4 text-lg text-muted">
        What&rsquo;s ahead is different again. InnerCompass is where understanding starts to
        become direction — not a decision about grief, but a decision about the life still in
        front of you. People rarely arrive here the same way; some feel ready, most don&rsquo;t,
        and both are fine reasons to keep going.
      </p>
      <p className="mt-6 text-ink">
        Some audacities worth naming for yourself before you begin — not to answer, just to carry
        in with you:
      </p>
      <ul className="mt-4 space-y-3">
        {[
          "The audacity to hope, even without evidence it's warranted.",
          "The audacity to dream something for yourself again.",
          "The audacity to laugh, without it meaning you've forgotten.",
          "The audacity to build a life that still matters, on the other side of this.",
        ].map((line) => (
          <li key={line} className="flex gap-3 font-serif text-lg text-ink">
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e8845a]" />
            {line}
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Link
          href={INNERCOMPASS_GPT_URL}
          className="inline-block rounded-md bg-[#c1502e] px-5 py-2.5 font-sans text-sm font-semibold text-[#0c0503] transition-shadow hover:shadow-[0_0_24px_rgba(193,80,46,0.4)]"
        >
          Keep Going
        </Link>
      </div>
      <p className="mt-3 text-xs text-muted">
        This opens InnerCompass in ChatGPT — a new tab, not this site.
      </p>
    </div>
  );
}
