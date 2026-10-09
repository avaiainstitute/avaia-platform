# Decision 0009 — The continuity record: withdraw, never erase

**Status:** Recorded, governing. These are the OWNER's decisions of 2026-10-08 for Phase 2 of the
coordination layer. They build on Decision 0008 and change none of it. Implemented in migration
`0121`. Phase 3 (Share With, professional handoff) and Phase 4 (Guide Coordination view) are **not**
authorized.

## History: Option A, withdraw, never erase

The Decision & Capacity Continuity Record is intended to preserve a trustworthy longitudinal history.
A Host may withdraw an entry from active use, but the underlying historical entry is **not** permanently
erased.

When an entry is withdrawn:

- the original entry, its source reference, its original `occurred_at` and the time it was added are
  all preserved; `withdrawn_at` is recorded;
- it leaves active views, will be excluded from future Share With packages and from future Guide
  operational views, and the Host may restore it later;
- the timeline shows it as withdrawn and never presents it as an active entry.

There is no delete policy and no `erased_at`. Professional shares delivered in a later phase will
remain historically logged as sent; that behavior is not solved here.

## The governing statement

The record page shows this verbatim, and no additional capacity interpretation is added anywhere:

> AVAIA may create and preserve a longitudinal record of a Host's expressed understanding,
> reasoning, choices, questions, and participation in consequential decisions. AVAIA does not
> independently determine or declare legal capacity or incapacity.

## What the record is

- The parent is a coordination item with `kind = 'decision'`. `coordination_items` is unchanged.
- Entries (`coordination_entries`) preserve: `source_kind`, `occurred_at` (the source's own
  timestamp), the verbatim excerpt where applicable, the Host's own note, source pointers,
  `created_at` (when it was added, kept separately), and `withdrawn_at`. There is no AI-generated
  interpretation of any entry.
- **Sources.** A conversation message: the Host selects one of their own messages; the browser
  sends only its id; the server re-reads the original and builds the stored excerpt from it (whole
  message in the first version; no excerpt-range selection yet). A referral field: approved, always
  labelled "From your referral", never presented as a verbatim conversation message, and resolved
  with the existing `referralItemText` rule. A Shared Room message: approved, only when the Host
  selects it, only the Host's own words, through the existing seated-participant access path; the
  Room source and its timestamp are preserved. A note the Host writes.
- Other participants' statements are not part of this record. Room ownership and governance are not
  altered and no new Room-sharing policy is created.
- **Who was present.** A private AVAIA conversation: "You and AVAIA." A Shared Room: a snapshot of
  the participants the Room's own seat records show as seated at that moment. An invited person is
  not treated as present merely because they had access.
- **Position.** AVAIA never compares entries or decides that a Host changed their mind. The
  Host-selected values are `wanted`, `position_consistent` and `position_changed`; for a change the
  Host may write their own explanation, which AVAIA never generates.
- **Timeline.** Built at read time from real records: the coordination item created, the entries
  (withdrawn ones flagged), and the item's current closed state. There is no timeline table, and no
  event is duplicated. Phase 3 handoffs may later join it.

## Integrity (in the database, not only the application)

A Host's browser may directly insert only a Host note. Every source-backed entry is written by the
server after it re-reads the source, and the database re-verifies it again (the excerpt really comes
from that source, it is the Host's own words, and the source's own timestamp is stored). An entry is
never rewritten; only `withdrawn_at` can change. Writes are limited to adult accounts. Source
pointers are plain ids with no foreign key, so the reference to the original source survives even if
the source record is later removed. RLS is Host-only: no Guide policy, no admin policy, no delete
policy.

## Not part of this decision

Phase 3 and Phase 4; Guide access of any kind; Share With and professional handoff; erasure; excerpt
ranges; the four existing defects the owner asked to keep recorded separately.
