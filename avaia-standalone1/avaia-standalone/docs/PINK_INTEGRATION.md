---
title: thepinkshoelace.org backend integration
status: contact form wired and live; no participation form exists on the site yet
---

# What this is

The Automation Blueprint build added a real backend for The Pink Shoelace
Foundation, living inside the AVAIA Supabase project and AVAIA's Next.js
app (see `supabase/migrations/0063_pink_shoelace_foundation.sql` and
`app/api/pink/*`). thepinkshoelace.org's own source (a separate static
site, repo `avaiainstitute/pink-shoelace-foundation`, branch `main`,
served via Cloudflare) was connected in this pass and its one real form
was wired to the AVAIA backend. This document reflects the current,
actually-wired state -- not a plan.

# Endpoints available

Both accept `POST` with a JSON body and `Content-Type: application/json`.

CORS is handled by `lib/pink/cors.ts`, shared by both routes. thepinkshoelace.org
serves identical content from both `https://thepinkshoelace.org` and
`https://www.thepinkshoelace.org` with no redirect between them, so both
are allowed by default and the response reflects whichever of the two the
request actually came from (`Access-Control-Allow-Origin` is not a single
static value). Override the allowlist with the `PINK_SITE_ORIGIN`
environment variable (comma-separated origins) if a staging domain needs
to submit too -- not set today, so the code default (both origins above)
is what's live.

## `POST https://www.avaiainstitute.com/api/pink/contact`

**Must be `www.avaiainstitute.com`, not the bare `avaiainstitute.com` apex.**
The apex 308-redirects every method, including the CORS preflight
`OPTIONS` request, to the `www` host -- a redirected preflight is treated
as a failure by browsers, so a form posting to the apex would silently
never complete. The wired contact form uses the `www` host for exactly
this reason.

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "message": "...",
  "source": "optional -- how they found the site"
}
```

Matches the site's existing general contact form (Name, Email, Message).
Saves to `pink_contact_submissions`, sends the submitter an acknowledgment,
and -- only when the message reads as a partnership, media/press, or
volunteer/donate inquiry, or asks a direct question -- flags it for Dorian.

As of Automation Blueprint Phase 4, a message that classifies as a
**partnership** inquiry also automatically opens a tracking record in
`pink_partnerships` (organization name defaults to the submitter's own
name until Dorian corrects it), and a message that classifies as
**volunteer/donate** interest automatically opens a tracking record in
`pink_donor_sponsor_records` (donor type left unset for Dorian to set on
review). Both records are then surfaced by the Founder Digest's existing
follow-up-due and flagged-for-action lists -- see `lib/pink/linking.ts`.
Neither ever creates more than one such record per submission
(`source_contact_id` is uniquely constrained per table, migration 0071).

## `POST https://www.avaiainstitute.com/api/pink/participation`

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "interestType": "wear_shoelace",
  "note": "optional",
  "honoreeName": "optional -- only meaningful for honor_someone",
  "source": "optional"
}
```

`interestType` must be one of: `wear_shoelace`, `walk_alongside`,
`honor_someone`, `foundation_participation`, `other`. Saves to
`pink_participation_interest`, acknowledges the submitter, and flags
`honor_someone`/`foundation_participation`/`other` for Dorian.

**This endpoint has no form pointed at it yet, and that is correct as of
this pass -- not a gap to close.** thepinkshoelace.org's own
`get-involved.html` explicitly states these participation features
("supporting someone directly, joining Foundation activities,
volunteering, and donating") are "not yet available," and that "nothing
here should be read as an offer to accept funds or register participation
until they are built and announced." `partnerships.html` and
`walk-with-someone.html` likewise route every inquiry to the general
contact form rather than a dedicated form. The endpoint is built, tested,
and ready; wiring it is a Dorian-driven site-content decision (what the
participation forms should look like, when to announce them), not an
engineering gap.

# What was wired on thepinkshoelace.org's side

`contact.html` (the site's only real form) previously posted to
`https://formsubmit.co/ajax/contact@thepinkshoelace.org` via `FormData`.
It now posts JSON to `https://www.avaiainstitute.com/api/pink/contact`,
keeping the exact same success/error UI toggle (`#contact-form-success`,
`#contact-form-error`) and element IDs -- no visual or copy changes:

```html
<script>
(function () {
  var form = document.getElementById('contact-form');
  var successBox = document.getElementById('contact-form-success');
  var errorMsg = document.getElementById('contact-form-error');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorMsg.hidden = true;
    var submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    fetch('https://www.avaiainstitute.com/api/pink/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.value,
        email: form.email.value,
        message: form.message.value,
        source: 'thepinkshoelace.org/contact.html',
      }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Request failed');
        return res.json().catch(function () { return {}; });
      })
      .then(function (data) {
        if (data && data.success === false) throw new Error(data.message || 'Request failed');
        form.hidden = true;
        successBox.hidden = false;
      })
      .catch(function () {
        errorMsg.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send';
      });
  });
})();
</script>
```

If a participation form is built later, follow the same pattern against
`/api/pink/participation`, with `interestType` set to whichever fixed
value matches that specific form (a "Request a Shoelace" form always
sends `wear_shoelace`, an "Honor Someone" form always sends
`honor_someone`, etc. -- never a value typed by the visitor).

# What is genuinely not active yet (do not wire these as if they are)

- **Donations.** `pink_donor_sponsor_records` now opens automatically as a
  *tracking lead* when a contact message reads as volunteer/donate interest
  (Phase 4), but it is still not connected to Stripe or any payment
  processor, and no donation amount, tier, or pledge mechanism exists.
  thepinkshoelace.org itself currently says donations are "coming soon" --
  that remains true after this pass. Do not point a donate button at these
  endpoints; there is nothing there yet to receive a payment.
- **In-person event registration.** Not built in this pass (deferred
  pending a real decision on what an "Experience" registration should look
  like -- see the Automation Blueprint's Agent 8 notes).
- **Automated public content posting.** Nothing here publishes to the site
  or to social channels automatically.

# Environment variables this depends on

Already required by the rest of the app: `RESEND_API_KEY`,
`RESEND_FROM_EMAIL`. For this integration, all optional with safe
defaults: `PINK_SITE_ORIGIN` (default: both `https://thepinkshoelace.org`
and `https://www.thepinkshoelace.org`; not set in Vercel today, so the
code default is what's live), `PINK_NOTIFICATION_EMAIL` (falls back to
`CONTACT_NOTIFICATION_EMAIL` if unset -- if neither is set, submissions
still save, they just don't trigger an internal notification email),
`PINK_PARTNERSHIP_FOLLOWUP_DAYS` (default 3), `PINK_DONOR_FOLLOWUP_DAYS`
(default 5).

# Repositories involved

- `avaiainstitute/avaia-platform` (branch `defying-grief-v2`) -- the
  backend: API routes, database, classification, linking, Founder Digest.
- `avaiainstitute/pink-shoelace-foundation` (branch `main`) -- the static
  site itself, deployed via Cloudflare to `thepinkshoelace.org` and
  `www.thepinkshoelace.org`. `contact.html` in this repo is what was
  edited to wire the form.
