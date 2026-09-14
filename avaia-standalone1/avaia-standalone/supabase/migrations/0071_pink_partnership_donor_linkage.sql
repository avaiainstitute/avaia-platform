-- Pink Shoelace Automation, Phase 4 (Agents 3 & 4: Partnership, Donor &
-- Sponsor). Purely additive: two new columns on the already-live
-- pink_donor_sponsor_records table, plus two partial unique indexes that
-- make automatic record-creation from a classified contact submission
-- idempotent (source_contact_id already existed as a nullable FK on both
-- tables since 0063; this is the first migration to actually rely on it
-- for de-duplication).
--
-- pink_donor_sponsor_records gains dorian_action_needed and
-- next_follow_up_at -- the exact same columns and meaning pink_partnerships
-- already has (0063), not a new concept, just extending the identical
-- follow-up-tracking shape to the sibling table so both surface through
-- the founder digest the same way. Still no donation/payment processor is
-- referenced or implied here; see docs/PINK_INTEGRATION.md.

alter table public.pink_donor_sponsor_records
  add column if not exists dorian_action_needed boolean not null default false,
  add column if not exists next_follow_up_at timestamptz;

create index if not exists pink_donor_sponsor_records_follow_up_idx
  on public.pink_donor_sponsor_records (next_follow_up_at);

-- A given contact submission opens at most one downstream partnership
-- record and at most one downstream donor/sponsor record. Application code
-- (lib/pink/linking.ts) relies on this to catch Postgres error 23505 and
-- treat a retried/duplicate submission as a no-op -- the same idempotency
-- pattern already used throughout this schema (e.g.
-- guide_certification_payments.stripe_checkout_session_id).
create unique index if not exists pink_partnerships_source_contact_unique
  on public.pink_partnerships (source_contact_id)
  where source_contact_id is not null;

create unique index if not exists pink_donor_sponsor_records_source_contact_unique
  on public.pink_donor_sponsor_records (source_contact_id)
  where source_contact_id is not null;
