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
