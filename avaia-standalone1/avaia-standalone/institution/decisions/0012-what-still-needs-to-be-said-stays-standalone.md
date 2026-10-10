# Decision 0012 — What Still Needs to Be Said stays standalone

**Status:** Recorded, governing. Founder decision, 2026-10-10. Nothing was built for this decision; it records and protects what already exists.

## The rule

**What Still Needs to Be Said is kept standalone for now.** It is not connected to the Journey (IAP, CAT, InnerCompass), the Workbook, the
Chemistry of Virtue, the Secondary Losses, Defying Grief, Unsung Heroes, the Library, Coordination, or any other system. The separation is
intentional, not an unfinished integration.

## What is true in the product (verified 2026-10-10)

* Its own tables (`unsaid_conversations`, `unsaid_messages`), its own engine (`lib/engine/unsaid.ts`), its own prompt, and its own endpoint
  (`/api/unsaid/message`). Migration `0060_unsaid.sql` states the intent: "fully separate from the IAP/CAT/InnerCompass Journey and from
  Unsung Heroes."
* No other feature reads or writes those tables or calls that engine. It does not appear in the Workbook, in sharing, in Coordination, or in
  the Guide Toolkit's tool list.
* Its instructions tell the AI it "is not IAP, CAT, InnerCompass, Unsung Heroes, or any other AVAIA Journey stage, and it never becomes one,"
  and not to introduce Chemistry of Virtue, Secondary Losses, referrals or Journey language.
* The conversation screen says it is private to the person and not shared with a Guide, family, or anyone else.
* No visible wording implies an integration. The public page and the menu link describe a private space only.

## What would change this

Only a later explicit Founder decision. Until then, do not link it to, display it in, or feed it into any other system, and do not rewrite it to
look integrated.
