import type { DevelopmentalBand } from "./engine/prompts";

// Plain text constants only -- deliberately NOT server-only, so client
// components (the /youth band selector, the Guide-facilitated start forms)
// can render the correct band's assent text as the Host or Guide picks a
// band, before any server round-trip. lib/guardian-consent.ts (server-only)
// re-exports these for its own use when writing a guardian_consents row,
// so there is exactly one copy of this text, never two drifting ones.

export const GUARDIAN_DISCLOSURE_VERSION = "youth-guardian-2026-09";

/** Shown to a guardian (or read to them by a Guide) before they consent.
 *  Covers, per AVAIA's governing decision: what AVAIA / Youth Defying
 *  Grief is, its nature and purpose, who facilitates it, what
 *  participation generally involves, privacy/safeguarding boundaries, and
 *  what the guardian will and will not have access to. */
export const GUARDIAN_DISCLOSURE_TEXT = `AVAIA is a guided, virtue-centered conversation platform. Youth Defying Grief is an AVAIA program that helps young people (ages 8-17) recognize and understand a loss or disruption in their life -- not limited to death, but also divorce, a move, a friendship ending, or another significant change. It is not therapy, counseling, or crisis care.

Participation is facilitated by an AVAIA-certified Guide, either one-on-one or, where offered, as part of a small group session, and may include a private, individual AVAIA conversation (Individual Awareness Profile, Conversations Across Time, and InnerCompass) that only your child can access.

Your child owns their own story. Guardian consent authorizes their participation -- it does not give you, a school, or any organization access to what your child says privately to their Guide or to AVAIA. Your child decides what, if anything, they choose to share with you afterward.

If a genuine safety concern arises -- such as a risk of harm -- AVAIA and the Guide will act on it the same way any responsible adult would, which may include involving you or another trusted adult. Short of that narrow exception, your child's private reflections remain private.

You may withdraw this consent at any time by contacting the Guide or AVAIA directly.`;

/** Shown to (or read with) the Youth Host themselves, at their own
 *  developmental register -- a separate thing from guardian consent.
 *  Guardian consent authorizes participation; this is the Youth Host's
 *  own understanding of what that participation actually involves,
 *  what's private, what's shared, and what choices remain theirs. Written
 *  to each band's actual reading level, not a single document with a
 *  reading-level disclaimer -- the youngest band should never need to
 *  parse adult privacy language to understand it. */
export const YOUTH_ASSENT_TEXT: Record<DevelopmentalBand, string> = {
  "8-11": `Here's what's happening: You get to talk with a caring adult (called a Guide) about things that have changed in your life. This is not school, and it's not a test -- there's no wrong answer.

Some of what you say is just between you and your Guide. If you're with a group, you never have to say things out loud if you don't want to -- you can just think about them quietly, or write them down for yourself.

You can say "I don't want to talk about that" any time, about anything, and that's okay. You can also stop at any point.

Your grown-up said it's okay for you to be here today. But what you say stays yours -- your Guide won't tell your grown-up everything you talk about, unless something is going on that means a grown-up needs to help keep you safe.`,

  "12-14": `What this is: a space to talk honestly about something that's changed or been hard in your life, with a Guide trained to listen without judging you or trying to fix you.

What's private: anything you say in a one-on-one conversation with AVAIA stays private. It isn't automatically shared with your parent/guardian, your school, or anyone else -- not because anyone's hiding anything, but because it's yours.

What's shared: if you're in a group, some parts happen together with everyone else -- but you never have to say something out loud that you don't want to. You can keep it to yourself and just think it through privately instead.

Your choices: you can skip any question, decline any activity, or stop the whole thing at any time -- no explanation needed. Your parent/guardian already said you could be here, but that agreement doesn't give them a window into what you say privately.

One exception: if something you share points to a real safety concern, your Guide may need to involve a trusted adult -- the same as any responsible adult would do. That's narrow and specific, not a general rule.`,

  "15-17": `What this is: Youth Defying Grief is a guided space to work through a loss or disruption in your life -- your own pace, your own terms, with a certified Guide.

Privacy: what you say in a private AVAIA conversation is private. It is not shared with your parent/guardian, your school, or a sponsoring organization just because they arranged for you to participate -- consent to participate is not the same as access to your story.

Group settings: if part of this happens in a group, you're never required to disclose anything out loud. Staying quiet, reflecting privately, or simply not sharing is a complete and legitimate way to participate.

Your choices: you can decline any question or activity, and stop at any point, without needing to justify it.

The one real exception: if something you share indicates a genuine safety concern -- risk of harm to you or someone else -- your Guide may need to act on it, which could include involving another adult. That's a narrow, specific exception, not a loophole for general oversight.`,
};
