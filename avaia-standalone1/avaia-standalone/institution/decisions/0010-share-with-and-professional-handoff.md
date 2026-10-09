# Decision 0010 — Share With and the professional handoff

**Status:** Recorded, governing. These are the OWNER's decisions of 2026-10-08 for Phase 3 of the
coordination layer. They build on Decisions 0008 and 0009 and change neither. Implemented in migration
`0122`. Phase 4 (the Guide Coordination view) is **not** authorized. Outward sending is **gated** until
the end-to-end flow has been exercised (see "Launch gate").

## What a share is

A Host shares **one coordination item** with **one named person** as a **frozen** copy of exactly what the
Host approved at the moment of authorization. The recipient reads that copy on a read-only page, with no
account. Later changes to the Workbook, the item, a continuity entry, a Host note, a position or a
delegation never change a share that already exists. The frozen copy stays in Share History.

Scope defaults: one item per share; sharing may begin from any coordination item; continuity entries are
available only when the parent item is a decision; the purpose is required; the Host controls the name the
recipient sees; nothing is pre-selected; nothing is AI-selected.

## The authorization statement

Used exactly as written, with only the three blanks filled in. No additional professional-disclaimer
language is added to it.

> I am choosing to share the exact content shown above with [name] ([role]) at [email]. I understand that
> this is a read-only copy of what I selected as it stands today. Later changes to my Workbook will not
> change this copy. Access will remain available until [date] unless I revoke it earlier. Revoking access
> stops future access but does not recall anything the recipient has already read, copied, saved, or
> printed.

The statement is stored with the share, so what the Host authorized survives any later change to wording.

## The recipient page footer

The existing approved AVAIA disclaimer wording (no new disclaimer is invented), and the governing
statement of Decision 0008, verbatim. No additional capacity interpretation is added.

## Shared Room content

For Phase 3, Shared Room entries are **excluded from outward sharing**. Phase 2 may preserve the Host's
own Room words in the Host's continuity record, but sending those words outside AVAIA is a separate
governance question that is **not** solved here. The exclusion is enforced in the database. It may be
revisited after the Shared Room / Witness rule is explicitly reconciled.

## Secure link

A 192-bit random token; only its SHA-256 is stored (computed inside the database when the link is
opened); no account; read-only; default lifetime 14 days, maximum 30; no non-expiring links; the Host may
revoke at any time; no IP address is stored; no second factor by default; **click-to-open** before any
content is shown or any view is counted; an invalid, expired and revoked link all return the same generic
unavailable page; `noindex`; `no-store`; `Referrer-Policy: no-referrer`; the existing global anti-framing
protection.

**There is no "extend expiration".** If access must continue after it ends, the Host creates a new share,
based on their selections at that time. This preserves the integrity of frozen copies.

## What the recipient sees, and does not

The recipient sees only the frozen content the Host approved. Never: the full Workbook, the Journey, the
Journal, unrelated coordination items, unrelated continuity entries, AI replies, other people's words, or
live source records. An entry's "present note" (which can name other Room participants) is never shared.

## Professional response

Not built: messaging, comments, recipient accounts, a professional portal, uploads, collaboration tools.
The recipient experience is read-only. The Host may give their own "how to reach me", and may, during the
share flow, mark the coordination item **Waiting** on the recipient (using the existing Waiting and
`waiting_on` fields). That is sufficient for Phase 3.

## Share History and the timeline

The Host sees, per share: recipient, role, email, what was shared (the frozen copy), authorized date,
expiration, Active / Expired / Revoked, email status, first viewed, last viewed, view count, and a revoke
action while active. Share rows are never deleted. If an included entry is later withdrawn, the frozen
copy is unchanged, Share History says the share includes an entry that was later withdrawn, and future
shares cannot include it. The timeline derives "Shared with [recipient]", "First viewed", "Access revoked"
and "Access expired" from the share's own timestamps; there is no separate timeline table.

## Data and security

One new table, `coordination_shares`, with no child table. `payload` is the authoritative frozen copy;
`item_id` keeps the Host-side relationship; `entry_ids` records which entries contributed but never makes
the recipient dependent on live content. There is no delete policy. The Host can read their own shares and
may revoke their own active shares; the Host cannot directly create a (forged) share. Recipients have no
table access: they reach data only through narrow `SECURITY DEFINER` functions, following the guardian
consent pattern. The service role is used only for the verified share insert and the email-status update.

## Email

Sent through the existing `sendEmail` chokepoint. Subject: "[Name] has shared something with you through
AVAIA." The body contains only: who shared it, that it is a read-only AVAIA handoff, the expiration date,
the secure link, and the instruction to ignore it if unexpected. It contains no decision title, purpose,
excerpt or other substantive content.

## Launch gate

The build deploys, but actual external sending stays gated by an environment switch,
`COORDINATION_SHARING_ENABLED`, which must be exactly `true` to open the Share button and the share flow.
No launch-management system is created. Before it is enabled broadly, one successful end-to-end adult Host
test is required: Host creates a share, previews the exact content, authorizes, the email sends, the
recipient opens the link, the view is logged, the Host sees Share History, the Host revokes, and the
recipient can no longer access it. No test records are created in the Founder's personal Workbook.

## Not part of this decision

Phase 4; any change to IAP, CAT, InnerCompass, the Journal, Trusted Circle, Shared Room governance, the
existing `shared_access` or `ShareButton`, certification, entitlements or membership; a professional
portal; messaging; and the four existing defects recorded separately.
