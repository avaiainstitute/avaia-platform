# AVAIA operating standard: what "done" means

Adopted 2026-10-03 after the 1-2 October 2026 failure, in which seven operational
systems were written to a branch that is not production and were reported as
complete although none had ever run.

**A capability is DONE only when every one of these is true. Code existing is not done.**

1. **Implemented.** Its rules are written and covered by simulated-record tests in
   `lib/ops/needs-dorian-selftest.ts` (the tests run inside System Checks, in production).
2. **Connected.** It is registered in `lib/ops/capabilities.ts`, so it runs through the single
   Needs-Dorian source. It has no private email, cron, or page that can be forgotten.
3. **Production.** It is on `defying-grief-v2`, the branch Vercel builds production from, and
   `/api/health` reports that commit. A green build of a preview or any other branch is NOT deployment.
4. **Trigger / input.** Whatever makes it act exists and is wired: the scheduled digest, an
   in-request hook, or the form/screen a person uses to give it records. A rule with no way
   to create the records it judges is not complete.
5. **Tested.** The self-test passes in System Checks; a pull request is not enough.
6. **System Check proves it.** `capability_<key>` evaluates it live, and the daily digest cron
   records its evidence in `cron_runs.detail`; a capability not evaluated by the last scheduled
   run is reported.
7. **Human-required issues route through Needs Dorian.** Anything only a person can decide appears in
   What Needs Dorian (and the digest); routine work never asks Dorian for anything.

## Standing safeguards (all in System Checks)

| Check | Catches |
|---|---|
| `deploy_matches_branch` | production not running the latest commit of the production branch |
| `deploy_default_branch` | GitHub's default branch is not the production branch (tools write there) |
| `deploy_stray_work` | recent work on any other branch that production does not have |
| `schema_tables` / `schema_columns` / `schema_functions` | code needs a table/column/function the database lacks |
| `schema_orphan_tables` | a migration applied without application code (or an unexplained table) |
| `schedule_jobs` | a job in `vercel.json` that is not recording runs |
| `capability_*` | a capability that is not actually being evaluated |

## Rules for changes

- Production branch is `defying-grief-v2`. Never write operational work anywhere else.
- Any new `.from("table")` or column migration requires `sh scripts/expected-schema.sh` (the build fails if stale).
- Any new schedule in `vercel.json` needs its name in `RECORDED_CRON_NAMES` and in the `cron_runs` name constraint.
- Tables are preserved, never dropped to tidy up; unused ones are listed with a reason in `lib/ops/system-truth.ts`.
