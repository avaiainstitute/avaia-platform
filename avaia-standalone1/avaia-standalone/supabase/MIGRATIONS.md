# Migrations: how AVAIA knows what is really in the database

Migrations are applied by hand in the Supabase SQL editor. A file in this
folder is therefore a *claim* until the database confirms it. The system
checks (`lib/ops/system-checks.ts`, `lib/ops/system-truth.ts`) compare the
claim with the real database every six hours and report differences in the
Founder Digest and `/admin/today`; `/admin/system-checks` shows the full list
and has a "Run checks now" button.

## What is checked, and where the expectation comes from

| Expectation | Derived from | Checked by |
|---|---|---|
| Every table the application reads or writes exists | `.from("…")` calls in `app/`, `lib/`, `components/` | `schema_tables` |
| Every column a migration adds exists | `add column` statements in this folder | `schema_columns` |
| Every database function the code calls exists | `.rpc("…")` calls | `schema_functions` |
| Row-level security is on for every table | the live catalog (`avaia_schema_snapshot()`, migration 0111) | `schema_rls` |
| A short list of protective rules (60-month rule, renewal cycle, scheduled-job-name rule, candidate-reflection privacy) | `lib/ops/system-truth.ts` | `schema_rules` |
| Every job in `vercel.json` has recorded a recent run | `vercel.json` | `schedule_jobs` |
| Production runs the latest commit of the production branch | GitHub vs. Vercel's build environment | `deploy_matches_branch` |

The list of tables, functions, and columns lives in
`lib/ops/expected-schema.generated.ts`. It is generated, never hand-edited:

    sh scripts/expected-schema.sh

`npm run build` fails (`prebuild`) if that file is out of date, so a new table
cannot be added to the code without the checks learning about it.

## Adding a migration

1. Write the migration file and run it in the Supabase SQL editor.
2. If it adds a column, run `sh scripts/expected-schema.sh` and commit the result.
3. If it adds a rule that must always hold (a trigger, a privacy restriction), add it to `schemaChecks` in `lib/ops/system-truth.ts`.
4. After deploying, open `/admin/system-checks` and press "Run checks now".

## Numbering notes

* `0063` and `0064` each exist twice (two unrelated migrations that share a number). Both are live.
* `0100`–`0103` came from the `main` branch and are live; production code depends on them (the certification classroom, Companion, and Certification Operations), so their files are kept here verbatim.
* `0104`-`0109` were first written on `main` and applied to the database by hand. Production now uses the tables of `0107` (program authorization), `0108` (Toolkit support) and `0109` (conversation integrity flags) through the operational capabilities (see docs/RECOVERY_LEDGER.md). The tables of `0104`, `0105` and `0106` (exception ledgers, and the Pink Shoelace Legacy records) are preserved without code and are listed with reasons in `lib/ops/system-truth.ts`; nothing is ever dropped.
* `0110`-`0115`: `0110` reflections and cron names, `0111` the schema snapshot function, `0112` protects `profiles.role` and the Guide fields from browser edits, `0113` lets `cron_runs` record the Pink daily summary, `0114` lets Toolkit support items name all 16 registry tools, `0115` makes Guide read access to the Library follow certification and Toolkit authorization instead of the role label.
* `0116` (Move 6, Guide certification completion): adds `host_seat_experience` to the evidence vocabulary; lets `entitlements` carry the `candidacy` source (access that ends with candidacy and never touches a membership); adds `certification_applications` (apply, save a payment method with no charge, human admission decision, charge only after admission); the admin-only human evaluation records (`certification_gate_evaluations`, `certification_lab_evaluations`, `certification_practicum_evaluations`); the candidate-private AI Host practice tables (`certification_practice_sessions`, `certification_practice_messages`, no admin policy by design); and the `certification_practice_host` AI usage feature. Apply it BEFORE deploying the code that uses it. `schema_rules` fails if the privacy of these tables ever changes.
* `0117` (Move 7, Keep this): adds `kept_items` (the Host-owned continuity record; only the Host's own policies, a Host cannot forge a "came through a Guide" row, content is immutable and a Host can only take an item out or put it back) and `guide_item_offers` (a Guide's pointer-and-label offer; a Guide can create and withdraw a waiting offer, has no update policy, and sees an offer only while it waits). It also removes the `virtue signature guide write` policy, so a Guide can no longer write into a participant's Virtue Signature. Apply it BEFORE deploying the code that uses it. `schema_rules` fails if any of this privacy changes.
* `0118` (Founder reconciliation, 2026-10-04): adds `rooms.host_participant_id` (the Host owns the Room and the Table; the Guide facilitates and never owns it, so `rooms.guide_id` now means the facilitating Guide) and renames the nine Room access policies so the database no longer describes the Guide as the owner (effect unchanged). It also retires the six Virtue Signature "layers" (AI-generated, no Founder source): `virtue_signature_entries.layer` becomes nullable and its check is dropped; the column stays, unused. Both tables were empty. Apply it BEFORE deploying the code that uses it.
