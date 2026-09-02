# Guide Preparation

## Purpose

Transform recognition into faithful participation. Prepare the Host and
Guide for meaningful conversation, strengthen continuity, deepen
understanding, and connect recognition to everyday life. The connective
tissue between IAP, CAT, InnerCompass, the Chemistry of Virtue, Secondary
Losses, Workbook reflections, recognition practices, and the AVAIA Library.

The participant is not a problem to solve. The participant is a person to
understand.

## Position

Not a fourth Journey stage. The Journey remains Awareness → Understanding →
Agency, IAP → CAT → InnerCompass. Preparation supports continuity before,
between, and around those conversations — it never replaces them, never
conducts a conversation itself, and never determines an outcome.

## Governing Principles

Preparation over analysis. Understanding over interpretation. Simplicity
over complexity. Stewardship over outcomes. Recognition over correction.
Focus on what appears most meaningful; avoid information overload. Depth
comes from faithful attention, not length — where evidence is thin, say
less rather than manufacturing content.

## Chemistry of Virtue / Secondary Loss Boundary

Preparation reuses the canonical Chemistry of Virtue (ten families, 123
elements, `lib/virtues.ts`) and the canonical Ten Secondary Losses
(`lib/institution.ts`) exactly as every other AVAIA program does — never a
separate or hand-copied version. Recognition only, never classification,
never diagnosis. A virtue or Secondary Loss is only ever named when the
evidence for it already exists in what a Host has said in a completed
session.

## The Participant Snapshot

The one generative output Preparation produces, on explicit Guide request
only, at `/toolkit/preparation/[participantId]` — a single bounded
generation, never a back-and-forth conversation:

Current Focus · What's Still Active · Strengths Visible · Growth
Opportunities · Questions Worth Revisiting · What Has Changed · Guide
Reminder

Built only from a completed session's own Host-authored words, explicitly
open threads, and virtue/Secondary Loss recognition a prior stage already
made — never from an active/unfinished session, never inventing evidence.

## Recognition Practice / Reflection Mirror

A recognition practice is never homework, an assignment, or a lesson — it
answers "what deserves this person's attention in everyday life?" Where
offered, it may be followed by "What might this reveal about the Host?" —
held as an invitation, never a conclusion about who the Host is.

## Guide Support

Preparation may help a Guide understand why a virtue or practice was
selected, connect referrals to virtues and Secondary Losses, and offer
reflection questions — always as possibilities, never a script, a
predicted outcome, or a replacement for the Guide or the Host's own
discovery. AVAIA carries the architecture; the Guide carries the
conversation.

## Reconciliation Note

The Founder's original instructions named the Journey's third movement
"Discernment" in one Guide Support reference. Current canonical AVAIA
architecture (`lib/institution.ts`'s Journey movements;
`18_DefyingGrief.md`'s Governing Movement) names it Agency — updated here
accordingly. Discernment remains correct and unchanged everywhere else as
InnerCompass's own internal discernment process, a distinct concept from
the movement's name.

## Wisdom Curation / Library

Live retrieval of approved AVAIA Library content exists
(`getLibraryEntriesForHost`, `getOrientationForSecondaryLoss` in
`lib/library-retrieval.ts` / `lib/library-orientation.ts`) and is a clean
future connection point for the Participant Snapshot. Not wired into the
Snapshot's fixed seven-field output in this pass, to keep that format
disciplined rather than adding an eighth heading.

## Scope

Individual, Guide-facing only, at `/toolkit/preparation`. Reuses the same
Guide-participant ownership model as the rest of the Guide Toolkit — a
Guide can only prepare using a participant's own record, never another
Guide's. No Host-facing surface exists. Guide-facilitated Youth remains
deferred platform-wide, and Preparation inherits that boundary: it can
never surface a Youth participant's record, because Guide-facilitated
Youth sessions cannot exist to be prepared from in the first place.
