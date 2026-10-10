# AVAIA Demonstration: setup and operation

A controlled demonstration of the real AVAIA system using one synthetic Host (Eleanor Marsh), one synthetic Guide (Nora Castellane) and a
synthetic attorney recipient. Production is never involved. **This file contains no secrets, passwords, keys or tokens**; only the names of
settings and where to find the real values.

## What exists

| Piece | Where | Notes |
|---|---|---|
| Demo database | Supabase project `avaia-demo` (same organization and region as Production) | Built from history, verified identical to Production. See `DEMO_DATABASE_BUILD_NOTES.md`. |
| Demo site | Vercel project `avaia-demo` (same repository, Production Branch `defying-grief-v2`) | Auto-follows every push to that branch. Root Directory `avaia-standalone1/avaia-standalone`. |
| Hostname | `demo.avaiainstitute.com` | Cloudflare DNS (DNS only, not proxied): a CNAME `demo` to the target Vercel shows, plus the TXT record `_vercel` Vercel asks for. |
| Demo accounts | In the demo project only | A Host, a Guide (both carry the `founder_test` marker, neither is an admin). The attorney has no account. |
| Reset | `https://demo.avaiainstitute.com/demo-reset` | One button. Exists only where `DEMO_RESET_PASSPHRASE` is set. |

## Settings (names only; values live in each service)

**Supabase `avaia-demo`:** email sign-in on; "Allow new users to sign up" OFF; Site URL and redirect URL are the demo hostname; no custom SMTP;
no GitHub integration; no Vercel integration. Users are created by hand in Authentication, Users, with "Auto Confirm User" ticked.

**Vercel `avaia-demo` environment variables, SET:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
(use the project's legacy anon and service_role keys), `NEXT_PUBLIC_SITE_URL` (the demo hostname; set before the first build because the code
falls back to the Production address if it is missing), `RESEND_API_KEY` (a key created for the demo in the existing Resend account),
`RESEND_FROM_EMAIL`, `COORDINATION_SHARING_ENABLED=true`, `COORDINATION_GUIDE_ENABLED=true`, `DEMO_RESET_PASSPHRASE` (Sensitive).

**Deliberately NOT set:** `CRON_SECRET` (scheduled jobs then reject their own calls), every `STRIPE_*` variable, `ANTHROPIC_API_KEY`,
`CONTACT_NOTIFICATION_EMAIL`, `FOUNDER_DIGEST_EMAIL`, `GUIDE_OPS_NOTIFICATION_EMAIL`, the GPT OAuth variables, and the tuning variables.
`/api/health` therefore reports `ok:false` on the demo with exactly those variables listed. That is expected.

**Email:** the only emails ever sent are the Share With email and the Guide-access email, to the two synthetic addresses used for the demo.
Gmail may file them in spam; create a filter that never sends those addresses to spam. `avaiainstitute.com` also has a DMARC record
(`p=none`) to help deliverability.

## Building the database from scratch (only if the demo project is ever recreated)

1. Create the Supabase project with the settings above (Enable Data API on; "Automatically expose new tables" on; "Enable automatic RLS" off).
2. `sh supabase/demo/make_demo_bundles.sh <empty folder>` writes the nine bundles.
3. In the SQL editor, run `bundle_01_of_09.sql` through `bundle_09_of_09.sql`, one per new empty tab, in order. Stop at the first real error.
   If a whole bundle fails with a "relation ... does not exist" naming a word that only appears inside quoted text, split that bundle by file
   and run the pieces in order (this happened once, with bundle 2).
4. Run `supabase/demo/bundle_supplement_gpt_handoff_sessions.sql`, then `supabase/demo/demo_align_with_production.sql`.
5. Run `demo_schema_parity_check.sql` (all PASS) and `demo_snapshot_fingerprint.sql`; the fingerprint must equal Production's.
6. Create the two users, then reset (below).

Do not use the Supabase CLI, do not run `migration repair`, and do not touch `supabase_migrations.schema_migrations`.

## Operating the demo

- **Reset (before and after every presentation):** open `/demo-reset`, type the passphrase, click **Reset the demo**, and check that every row
  says PASS. The "Check the demo" button re-checks without changing anything.
- **Fallback if the page is ever unavailable:** run `supabase/demo/demo_reset_and_seed.sql`, then `supabase/demo/demo_baseline_check.sql`, in the
  demo project's SQL editor. The two do the same job. If either is changed, change the other: `lib/demo/demo-reset.ts` holds the page's copy.
- **The walkthrough:** `DEMO_PRESENTER_SCRIPT.md` (full), `DEMO_DAY_CARD.md` (one page).
- **Sign in** with bookmarks that carry a destination: `/sign-in?from=/workbook` for the Host and `/sign-in?from=/guided-coordination` for the
  Guide. Plain sign-in lands on the Journey page, which is not part of the story.

## Safety model

- The demo is a separate project and database; its data never appears in Production reporting, the real Guide list, or the real digest.
- The reset page is "not found" wherever its passphrase variable is unset (Production), and the reset refuses to run unless the database holds
  exactly the two demo accounts. It only touches those two accounts' rows.
- Everything is synthetic. The Journey conversations are pre-written demonstration text, not live AI output; say so at the start of every
  presentation (the approved wording is in the script).

## Files

`supabase/demo/`: `make_demo_bundles.sh`, `bundle_supplement_gpt_handoff_sessions.sql`, `demo_align_with_production.sql`,
`demo_schema_parity_check.sql`, `demo_snapshot_fingerprint.sql`, `demo_reset_and_seed.sql`, `demo_baseline_check.sql`.
`docs/demo/`: this file, `DEMO_DATABASE_BUILD_NOTES.md`, `DEMO_DESIGN_PACKAGE.md`, `DEMO_PRESENTER_SCRIPT.md`, `DEMO_DAY_CARD.md`.
Code: `lib/demo/demo-reset.ts`, `app/demo-reset/page.tsx`.

## Verification record (2026-10-10)

Verified live on `demo.avaiainstitute.com`:
- Database structure identical to Production (fingerprint, counts, row level security on every table).
- Share With: the attorney email arrived (in spam), the handoff page opened with a frozen read-only copy, and the Host's item showed the share as active and viewed.
- Guide Coordination: the Host granted the Guide access to chosen items; the Guide saw only those; the Guide recorded a note; the Host's page showed it in a separate Guide-authored area.
- Sign-in returns a person to Guided Coordination or Coordination when they were sent to sign in from there (live on Production and the demo).
- The reset page ran and returned the baseline: "Ready: every check passes", 13 PASS, 0 FAIL, and no share, Guide access or Guide note remained.

NOT re-run through the demo screens: the Host's **"End their access"** click and the Guide's loss of access immediately afterwards. A reset had already cleared the grant before the test could be done, so the Guide's empty list on that day proved the reset, not the End action. The rule itself (a revoked grant refuses the Guide, and the Guide's notes stay on record) was proven at database level during the Guide Coordination build (migrations 0123 and 0124) with real test accounts. Re-run the click-through once before relying on it in front of an audience: grant access, confirm the Guide sees it, end it, confirm the Guide's list is empty, and confirm the Guide's note is still on the Host's item.

## Email deliverability record (2026-10-10)

The Share With email first landed in spam. Causes addressed: (1) every AVAIA email was sent HTML-only, with no plain-text part; `sendEmail` now adds a plain-text version generated from the HTML (same words, links written out) and, only if `RESEND_REPLY_TO` is set, a reply-to address (commit `5aca307`; self-test registered in System Checks); (2) `avaiainstitute.com` had no DMARC record; `v=DMARC1; p=none; rua=mailto:<an address you read>` was added in Cloudflare DNS. The approved wording of the two emails was not changed. After both changes the two demo emails sent by the `/demo-reset` test button (commit `62ca287`) both arrived in the inbox. This is evidence, not a guarantee for other recipients: Gmail also weighs sender reputation, which only builds over time.
