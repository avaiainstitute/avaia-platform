# AVAIA closure report, 2026-10-10

Code verified live at commit `f808a7e` (Production and demo). Database state NOT verified live except where stated.

| Item | Current verified state | Action taken | Remaining work | Founder decision still required? | Final status |
|---|---|---|---|---|---|
| 1 Chemistry for Families & Kids | `lib/chemistry-stories.ts` holds 123 of 123 canonical elements, each complete | None needed | None | No | CLOSED |
| 2 Virtue Formula | Audit only; code read, nothing changed. Element selection (how Primary/Supporting/Balancing are chosen) still open | None (by instruction) | Selection rule | Yes: element selection | NEEDS FOUNDER DECISION |
| 3 Virtue Distortions | Only active reference was the "reserved future capability" section on /chemistry | Removed; historical docs left | None | No | FIXED |
| 4 Secondary Loss naming | Canonical list now uses Capacity; legacy name still READ as Capacity; strict on new generation; self-test added | Code renamed everywhere active; migration 0126 prepared | Run 0126 (tidies stored data, app works without it); confirm two Capacity one-liners; class-5 body and Defying Grief reference-row wording are Founder content | Yes: copy | FIXED (data migration pending; copy NEEDS FOUNDER) |
| 5 Unsung Heroes | Acknowledge/Contribute cycle works end to end in code (recognition route, migration 0069, dashboard) | None | None | No | CLOSED |
| 6 Workbook Master Connection Map | Lists, not a relational graph | Reframed "The whole picture"; kept What Keeps Becoming Visible | None | No | FIXED |
| 7 Master Control Panel / Tasks | Covered by Coordination | Wording removed; comment records SUPERSEDED BY COORDINATION | None | No | SUPERSEDED |
| 8 What Still Needs to Be Said | Already fully standalone (own tables, engine, endpoint) | Decision 0012 recorded | None | No | CLOSED |
| 9 Defying Grief | See area table below | None (audit only) | See below | See below | See below |
| 10A Public website truthfulness | One stale Youth line found | Fixed (Certified Guide page). Newer capabilities lack public copy | Public copy for Coordination, Share With, Guide Coordination etc. | Yes: copy approval | FIXED / NEEDS FOUNDER DECISION |
| 10B Owner/Exception Agent | Functions covered by What Needs Dorian, Today, Digest, System Checks | None | Original spec not in material I hold, so redundancy judged from the live tools | Confirm | RETIRED (confirm) |
| 10C Operations Console | /admin/operations, /admin/today, Digest, ledgers, System Checks exist | None | None | No | SUPERSEDED |
| Deferred set (Decision 0013) | Nine items | Recorded as DEFERRED | Only on later Founder decision | No | DEFERRED |

## Item 9 by area (from code and migrations; live database rows not inspected)

| Area | Finding | Class |
|---|---|---|
| Website program page | Present, Audacity of Grief/Happiness framing, three-room crossing; no stale-language hits | Complete |
| 11-module adult structure | Modules 1-11 exist in migration 0033, published by 0036 | Complete |
| Youth structure | Modules 1-11 in 0040, published by 0050; Youth Guide facilitation specialty held | Complete / held |
| IAP to CAT to InnerCompass | Stage labels and gating in `lib/defying-grief.ts` | Complete |
| Secondary Loss connection | Four-thread table keyed by canonical names (now Capacity) | Complete; reference-row description needs Founder wording |
| Stone and Ripples | Module 3 and public page copy | Complete |
| Audacity | Present in CAT and InnerCompass additions and public copy | Complete |
| Guide delivery, Shared Room, take-home/facilitator | Toolkit page, migrations 0049, 0051 | Complete in code; not live-tested by me |
| A Day in the Life of Grief | No references found; left separate | n/a |
| Conflicts / genuine defects | None found | none |

## A. Changed
Code at `f808a7e` (items 3, 4, 6, 7, 10A), Decision 0012, Decision 0013, this report, migration 0126 file.

## B. Deliberately not changed
Default Production sign-in landing; historical docs and old migrations; Virtue Formula; Defying Grief content; class-5 body text; "Dreams / Opportunities" and "Attachment / Support" spacing; stale developer comment in `app/toolkit/page.tsx` (~462).

## C. Migrations
0126 prepared, NOT applied. The app works without it.

## D. Checks
Preview builds green on both Vercel projects; live site checks passed (see commit). System Checks not yet run live; new check is `pipeline_secondary_loss_names`.

## E. Open
Run 0126; run System Checks; Founder: Virtue Formula selection, Capacity one-liners, class-5 and reference-row wording, public copy for new capabilities, confirm Owner/Exception Agent retirement. Held: Youth Guide facilitation, lessons 6.12, 6.16, 7.13. Demo "End their access" click-through unverified.

## Update, same day (commit `0915e3b`, live)

* Secondary Loss canonical name is **Loss of Capacity** (Decision 0015). Bare "Capacity" removed; "Decision-Making / Boundaries" is a read-only legacy alias; display never doubles the prefix. Migration 0126 rewritten to migrate stored data to "Loss of Capacity" (NOT yet applied; step 3 of it should return 20 rows).
* Capacity wording approved and live: public line and Library prompt. View From Above class 5 body and the Defying Grief stored rows (pilot "Ten Secondary Losses" row, Module 4 adult and Youth) rewritten from lesson 5.5; the Hike Lesson, Anchor, Dorian's account and the Fortitude list are Founder-authored and unchanged.
* Virtue Formula rule adopted (Decision 0014): suggestions only where the Host's own words support them (verified in code against the Host's text), no roles, no fixed counts, Host assigns roles and confirms exactly one Primary.
* Public copy added to existing pages only: `/for-families-and-professional-teams` (Coordination, Decision & Capacity Continuity, Share With) and `/certified-guide` (Guide Coordination).
* Owner/Exception Agent RETIRED (Decision 0016). Nine items DEFERRED (Decision 0013).
* Host-facing "Your Guides" section added to the Workbook (visibility only, existing data only).
* Not run (needs a signed-in session): full System Checks, demo End-access test.
