# Recovery ledger (2026-10-03, closed 2026-10-04)

Capability -> Implemented -> Connected -> Production -> Trigger/Input -> Tested -> System Check -> Operational

Nothing is marked complete until every applicable column is satisfied (see
docs/OPERATING_STANDARD.md). "Production" means the commit is on `defying-grief-v2`
and `/api/health` reports it. The "Operational" column is proven by the scheduled
System Checks run recorded 2026-10-04 00:00 UTC, not by the code existing.

Production head when closed: `e54579d`.

| Capability | Implemented | Connected | Production | Trigger / Input | Tested (simulated records) | System Check | Operational |
|---|---|---|---|---|---|---|---|
| Safeguards (stray work, default branch, orphan tables, capability evidence, DONE standard) | yes | yes (System Checks cron) | `4e0c879` | scheduled System Checks (every 6h) | n/a | `deploy_stray_work` pass, `schema_orphan_tables` pass, `deploy_default_branch` fixed by the owner 2026-10-04 (see "Default branch" below) | yes |
| Pink Shoelace separation, Stage 1 | yes | yes | `a997032` | `/pink-admin`, Pink daily summary cron (12:35 UTC) | live proof | `separation_pink_not_in_avaia` pass; `pink_*` site/intake checks pass | yes (Pink summary's first scheduled run: 2026-10-04 12:35 UTC) |
| Guide Operations | yes | registry + Needs Dorian + Toolkit "My Guide Status" | `4ad52d2` | evaluated by every digest and `/admin/today`; records read from Guide tables | `pipeline_guide_operations` pass | `capability_guide_operations` pass (1 record examined) | yes |
| Host / Participant Operations | yes | registry + Needs Dorian + Guide participant marker | `4ad52d2` | same | `pipeline_host_participant_operations` pass | `capability_host_participant_operations` pass (66 records examined) | yes |
| Organization / Event Operations | yes (organizations; no event records exist yet) | registry + Needs Dorian | `4ad52d2` | same | `pipeline_organization_operations` pass | `capability_organization_operations` pass (0 organizations exist) | yes for organizations; the event half has nothing to operate until the planned Workshops/Events feature exists |
| Toolkit Stewardship | yes | registry + Needs Dorian + Guide form + admin queue + live route probe | `7d257db` | Guide form `/toolkit/support`; evaluated by every digest | `pipeline_toolkit_stewardship` pass | `capability_toolkit_stewardship` pass (16 tools probed) | yes |
| Conversation Integrity & Boundary Oversight | yes | registry + Needs Dorian + scan after every AI reply + review queue | `1e3fb44` | in-request scan on each AI reply path; review at `/admin/conversation-integrity` | `pipeline_conversation_integrity` pass | `capability_conversation_integrity` pass (0 flags so far) | yes; the first live flag will appear when a reply trips a rule |
| Program Operations | yes | registry + Needs Dorian + Guide card + human authorization screen | `e54579d` | enrollment and evidence entered at `/admin/program-authorizations` | `pipeline_program_operations` pass | `capability_program_operations` pass (0 enrollments so far) | yes |

## Still pending (time, not work)

- `capability_digest_evidence` reads "the next scheduled run will record the proof": the daily digest (12:30 UTC) records that every capability was evaluated on its own scheduled run.
- `schedule_jobs` shows the `host-onboarding` partial run, which clears at the 12:00 UTC run (its fix is deployed).

## Needs the owner

- Pink Shoelace Stage 2 (its own Supabase, Vercel and email sender) needs accounts only the owner can create.

## Default branch (2026-10-04)

The owner changed GitHub's default branch from `main` to `defying-grief-v2`. Confirmed at the
source on 2026-10-04 00:39 UTC: GitHub reports `default_branch: defying-grief-v2`, the same
branch production is built from. The recorded `deploy_default_branch` check from the 00:00 UTC
run predates the change and still reads NEEDS DORIAN; it records PASS on the next scheduled run
(06:00 UTC) or as soon as "Run checks now" is pressed. `main` itself is unchanged and archived
as the tag `archive/main-2026-10-03`.

## Known temporary arrangements

- **Pink Shoelace admin sign-in.** `/pink-admin` currently uses the same shared admin sign-in and
  role as AVAIA's admin. This is a temporary arrangement for Stage 1 of the separation. It is not a
  permanent architecture decision and has not been changed.

## Known dependencies (not built, not designed)

Recorded in `docs/IMPLEMENTATION_BACKLOG.md`: the Event portion of Organization/Event Operations,
and participant invitation / session-link delivery for Guide/Participant Operations.

## Move 5 follow-on (2026-10-04)

Guide read access to the Library now follows certification and Toolkit authorization, not the
profile role label (migration 0115, applied and verified by a self-rolling-back test: a certified,
Toolkit-authorized Guide with no membership went from 25 to 59 visible entries). `schema_rules`
now fails if that rule ever depends on the role label again.

## Move 6: Guide certification completion (2026-10-04)

Two gates, never one (decisions 0004, 0005): the admission decision makes a Candidate; the
certification decision makes an AVAIA Certified Guide. Admission is not a promise of
certification. Production: `f1d2e35` (migration `0116` applied and verified first, 2026-10-04).

| Capability | Implemented | Connected | Production | Trigger / Input | Tested (simulated records) | System Check | Operational |
|---|---|---|---|---|---|---|---|
| Front door: apply (no fee), save a payment method (no charge), human admission decision, charge only after admission | yes | Stripe setup mode + webhook; `/admin/certification-applications`; What Needs Dorian | `f1d2e35` | `/certified-guide/apply`; admin decision | `pipeline_certification_admissions` | `capability_certification_admissions` | the first real charge cannot be exercised before the first real admission (no Stripe test environment); every other step is proven by the self-test |
| Candidacy access (`candidacy` entitlement; ends with candidacy or certification; a membership is never touched) | yes | admission, every status change, certification grant, daily backstop in the entitlement-reconciliation cron | `f1d2e35` | admission / status change / 12:15 UTC cron | `pipeline_certification_admissions` | `capability_certification_admissions` (access mismatches) | yes |
| The path: seven required steps in order; toolkit assembly relocated to specialty authorization | yes | candidate dashboard, admin candidate page, Needs Dorian | `f1d2e35` | evidence recorded by an admin | `pipeline_certification_path` | `capability_guide_operations`, `schema_rules` | yes |
| Human evaluations: ten-item Gate, Universal Practice Lab Evaluation (15 labs), eleven-row Practicum; the system only adds up | yes | admin candidate page writes the matching evidence rows | `f1d2e35` | admin forms | `pipeline_certification_path` | `schema_rules` (admin-only tables) | yes |
| Labs 12 (Scenarios A, B, C) and 14; evaluator-only material isolated | yes | classroom labs; evaluator reference imported only by admin screens | `f1d2e35` | build-time `scripts/evaluator-isolation.sh` | `pipeline_certification_practice` | build fails on a violation | yes |
| AI Host practice (Host Card only; never evaluates, scores or hints) | yes | `/certification/practice` | `f1d2e35` | candidate | `pipeline_certification_practice` | `schema_rules` (candidate-private tables) | yes |

Intentionally held: lessons 6.12, 6.16, 7.13; denial/reapplication messaging and refund policy;
evaluators other than the owner; Youth Guide facilitation. Lab 12 Scenario C wording was derived
from the owner's immediate-safety clarification.

### Move 6 proof (System Checks run 2026-10-04 04:39 UTC, production `c289797`)

Triggered manually from `/admin/system-checks` (the same production check the schedule runs; the
owner pressed "Run checks now"). `deploy_matches_branch` confirmed the run evaluated `c289797`, the
latest commit of `defying-grief-v2` (code identical to `f1d2e35`; the later commit is docs only).

- `pipeline_certification_admissions`, `pipeline_certification_path`, `pipeline_certification_practice`: pass.
- `capability_certification_admissions`: pass (0 applications exist yet, so 0 records examined).
- `schema_tables`: pass (all 107 tables present); `schema_rules`: pass (includes the AI-practice privacy,
  admin-only evaluation records, evidence-vocabulary and candidacy-access rules).
- Still reads NEEDS DORIAN, unrelated to Move 6: `schedule_jobs` (the `host-onboarding` partial run noted above).
- `capability_digest_evidence` records the proof for this capability on the next 12:30 UTC digest run.

## Move 7: Keep this (2026-10-04)

A Host can intentionally carry something from an AVAIA experience into their own continuing record.
A Guide may OFFER something back; a Guide may never decide that it belongs in the Host's record
(decision 0006). Production: `e5459b3` (migration `0117` applied and behavior-tested first).

| Capability | Implemented | Connected | Production | Trigger / Input | Tested | System Check | Operational |
|---|---|---|---|---|---|---|---|
| Host-owned kept items (`kept_items`), Workbook "Kept" section and text export | yes | Workbook; Journey completion card ("In your own words"); Unsung Heroes recognition | `e5459b3` | the Host's own click | `pipeline_keep_this` | `schema_rules` (Host-only policies, no forged provenance, immutable content) | yes |
| Guide offer, then Host confirmation, then Host sees the item, then Keep or Decline | yes | Guide participant record (offer); Workbook "From your Guides" | `e5459b3` | the Guide's offer; the Host's confirm and choice | `pipeline_keep_this` | `schema_rules` (offer is a pointer, no Guide update policy, Guide sees only waiting offers) | yes for linked or verified-email participants; none exist yet (0 offers) |
| A Guide can no longer write a participant's Virtue Signature | yes | route refuses it; function removed; database policy dropped | `e5459b3` | n/a | `pipeline_keep_this` | `schema_rules` | yes |

Proof: System Checks run 2026-10-04 05:09 UTC on production `e5459b3` (`deploy_matches_branch` confirmed),
triggered manually from `/admin/system-checks`: `pipeline_keep_this`, `schema_rules`, `schema_tables`
(109 of 109) and every Move 6 check pass. Before deploy, a self-rolling-back test against the live database
confirmed: a Guide can create only a waiting offer for their own participant and session, cannot create a
confirmed or kept one, has no update right, cannot see an offer once the Host decided, cannot see kept
items; a Host cannot forge a "came through a Guide" item, cannot keep into another Host's record, and
cannot rewrite kept content; a non-admin Guide cannot write a participant's Virtue Signature. (The admin
account, which holds the pre-existing admin-all policy on the Signature table, is the only exception.)

Intentionally held: Rooms, estate/legacy functionality, a major export system, any Workbook redesign,
offers to Youth participants (Youth Guide facilitation stays on hold), a participant with no email on file
(no account an offer could reach).

## Founder reconciliation (2026-10-04)

Brings the existing system back into line with the owner's decisions recorded in
`institution/decisions/0007-founder-reconciliation-2026-10-04.md`. Integrates, does not rebuild.
Production: `1b88010` (migration `0118` applied and verified first).

| Decision | Implemented | Connected | Production | Tested | Operational |
|---|---|---|---|---|---|
| The Host owns the Room and Table; the Guide facilitates (`rooms.host_participant_id`; Host seated first, not removable by the Guide; UI, prompts, policy names, public page) | yes | Shared Room, Toolkit Rooms, Room prompt | `1b88010` | `pipeline_founder_reconciliation` | yes |
| Witness is a standing function, not a person | yes | institution roles/seats/OS text, Table prompts, Room prompt, Table lesson | `1b88010` | `pipeline_founder_reconciliation` | yes |
| Preparation GPT is a human Guide-side tool used while working with the Host | yes | manual, Toolkit card/picker/record button, prompts, source docs and workflow chains, links from active session pages | `1b88010` | `pipeline_founder_reconciliation` | yes |
| Virtue Formula governing term is Desired Outcome (lesson 5.14 corrected; the person's own words are the Desired Outcome) | yes | Chemistry page, generator, certification lesson 5.14 | `1b88010` | `pipeline_founder_reconciliation` | yes |
| Virtue Signature: six AI-generated layers removed; repeated experiences kept together per virtue; first ring, next ring of eight, no invented later capacities | yes | Signature page, visual, Workbook, Journal form and prompts, Journey card, add route | `1b88010` | `pipeline_founder_reconciliation` | yes |
| DORIAN = Dignity, Originality, Respect, Individuality, Authenticity, Nobility | already correct in code | name acrostic | `1b88010` | `pipeline_founder_reconciliation` | yes |

Proof: System Checks run 2026-10-05 03:49 UTC on production `1b88010` (`deploy_matches_branch` confirmed),
triggered manually from `/admin/system-checks`: `pipeline_founder_reconciliation`, `schema_rules`,
`schema_tables` (109 of 109), `pipeline_keep_this` and all Move 6 pipeline checks pass; 68 of 68 checks in
the run pass. Before that, the Vercel preview build (including the prebuild schema and evaluator-isolation
guards) passed, and the production Formula route, Shared Room page and Chemistry page were spot-checked.

Intentionally NOT decided (owner decisions still open): how the Virtue Formula's elements become visible or
selected (today the AI chooses them, isolated in `app/api/chemistry/virtue-formula/route.ts`); who may close,
pause, archive or reopen a Room and what happens to a Room if its Host's records are deleted; how rings after
the Signature's first eight elements are divided; approval of the reworded lesson 5.14. Provenance not
established and left alone: the other ten Master Format Kits and Blueprints saved 26-27 August 2026 and the
published Experiences that may derive from them.

## Pink Shoelace Foundation separation and cutover (2026-10-05)

Founder directive: the Pink Shoelace Foundation and AVAIA are separate organizations. Details and the
thirteen answers: `docs/pink/SEPARATION.md`. Source authority and connection map: `docs/pink/`.

| Step | Done | Production / proof |
|---|---|---|
| Cross-organization flows cut in AVAIA's code (research that mixed both, reads of Foundation tables in AVAIA's admin/digest/needs list) | yes | AVAIA `710e08f` |
| Defects fixed (admin resolve, acknowledgment recording, all submission types queued, promises removed, basic spam protection) | yes | verified live on `710e08f`, then re-verified on the Foundation's own app |
| Foundation's own database (Supabase project `pialogfbveweezrdfsql`, schema loaded, RLS on, no policies) | yes | 18 tables; no real submissions were ever recorded |
| Foundation's own application (`avaiainstitute/pink-shoelace-foundation-app`, Vercel project of the same name, `https://app.thepinkshoelace.org`) | yes | first build passed; sign-in, admin, resolve, forms, acknowledgments proven below |
| Own email identity (`contact@thepinkshoelace.org`, Resend domain verified, key limited to that domain) | yes | test submissions acknowledged; `email_send_failures` 0 |
| Website forms repointed (`thepinkshoelace.org` contact and get-involved post to the new app) | yes | live pages checked from outside; a spam-trap submission stored nothing |
| Foundation removed from AVAIA (routes, `/pink-admin`, daily summary job, checks, email code, Foundation research) | yes | AVAIA `6db667b` (first attempt `f20993b` failed to build on a literal `\n` left by a scripted edit, never deployed; the previous deployment stayed live) |
| Build guard in AVAIA fails if any AVAIA code reads a `pink_*` table or imports Foundation code | yes | `scripts/pink-isolation.sh`, passes on a fresh clone |

Proof: on production `6db667b` (`/api/health` shows the commit) `/api/pink/*`, `/pink-admin` and the old daily
summary job return 404; AVAIA's contact page and cron routes respond as before. AVAIA System Checks run from
`/admin/system-checks` after the cutover: clean (owner-reported). The Foundation's own System Checks run: all
nine checks pass (public pages, own endpoints, database, email delivery, behavior self-test, email identity).
My test submissions were deleted from the Foundation's database (0 rows).

Still shared, stated plainly: the Vercel team account, the GitHub organization, the Cloudflare account, the
Resend account, and the Google Workspace that holds the `contact@` alias. Neither database has backups.
Owner decisions still open: what to do with the 19 AI-found prospect rows (archived in
`docs/pink/research-output-archive-2026-10-05.json`; the Foundation starts empty), whether the Foundation's
public pages keep their links to AVAIA, Supabase plan and who pays (needs the fiscal sponsor's approval for
the Foundation's funds), the fund-name spelling on the fiscal sponsor's agreement, and whether any Foundation
research should ever exist again.
