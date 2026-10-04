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
