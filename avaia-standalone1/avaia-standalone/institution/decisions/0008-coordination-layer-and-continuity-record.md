# Decision 0008 — The coordination layer and the Decision & Capacity Continuity Record

**Status:** Recorded, governing. These are the OWNER's decisions of 2026-10-08, made after the
coordination-layer audit. Phase 1 (coordination items) is implemented in migration `0120`. Phases 2
to 4 are approved in direction only and are **not** authorized to be built until the owner says so.

## The governing decision

> AVAIA may create and preserve a longitudinal record of a Host's expressed understanding,
> reasoning, choices, questions, and participation in consequential decisions. AVAIA does not
> independently determine or declare legal capacity or incapacity.

The record is intended to preserve what actually occurred across time. It documents participation;
it does not make a determination. AVAIA creates no generated conclusion such as "Host has
capacity", "Host lacks capacity", "competent" or "incompetent". Decision 0006 remains intact in
substance: AVAIA does not independently diagnose, determine, or declare incapacity.

It may capture: the decision being discussed; date and time; the source conversation or session;
who was present; whether the conversation was private or a Shared Room; what the Host said they
wanted, understood and reasoned; the questions the Host asked; the alternatives and consequences
the Host considered or discussed; whether the Host remained undecided or asked for more time;
whether the Host's stated position stayed consistent or changed, and, if it changed, the Host's own
explanation; what the Host wants communicated to others; and a direct link to the original source
message where possible.

## Ownership of the record

- The Host owns the record. Entries stay traceable to their original source. Prior entries are
  never silently rewritten.
- Permanent deletion is **not** built. Before any deletion or history-preservation behavior is
  implemented, the two smallest options for preserving historical integrity while respecting Host
  ownership are returned to the owner for a decision. That is a Phase 2 matter and does not block
  Phase 1.

## The coordination layer (what is decided)

- It is operational coordination inside the existing Workbook. It is not a new product, and it is
  not a new conversation protocol.
- **Delegation / ownership** uses these Host-selected states, never inferred by AI: I own this and
  will do it; I own the decision but someone else can carry it out; someone else can own this
  responsibility; this belongs with a professional; this can wait; I need help before deciding; I
  do not currently have capacity to address this.
- **Status** is Open, Waiting or Closed, with a separate `waiting_on` field (Host, Guide, family
  member, professional, other). Green/Yellow/Red is not used here; Decision 0001 remains separate.
- There is no AI-inferred capacity score of any kind.
- `kind` is `item` or `decision`. `decision` reserves a place for the continuity record; Phase 1
  does not expose it.

## Phase 1 scope (implemented)

- Adult account holders only. No Youth. No Guide-run participants without an account, until a clean
  claimed-record architecture exists.
- Host-only: no Guide, admin or service policy. No Host delete; a Host closes an item.
- A related Shared Room is a label only. Room ownership and access are not altered.
- No item change-history system.
- "Add to Coordination" starts only from the Host's own decisions and commitments, read from the
  stored referral with the same rule Keep this uses. A stage's own next-step synthesis is not a
  Host-voiced field and is not offered (Decision 0006).
- Public entry route approved: `/for-families-and-professional-teams`, working label "For Families
  & Professional Teams". It is not a separate product. Paths: Host or family enters directly; a
  professional refers a client; an organization refers a participant; all lead into the existing
  AVAIA architecture. No broader marketing copy.

## Approved in direction only (not authorized to build)

- **Phase 2:** the Decision & Capacity Continuity Record, longitudinal timeline, source-message
  linkage.
- **Phase 3:** item-specific Share With and professional handoff, with a sharing log. The secure-link
  direction is approved (hashed tokens, expiration, revocation, access logging, item-specific
  sharing); this is **not** authorization to build Phase 3.
- **Phase 4:** the Guide Coordination view and reminders.
- Shared Room content is never moved into the Host's Workbook automatically. It may be referenced or
  included only where existing ownership and permission architecture allows it, the Host authorizes
  it, and the original source stays identifiable. No new Room ownership rules; Room governance is
  not modified.
- **Guide qualifications:** the architecture is preserved so a future professional/family
  coordination qualification and an advanced/private-client qualification can be represented. No
  curriculum, pricing, continuing-education requirement, admission criteria or marketing is created.
- **Matching** remains human and Founder-controlled. No automated matching. A Host is never assigned
  merely to the next available Guide. The definitions of complex and private-client work remain open.

## Automation boundary

Human conversations remain human where AVAIA requires a Guide. Automation may support routing,
reminders, record linking, documentation, share and handoff preparation, notifications, Guide
workflow, reporting and continuity. It does not replace Guide judgment or Host choice with
autonomous agents.

## Preserved, not disturbed

The Host owns the Table; the Guide protects the Table, not the outcome; the Witness certifies
visibility; IAP, CAT and InnerCompass behavior; Workbook continuity; Shared Room governance;
Decision 0001 (Trusted Circle); existing Youth, crisis, mandatory-reporting and legal-duty policies;
certification admission rules; entitlements and membership behavior; the privacy architecture; and
Journal privacy.
