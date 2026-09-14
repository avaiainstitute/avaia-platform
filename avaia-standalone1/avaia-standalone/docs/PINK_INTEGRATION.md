---
title: Wiring thepinkshoelace.org to its new backend
status: not yet wired — this document is the missing step
---

# What this is

The Automation Blueprint build added a real backend for The Pink Shoelace
Foundation, living inside the AVAIA Supabase project and AVAIA's Next.js
app (see `supabase/migrations/0063_pink_shoelace_foundation.sql` and
`app/api/pink/*`). Nothing on thepinkshoelace.org itself was touched — its
source was not found on this machine during this build, so its HTML forms
still submit however they did before. This document is the exact,
copy-pasteable step to connect them.

# Endpoints now available

Both accept `POST` with a JSON body and `Content-Type: application/json`,
and both already send `Access-Control-Allow-Origin` for
`https://thepinkshoelace.org` (override with the `PINK_SITE_ORIGIN`
environment variable if the real domain differs or a staging domain needs
to submit too).

## `POST https://<your-avaia-domain>/api/pink/contact`

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "message": "…",
  "source": "optional — how they found the site"
}
```

Matches the site's existing general contact form (Name, Email, Message).
Saves to `pink_contact_submissions`, sends the submitter an acknowledgment,
and — only when the message reads as a partnership, media/press, or
volunteer/donate inquiry, or asks a direct question — flags it for Dorian.

As of Automation Blueprint Phase 4, a message that classifies as a
**partnership** inquiry also automatically opens a tracking record in
`pink_partnerships` (organization name defaults to the submitter's own
name until Dorian corrects it), and a message that classifies as
**volunteer/donate** interest automatically opens a tracking record in
`pink_donor_sponsor_records` (donor type left unset for Dorian to set on
review). Both records are then surfaced by the Founder Digest's existing
follow-up-due and flagged-for-action lists — see `lib/pink/linking.ts`.
Neither ever creates more than one such record per submission
(`source_contact_id` is uniquely constrained per table, migration 0071).

## `POST https://<your-avaia-domain>/api/pink/participation`

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "interestType": "wear_shoelace",
  "note": "optional",
  "honoreeName": "optional — only meaningful for honor_someone",
  "source": "optional"
}
```

`interestType` must be one of: `wear_shoelace`, `walk_alongside`,
`honor_someone`, `foundation_participation`, `other` — the same categories
the "Get Involved" page already names. Saves to
`pink_participation_interest`, acknowledges the submitter (with a plain
note that some of these programs are still being built — see below), and
flags `honor_someone`/`foundation_participation`/`other` for Dorian.

# What each form needs to change

For each existing HTML form, replace its current submit behavior with a
`fetch` to the matching endpoint above:

```html
<script>
  document.getElementById("pink-contact-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const res = await fetch("https://<your-avaia-domain>/api/pink/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.value,
        email: form.email.value,
        message: form.message.value,
      }),
    });
    if (res.ok) {
      form.hidden = true;
      document.getElementById("pink-contact-thanks").hidden = false;
    } else {
      // show an inline error — the response body has { error: "…" }
    }
  });
</script>
```

The participation form(s) follow the same pattern against
`/api/pink/participation`, with `interestType` set to whichever fixed value
matches that specific form (a "Request a Shoelace" form always sends
`wear_shoelace`, an "Honor Someone" form always sends `honor_someone`, etc.
— never a value typed by the visitor).

**This wiring step is still not done** — it requires editing
thepinkshoelace.org's own source, which lives outside this repository (see
"Who needs to do this" below). Everything on the AVAIA side described in
this document, including the Phase 4 automation above, is already live and
waiting for these two `fetch` calls to be added.

# What is genuinely not active yet (do not wire these as if they are)

- **Donations.** `pink_donor_sponsor_records` now opens automatically as a
  *tracking lead* when a contact message reads as volunteer/donate interest
  (Phase 4), but it is still not connected to Stripe or any payment
  processor, and no donation amount, tier, or pledge mechanism exists.
  thepinkshoelace.org itself currently says donations are "coming soon" —
  that remains true after this build. Do not point a donate button at
  these endpoints; there is nothing there yet to receive a payment.
- **In-person event registration.** Not built in this pass (deferred
  pending a real decision on what an "Experience" registration should look
  like — see the Automation Blueprint's Agent 8 notes).
- **Automated public content posting.** Nothing here publishes to the site
  or to social channels automatically.

# Environment variables this depends on

Already required by the rest of the app: `RESEND_API_KEY`,
`RESEND_FROM_EMAIL`. New for this integration, all optional with safe
defaults: `PINK_SITE_ORIGIN` (default `https://thepinkshoelace.org`),
`PINK_NOTIFICATION_EMAIL` (falls back to `CONTACT_NOTIFICATION_EMAIL` if
unset — if neither is set, submissions still save, they just don't trigger
an internal notification email), `PINK_PARTNERSHIP_FOLLOWUP_DAYS` (default
3), `PINK_DONOR_FOLLOWUP_DAYS` (default 5).

# Who needs to do this

Whoever has access to thepinkshoelace.org's actual source (a separate
static site, location unknown from this machine). This is the one piece of
the build that could not be completed here — everything on the AVAIA side
is ready and waiting for these two `fetch` calls to be added.
