# Recovery ledger (2026-10-03, closed 2026-10-04)

Capability -> Implemented -> Connected -> Production -> Trigger/Input -> Tested -> System Check -> Operational

Nothing is marked complete until every applicable column is satisfied (see
docs/OPERATING_STANDARD.md). "Production" means the commit is on `defying-grief-v2`
and `/api/health` reports it. The "Operational" column is proven by the scheduled
System Checks run recorded 2026-10-04 00:00 UTC, not by the code existing.

Production head when closed: `e54579d`.

| Capability | Implemented | Connected | Production | Trigger / Input | Tested (simulated records) | System Check | Operational |
|---|---|---|---|---|---|---|---|
| Safeguards (stray work, default branch, orphan tables, capability evidence, DONE standard) | yes | yes (System Checks cron) | `4e0c879` | scheduled System Checks (every 6h) | n/a | `deploy_stray_work` pass, `schema_orphan_tables` pass, `deploy_default_branch` NEEDS DORIAN (GitHub setting only Dorian can change) | yes |
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

- Switch GitHub's default branch to `defying-grief-v2` (the `deploy_default_branch` check stays at NEEDS DORIAN until then).
- Pink Shoelace Stage 2 (its own Supabase, Vercel and email sender) needs accounts only the owner can create.
