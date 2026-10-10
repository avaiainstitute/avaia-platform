# AVAIA Demonstration Experience, design package (as approved)

> This is the design as it was approved on 2026-10-09. What was actually built, and where it differs (a one-click reset page was added; the hostname and accounts are final), is in `docs/demo/DEMO_SETUP_AND_OPERATION.md`.

Original status line: design only when written (2026-10-09).

All "verified" statements below come from reading the production code in this repository today. Items marked UNVERIFIED are things I could not confirm without building.

---

## 0. The finding that shapes everything

The Host's "choose a Guide" list is not a page query. It is a database function, `list_eligible_coordination_guides` (called from `lib/ops/coordination-guide.ts:66`), which returns every Guide who holds an active certification and the `coordination_support` authorization. Today that list is empty, which is why production says "No Guide is available for coordination support yet."

Guide Coordination cannot be demonstrated without such a Guide. In Production that Guide would be a fake person holding a real-looking row in `guide_certifications` and `guide_platform_authorizations`. Consequences:

1. Every real Host who opens "Give a Guide access" would be offered the fake Guide.
2. The fake Guide would be counted in certified-Guide figures and Guide Operations, which is a misrepresentation risk if an investor ever sees those numbers.
3. A fake Host and Guide would be evaluated by the daily digest, Host/Participant Operations and Guide Operations alongside real people.

So the safe answer is a **dedicated demo environment** (section 5), not a marker inside Production. A marker in Production would need new code in a permission-bearing database function, which you told me not to change without a genuine need.

---

## 1. Recommended synthetic Host scenario

**Eleanor Marsh, 63. Her father Walter, 86, fell in September. Should he stay in his house?**

Realistic, not melodramatic, and every professional audience recognizes it. The presenting issue is one sentence ("Should Dad sell the house?"). Underneath it:

- Walter's legal authority has not been confirmed (power of attorney in place but nobody has checked who can act).
- Eleanor is the only adult child nearby; her brother Paul lives four hours away and wants the house sold now.
- Walter's tax filing and an October estimated payment are due.
- Eleanor's own capacity has changed: she is now doing overnight care and cannot also carry the finances. She says so in her own words. AVAIA assesses nobody's capacity; every capacity statement is Eleanor's, selected by her.
- Continuity matters: her position on the house moved over five weeks and she wants that reasoning preserved, in her words.
- A professional handoff is useful (the elder-law attorney needs the right facts without Eleanor re-explaining).
- Guide Coordination is useful (a Guide helps her keep the follow-ups moving between the attorney, the CPA and Paul).

## 2. Fake people and professionals

All names are fictional. No real person, firm or credential is implied. Firm names are generic.

| Person | Role in the demo | Has an account? |
|---|---|---|
| Eleanor Marsh | The Host | Yes (demo Host) |
| Walter Marsh | Her father (appears only in her words) | No |
| Paul Marsh | Her brother (appears only in her words) | No |
| Priya Raman | Elder-law attorney, receives the Share With handoff | No (recipient inbox only) |
| Tom Kessler | CPA, appears as "waiting on a professional" | No |
| Joan Abernathy | Care manager, appears on the closed item | No |
| Nora Castellane | The demo Guide | Yes (demo Guide) |

No Founder data, no real family members, no real professionals, no real Guides.

## 3. Exact demo data (smallest realistic set)

All timestamps are written relative to the moment the seed script runs, so "five weeks ago" is always five weeks ago.

**Journey chain (real tables: `journeys`, `conversations`, `messages`, `referrals`)**
- 1 journey (program `general`), 3 conversations all `complete`: IAP, CAT, InnerCompass.
- 4 to 6 short messages each (host and guide roles), enough to open a real conversation view. Pre-written, not AI-generated (see Founder decision 6).
- 3 referrals whose `content` follows the real schemas in `lib/engine/referral-generation.ts`:
  - IAP: `currentConcern` ("Whether Dad can stay in his house, and what I owe him and myself"), `significantRelationships` (Dad, Paul), `internalTensions`, `desiredDirection`, `boundariesToProtect`, and the other required fields filled briefly.
  - CAT: `primaryLoss` (Dad's independence and the family home), `significantSecondaryLosses`, `activeTensions`, `restorationTargets`.
  - InnerCompass: `outcomeType` = `direction_chosen`, `centralDecisionOrDirection`, `rationale`, `capacityConsiderations` (Eleanor's own words about her capacity), `nextStep` (string), `whatToPreserve` (string), `commitmentsChosen`. This deliberately exercises the string-field Workbook display fixed on 2026-10-09.

**Coordination (real tables from migrations 0120–0125)**

| # | Kind | Title | Status | Notable fields |
|---|---|---|---|---|
| 1 | Decision | Whether Dad stays in his house | Open | Who carries: "I need help before deciding." Related conversation = the InnerCompass one. |
| 2 | Item | Confirm Dad's power of attorney and who can act | Open | "This belongs with a professional." Professional: Priya Raman, elder-law attorney. Next action and a due date about 6 days out. |
| 3 | Item | Dad's tax filing and the October estimated payment | Waiting | Waiting on: a professional (Tom Kessler, CPA). Who carries: "I do not currently have capacity to address this." Due about 12 days out. |
| 4 | Item | Home-care needs assessment | Closed | Carried by Joan Abernathy, care manager. |

That is Open, Waiting and Closed, three items plus one decision.

**Decision & Capacity Continuity entries on item 1** (the Host's own words, her own type selections):

| When | Type | Entry (Eleanor's words) |
|---|---|---|
| 35 days ago | What I wanted | "I want Dad to stay in his house as long as he can be safe there." |
| 35 days ago | What I understood | "After the fall, the hospital social worker said he should not be alone overnight." |
| 28 days ago | My reasoning | "I can't be there every night and Paul is four hours away." (WITHDRAWN 21 days ago; the timeline keeps it, flagged as withdrawn) |
| 24 days ago | A question I asked | "Asked the care manager what overnight help costs and whether insurance covers any." |
| 20 days ago | An alternative I considered | "A live-in aide for six months before deciding about the sale." |
| 7 days ago | My position changed | "From 'stay as long as possible' to 'stay only with overnight help in place; decide about the sale after the attorney meeting'." |
| 2 days ago | What I want communicated to others | "Tell Paul I am not deciding about the sale until the attorney has reviewed Dad's documents." |

Seven live entries and one withdrawn. No entry carries a score, verdict or capacity rating (the real vocabulary forbids it).

**Share With:** baseline has none. The handoff is created live (the link is never stored, so it cannot be pre-seeded).
**Guide Coordination:** baseline has none. Grant and Guide note are created live (see Founder decision 5 for the pre-seeded alternative).

## 4. Exact accounts

Classification: **B plus C** (A alone is not enough because Guide Coordination needs a Guide).

1. Demo Host (Eleanor): email/password account, consent recorded, adult (no developmental band). Not an admin.
2. Demo Guide (Nora): email/password account, with the three records the Guide gates require: `guide_candidates` row, active `guide_certifications` row, `guide_platform_authorizations` with `capability = coordination_support` and `status = authorized`. These fake certification rows are exactly why this must not live in Production.
3. One recipient inbox for the attorney handoff (no account; the recipient sees `/handoff/<token>` without one).

All three addresses should be mailboxes Dorian controls (for example plus-addresses or aliases). Neither demo account gets admin. Both accounts hold an active `founder_test` entitlement, the system's existing "designated test account" marker, so Needs-Dorian already treats them as expected.

Accounts are created by Dorian in the Supabase dashboard (he enters the passwords). I will not create them or handle their credentials.

## 5. Recommended environment

**A dedicated demo environment: a second Supabase project and a second Vercel project deployed from the same repository and the same branch (`defying-grief-v2`).** This is the pattern already used when Pink Shoelace was separated.

Why:
- Same code, always: no demo branch to drift, nothing in Production is altered for the demo (satisfies "real architecture, no parallel fake").
- Fake certified Guide, fake Host, fake professionals never touch real reporting, the real Guide picker, or real counts.
- Zero real-Host exposure.

What it needs:
- Demo Supabase project with the schema applied (`schema.sql` plus migrations 0001–0125; 0104–0109 were restored today, so the set is now complete). Applied by Dorian in the SQL editor, the same way Production was.
- Vercel project "avaia-demo" from the same repo/branch with its own environment variables: the demo Supabase URL and keys, the demo site URL, the Resend key, `COORDINATION_SHARING_ENABLED=true`, `COORDINATION_GUIDE_ENABLED=true`.
- Deliberately NOT set in the demo project: `CRON_SECRET` (the scheduled jobs then reject their own calls, so no reminders run), Stripe keys (no payment surface), Anthropic key (no AI calls, no AI cost, nothing can generate surprise content).
- A demo hostname (Founder decision 2).

UNVERIFIED: whether the production build tolerates the missing Stripe/Anthropic variables. It almost certainly does (they are read at request time), but the first build in the demo project is the proof, and it is step 3 of the build sequence.

**Fallback if you want it in Production anyway:** possible only with new code (a rule in the Guide-picker function and an exclusion in the digest and operations scans keyed to `founder_test`). I do not recommend it; it would change a permission-bearing function and put fake certified Guide rows in the real table.

## 6. Presenter flow (about 14 minutes)

Setup (before the audience arrives): reset script run, two browser profiles open (Host profile signed in as Eleanor, Guide profile signed in as Nora), the attorney inbox open in a third tab. No admin page is ever opened.

| Min | Where (route) | What the presenter shows and says |
|---|---|---|
| 0:00 | `/workbook` | "This is Eleanor's Workbook. Everything here is hers." Scroll to the IAP card: what she came in with ("Should Dad sell the house?"). |
| 1:30 | `/workbook` (CAT and InnerCompass cards) | What became visible: the loss underneath it (Dad's independence, the home), then the InnerCompass outcome: a direction she chose, with her own `nextStep` and `whatToPreserve`. Show her capacity note in her words. |
| 3:30 | `/workbook` → Coordination section → `/workbook/coordination` | "AVAIA never fills this in." Four items: Open, Waiting, Closed, plus the decision. Point at who-carries and waiting-on: all chosen by Eleanor. Show that the "Add to Coordination" links come only from her own decisions and commitments (do not click). |
| 5:00 | `/workbook/coordination/[decision item id]` | The Decision & Capacity Continuity record: her reasoning over five weeks, in her words, in order; the position change she selected herself; the withdrawn entry kept and flagged. "AVAIA never decided her position changed." |
| 7:30 | the power-of-attorney item → "Share with someone" → `/workbook/coordination/[id]/share` | Priya Raman, attorney, demo inbox. She ticks exactly what goes in (the item, the decision entries she chooses, not the withdrawn one), previews exactly what the attorney will see, and authorizes (the Founder-approved wording appears). Link lasts 7 days. |
| 10:00 | inbox tab → email → `/handoff/<token>` | The email carries no content. The link opens a frozen, read-only copy, no account, shows who shared it and when it ends. "Priya sees only what Eleanor approved." |
| 11:30 | Host profile: `/workbook/coordination/guide` | "Give a Guide access": Nora, 14 days, ticks the power-of-attorney item and the decision with two entries, authorizes. The authorization wording states what the Guide can and cannot do. |
| 12:30 | Guide profile: `/guided-coordination` → the grant | Nora sees only what was ticked. She records "Contacted a professional" with a short note. The page offers no way to edit Eleanor's decision, entries, delegation, ownership or shares. |
| 13:30 | Host profile: item page, then `/workbook/coordination/guide` | Nora's note appears in a separate Guide lane, labelled as hers; Eleanor's own entries are untouched. Eleanor ends the access with one click. "The Host stays in control." |

Total about 14 minutes, one minute of slack. The live Share and Guide moments are the strongest parts; if time is short, skip 3:30 or shorten 1:30.

## 7. Reset strategy

**One file: `demo_reset_and_seed.sql`.** It deletes the demo Host's journeys, conversations, referrals, coordination rows, shares and Guide grants and events, then re-inserts the baseline with timestamps relative to `now()`. It only touches the two demo accounts (by id), is idempotent, and ends with self-labelling `returning`/count output. It is run in the demo Supabase SQL editor by Dorian before each presentation. Because the demo project is isolated, this is the whole reset.

- **Static baseline:** conversations, referrals, items and entries, re-created each reset with fresh relative dates.
- **Needs reset after a run:** the live share, the live grant and the Guide's note (all created during the demo).
- **Share links:** expire (1 to 30 days; the demo uses 7). Reset deletes them regardless.
- **Guide grants:** expire (1 to 90 days; the demo uses 14) and the presenter ends the grant at 13:30 anyway.
- **No admin tooling needed.** A second read-only file, `demo_baseline_check.sql`, returns PASS/FAIL rows (counts per table, no demo-account leftovers) so Dorian can confirm the baseline in seconds.

## 8. Separation and safety

- Separate Supabase project: demo rows physically cannot appear in Production reporting, the Production digest, System Checks, or the real Guide picker.
- No `CRON_SECRET` in the demo project: no reminders, digests or check-ins ever run.
- No Stripe key: no payment surface. No Anthropic key: no AI calls or cost.
- All three addresses are Dorian-controlled. The only sends in the whole flow are the Share With email and the Guide-grant email; both go to those addresses.
- Residual risk: a presenter could type a real address into the Share With form in the demo environment, and the email would send. Mitigation is procedural (the script names the exact address) plus the optional Founder decision 8 (a demo-only send allow-list). I do not recommend building the allow-list unless you want it.
- Marker: the existing `founder_test` entitlement on both accounts is enough. In the dedicated environment no new flag is needed. Display names are plain fictional names, so the product looks like the real product.

## 9. Existing features reused (all real, none changed)

Workbook roll-ups (including the `nextStep`/`whatToPreserve` fix), Coordination items and states, Decision & Capacity Continuity entries and timeline, withdrawn-entry handling, Share With and `/handoff/<token>`, Guide Coordination (grant, scope, `/guided-coordination`, Guide event kinds, Guide lane), the `founder_test` marker, the Founder-approved authorization wording, System Checks (run in the demo project to confirm it matches the expected schema).

## 10. New code or data structure genuinely required

**None in the application.** New artifacts are data and documents only: `demo_reset_and_seed.sql`, `demo_baseline_check.sql`, a one-page presenter script, and the demo project's configuration. A code change would be needed only if you choose the Production fallback (section 5) or the optional send allow-list (Founder decision 8).

## 11. Files, routes and components likely affected if built

- New files only: `supabase/demo/demo_reset_and_seed.sql`, `supabase/demo/demo_baseline_check.sql`, `docs/DEMO_PRESENTER_SCRIPT.md`, `supabase/MIGRATIONS.md` (a short "demo environment" note).
- Routes exercised, none modified: `/workbook`, `/workbook/coordination`, `/workbook/coordination/[itemId]`, `/workbook/coordination/[itemId]/share`, `/handoff/[token]`, `/workbook/coordination/guide`, `/guided-coordination`, `/guided-coordination/[grantId]`.
- Application source, migrations and gates in Production: untouched.

## 12. A/B/C classification

B plus C: one synthetic Host, one synthetic Guide, one recipient inbox. A alone cannot show Guide Coordination.

## 13. Smallest build sequence

1. Founder decisions (below).
2. Create the demo Supabase project; Dorian applies the schema and migrations 0001–0125; I check parity with a read-only catalog query and the expected-schema file.
3. Create the demo Vercel project from the same repo and branch with the environment variables listed; first build is the proof that Stripe/Anthropic are not needed. Confirm `/api/health`.
4. Dorian creates the two auth users and the recipient mailbox exists.
5. Seed v1: profiles, consent, `founder_test`, Guide records, and the Journey chain; verify the Workbook renders IAP, CAT and InnerCompass (including `nextStep`/`whatToPreserve`).
6. Seed v2: the four coordination items and the seven-plus-one entries; verify the item pages and the timeline.
7. Dry run of the full flow once, live Share and live Guide grant, then run the reset and the check file; confirm the baseline returns.
8. Presenter script (one page) and a second dry run by Dorian.

Each step is verified before the next; nothing touches Production.

## 14. Founder decisions required before build

1. **Environment:** dedicated demo environment (recommended) or Production with new code?
2. **Demo hostname** (for example a subdomain) and who may hold the demo credentials.
3. **Approve the scenario and names** (Eleanor Marsh, Walter, Paul, Priya Raman, Tom Kessler, Joan Abernathy, Nora Castellane), or give replacements.
4. **Three Dorian-controlled addresses** for the demo Host, demo Guide and the attorney inbox.
5. **Live or pre-seeded** Share and Guide grant. Recommended: live (stronger, and the link cannot be pre-seeded anyway). Alternative: pre-seed the grant and a Guide note for short demos, behind a second block in the reset file.
6. **Disclosure about transcripts:** the IAP/CAT/InnerCompass conversations are pre-written synthetic text stored in the real tables, not AI-generated live. Approve saying so to audiences. Optionally, a live short AI segment is possible only if you add an AI key to the demo project (cost, nondeterminism).
7. **Resend:** reuse the existing Resend key and verified sender in the demo project (recommended) or set up a separate one.
8. **Optional send allow-list** in the demo project (new code, not recommended).
9. **Reset ownership:** Dorian runs the reset before each presentation (recommended), or you want a one-click page (new code, not recommended).

## Not verified (honest list)

- The exact on-screen layout of each Workbook card (I verified the routes and the data they read, not the pixels).
- Whether any build step requires Stripe/Anthropic variables (proved at build step 3).
- The exact required columns for the `guide_candidates` row (read at build step 5 from the live migration before writing the seed).
- Exact wording of the authorization statement on the share and Guide pages (it is the Founder-approved wording, read at build time).
