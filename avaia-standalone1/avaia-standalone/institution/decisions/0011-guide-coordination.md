# Decision 0011 — Guide Coordination

**Status:** Recorded, governing. These are the OWNER's decisions of 2026-10-09 for Phase 4 of the coordination layer. They
build on Decisions 0008, 0009 and 0010 and change none of them. Implemented in migrations `0123` and `0124`. The feature
deploys **behind a closed launch gate** (`COORDINATION_GUIDE_ENABLED`); production opening is a separate Founder decision, and
one successful disposable end-to-end test is required first.

## What it is

A Host can give **one eligible Guide** a **time-limited, revocable** window onto the coordination items, and separately the
continuity entries, that the Host chooses. Nothing is included by default. The Guide reads a curated view and records
Guide-authored notes and follow-up marks. The Guide cannot change anything the Host owns.

Guide Coordination is **not** Share With. A Guide with coordination access does not receive a Phase 3 frozen professional
handoff. A Host may separately choose Share With for a Guide, as for any recipient. The two mechanisms are never merged.

## Access model (Option C)

A separate, explicit coordination grant. It inherits **nothing** from Guided Journey access, Toolkit access, Shared Room
participation, organization Guide relationships or any other Guide relationship. A Guide may have Journey access and still have
no coordination access.

On **every** access the database requires all of: an active certification; the `coordination_support` capability; an active,
unexpired Host grant; and the requested item or entry inside that grant's scope. Not UI gating alone.

## Capability

`coordination_support`, technically distinct from Journey facilitation. Opt-in: ordinary Certified Guides do **not** receive it.
No curriculum, pricing, CE, admission standard or marketing language is defined here.

## Scope and duration

Item-level and entry-level selection, nothing included by default. An entry is never exposed merely because its parent decision
is visible; removing an item also removes its chosen entries, so adding it back never silently re-exposes them. A Shared Room
entry and a withdrawn entry can never be included. Duration 1 to 90 days, default 30; expiry ends access; the Host may revoke
earlier; continuing access requires a new grant. No indefinite grants and no auto-renewal. Grants are for adult Hosts and adult
Guides only.

## What a Guide sees

On an item the Host included: the item's own fields, **including the people the Host named on it** (assigned and professional
names and roles), next action, due date, waiting-on, delegation, and the related decision's title if that decision is also
included. For a Phase 3 handoff only the operational fact that it happened: recipient **role**, dates, status and whether it was
viewed. Never the frozen handoff, recipient email, link, token or Share History content. Never source pointers, Room labels or
an entry's present note.

## What a Guide may do (first cut)

View; add a clearly Guide-authored note; mark follow-up completed; mark contacted a professional; mark reviewed with the Host;
mark waiting on the Host; flag an item for the Host's attention. These document Guide activity only and **never** change the
Host's status, waiting-on, next action, due date or delegation. A Guide may not change a Host decision, a Host entry,
delegation, ownership, next action, due date, waiting-on, any professional share, the grant's scope, a withdrawn state, or make
any capacity or legal conclusion. No proposal/approval workflow in this release; if wanted later it is a separate extension.

## Guide-authored records

One table (`coordination_guide_events`) holds notes and operational events, distinguished by `kind`. They are visibly labelled
Guide-authored, visible to the Host, never inserted into `coordination_entries`, never represented as the Host's words, never
part of Share With, never deleted, with authorship and database-stamped time preserved. The author Guide may withdraw their own;
the Host may mark a flag as seen. After a grant ends the Host still sees every record; the Guide no longer does.

## Notification

One email, to the Guide, when a Host successfully grants access: who gave it, until when, and where to sign in. No private
coordination content. No reminders, urgency alerts, summaries or prioritization. Revocation sends no email in this release.

## Timeline

Derived from the real grant and event records (no duplicate rows): access given, ended by the Host, ended by time, and each
Guide record. Guide-authored events are a separate kind, shown visually apart from Host-authored events.

## Administrators

No ordinary admin read or write path to Guide grants, scope, Guide records or Host coordination content. An administrator can
only grant or end the `coordination_support` capability itself.

## Host's authorization wording

**FOUNDER-APPROVED, 2026-10-09, exactly as written below.** Stored verbatim with each grant:

> I am choosing to let [Guide] see the items and entries I have selected, including the people I have named on those items, until
> [date], unless I revoke access sooner. They can record notes and follow-up marks about these items. They cannot change my
> decisions, my entries, who carries what, or anything I share. Revoking stops their access from that moment. It does not erase
> notes they have already recorded, and it does not recall anything they have already read.

## Launch gate

`COORDINATION_GUIDE_ENABLED`, exactly the lowercase string `true`; absent or anything else is closed. It is unset in production
during build and verification. Revoking is never gated.

## Not part of this decision

Proposals; Guide messaging; matching; notifications beyond the one grant email; analytics; a professional portal; any change to
IAP, CAT, InnerCompass, Shared Room governance, Trusted Circle, certification admission, entitlements, membership, or Phases 1
to 3; and the four existing defects recorded separately.
