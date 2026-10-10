import "server-only";
import { htmlToPlainText } from "@/lib/email-text";
import { guideCoordinationEmailHtml, handoffInvitationEmailHtml } from "@/lib/resend";
import type { CheckResult } from "@/lib/ops/system-checks";

// SELF-TEST FOR THE PLAIN-TEXT PART OF OUTGOING EMAIL. Simulated messages only: nothing is read from or written to the database, and nothing is
// sent. Every email carries a plain-text version beside its HTML version (an HTML-only message is a common reason legitimate mail is filed as
// spam), and the plain-text version must carry the same words and the same links, with no HTML left in it.

type Case = { name: string; ok: boolean };

function emailTextCheck(): CheckResult {
  const key = "pipeline_email_plain_text";
  const label = "Outgoing email carries a readable plain-text version";
  try {
    const cases: Case[] = [];
    const url = "https://demo.example.org/handoff/abc123_-XYZ";

    const handoff = htmlToPlainText(handoffInvitationEmailHtml({ sharedByName: "Eleanor Marsh", url, expiresOn: "October 17, 2026" }));
    cases.push({
      name: "the handoff email's plain text lost the sender, the expiry date or the link",
      ok: handoff.includes("Eleanor Marsh has shared a read-only AVAIA handoff with you.") && handoff.includes("October 17, 2026") && handoff.includes(`Open the handoff (${url})`),
    });
    cases.push({ name: "the handoff email's plain text still contains HTML", ok: !/[<>]/.test(handoff) });

    const guide = htmlToPlainText(guideCoordinationEmailHtml({ hostLabel: "Eleanor Marsh", url: "https://demo.example.org/guided-coordination", endsOn: "October 24, 2026" }));
    cases.push({
      name: "the Guide email's plain text lost who gave the access, until when, or the link",
      ok: guide.includes("Eleanor Marsh has given you access") && guide.includes("October 24, 2026") && guide.includes("https://demo.example.org/guided-coordination"),
    });
    cases.push({ name: "paragraphs were not kept apart", ok: handoff.split("\n\n").length >= 3 });

    const entities = htmlToPlainText("<p>Tom &amp; Jerry said &quot;hi&quot; &lt;ok&gt; &amp;lt;</p>");
    cases.push({ name: "characters written as entities were not turned back into text correctly", ok: entities === 'Tom & Jerry said "hi" <ok> &lt;' });
    cases.push({ name: "an empty message did not give an empty result", ok: htmlToPlainText("") === "" });
    cases.push({ name: "a link whose text is its address was written twice", ok: htmlToPlainText('<a href="https://a.example/x">https://a.example/x</a>') === "https://a.example/x" });

    const failed = cases.filter((c) => !c.ok).map((c) => c.name);
    return failed.length === 0
      ? {
          category: "quality",
          checkKey: key,
          label,
          status: "pass",
          detail:
            "Simulated messages confirm: the handoff and Guide-access emails each get a plain-text version carrying the same sender, dates and link as the HTML version, with no HTML in it; paragraphs stay apart; character entities become the characters they stand for; a link is written once as its address and once as text plus address; and an empty message stays empty.",
        }
      : { category: "quality", checkKey: key, label, status: "problem", detail: `${failed.length} case(s) broke: ${failed.join("; ")}.` };
  } catch (e) {
    return { category: "quality", checkKey: key, label, status: "problem", detail: `The self-test could not run: ${e instanceof Error ? e.message : String(e)}.` };
  }
}

export function emailTextChecks(): CheckResult[] {
  return [emailTextCheck()];
}
