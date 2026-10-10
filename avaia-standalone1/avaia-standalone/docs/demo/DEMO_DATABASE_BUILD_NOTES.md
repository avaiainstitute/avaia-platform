# Demo database build: what the bundles are, and why

The demo runs on its own Supabase project (`avaia-demo`). Its database is built to be an exact structural twin of Production's. This note
explains how, and the findings made along the way. No secrets are in this file or in any file it mentions.

## The bundles replay history, they do not run today's `schema.sql`

Production was **not** built by running today's `supabase/schema.sql` and then every migration. Today's `schema.sql` is a fresh-install
reference that was kept up to date by hand, so it already contains most of what the migrations add. Running both makes the database try to
create the same objects twice, and it also refers to some tables (`shared_access`, `entitlements`, `family_members`) before it creates them.
Two build attempts stopped on exactly those problems.

Production was built the other way: the **original** `schema.sql` (repository commit `0daeb87`, 2026-07-25: five tables), then each migration
in order. `supabase/demo/make_demo_bundles.sh` rebuilds that sequence from the repository's history: the original schema file, then the 110
migration files in numeric order, unmodified, grouped into nine bundle files of about 100 KB so each fits the Supabase SQL editor.

Checked statically across the whole sequence: no table is used before it exists, and no object is created twice without a drop in between.

## The one change to a committed file's text

In migration `0007_journeys_backfill.sql` one comment marker (`--`) had been turned into a comma by the site-wide punctuation cleanup of
2026-09-10 (commit `307ba01`). That is a syntax error on a fresh database. Production was built before that commit, so it was never affected.
The generator restores the original ` -- ` on that single line, in the generated bundle only. The repository file is not edited.

## Two demo-only adjustments after the bundles (to match Production exactly)

1. `supabase/demo/bundle_supplement_gpt_handoff_sessions.sql`. Production has one table, `gpt_handoff_sessions` (history from the early GPT
   handoff proof of concept, kept and unused), that no migration file in today's repository creates. Its file was lost when two branches were
   merged. The supplement is the original migration `0003_gpt_iap_handoff.sql` from commit `4a09d69`, byte for byte.
2. `supabase/demo/demo_align_with_production.sql`. Migration `0029_guide_journey_read_access.sql` creates four rules that let a Guide read a
   Host's journeys, conversations, messages and referrals directly. **Production does not have them** (verified on 2026-10-09 by listing
   Production's rules on those four tables). The demo must match Production, so those four rules are dropped in the demo database only. The
   script refuses to run in any database that has user accounts.

## Findings for the Founder (not fixed in Production or in the migration files)

- Today's `schema.sql` cannot be run on a fresh database (damaged comment markers from commit `307ba01`, forward references, and
  duplication with the migrations).
- Migration `0029`'s four "guide read" rules exist in the repository but not in the live database.
- Migration files `0104` to `0109` were restored on 2026-10-09 (history repair); migrations `0110` to `0125` are not in Supabase's own
  migration-history table. The demo build did not touch that table either.

## How equality with Production is proven

Run `demo_schema_parity_check.sql` (109 tables, 56 columns, 11 functions, row level security on every table) and
`demo_snapshot_fingerprint.sql` in both projects. On 2026-10-09 Production returned the fingerprint
`73d1519d51af243bb410d5f36c410a7b` with 132 tables, 1280 columns, 32 functions, 203 policies, 17 triggers and 260 check constraints, and the
finished demo database returned the identical values.
