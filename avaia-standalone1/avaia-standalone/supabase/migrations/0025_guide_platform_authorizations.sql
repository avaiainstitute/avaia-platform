-- Guide platform authorization records (Phase D.1). Purely additive: one
-- new table, zero alter statements on any existing table, zero
-- application code changes required to register it.
--
-- ============================================================================
-- IMPORTANT -- CERTIFICATION AND PLATFORM AUTHORIZATION ARE SEPARATE FACTS.
--
-- guide_certifications answers: "Has AVAIA certified this person, and what
-- is the current institutional standing of that credential?"
--
-- guide_platform_authorizations answers: "What is this person currently
-- authorized by AVAIA to do?"
--
-- A person may hold an active Certified AVAIA Guide credential with zero,
-- one, or several independent platform authorizations -- or none at all.
-- This table never changes the meaning of guide_certifications.standing,
-- and guide_certifications.standing never determines this table's rows.
-- Nothing in this migration reads, writes, or references profiles.role,
-- profiles.guide_certified_at, guide_sessions, or guide_participants --
-- those remain exactly as inert/legacy/untouched as before.
--
-- The rule that a Toolkit authorization may only be GRANTED to a host with
-- an existing guide_certifications row in standing = 'active' is a
-- business rule enforced by the future admin-grant action (Phase D.2), not
-- expressed here as a schema constraint -- Postgres CHECK constraints
-- cannot reference another table, and a rule this institutionally
-- significant (re-verified fresh at grant time, the same discipline every
-- other cross-table rule in this schema already follows) belongs in
-- application code, not a trigger. This migration is the record layer
-- only.
--
-- IMPORTANT -- STATUS HERE IS DELIBERATELY MINIMAL.
--
-- `status` is a two-value authorized/revoked fact, NOT the AVAIA
-- Professional Standards' full accountability taxonomy (Development
-- Required, Restriction, Pause/Suspension, Revocation, Removal). That
-- taxonomy governs designations that don't exist as real, actionable
-- objects yet -- building it against this table now would be governance
-- over an empty set. This table is deliberately shaped so a later,
-- separately-approved Professional Standing/Accountability phase can
-- govern individual capability rows (e.g. by adding new allowed `status`
-- values, or a richer accountability layer that reads/writes these rows)
-- without requiring this model to be torn down and rebuilt.
--
-- IMPORTANT -- ONE CAPABILITY TODAY, MORE LATER, NO SCHEMA CHANGE NEEDED.
--
-- `capability` allows only 'toolkit' today. Row-per-capability (not a wide
-- table with one column per capability) means a future capability --
-- guided_journey_facilitation, evaluator, youth_facilitation, faculty, and
-- others not yet named -- is added by widening this CHECK constraint, the
-- same extensible-enum idiom already used for
-- guide_candidate_evidence.evidence_type and
-- guide_certification_decisions.decision. No new table, no wide-table
-- migration, no collapse into one professional_status field.
-- ============================================================================

create table if not exists public.guide_platform_authorizations (
  id                   uuid primary key default gen_random_uuid(),
  host_id              uuid not null references auth.users (id) on delete cascade,
  capability           text not null check (capability in ('toolkit')),
  status               text not null default 'authorized' check (status in ('authorized', 'revoked')),
  granted_by           uuid references auth.users (id) on delete set null,
  granted_at           timestamptz not null default now(),
  status_changed_by    uuid references auth.users (id) on delete set null,
  status_changed_at    timestamptz not null default now(),
  notes                text
);

-- Prevents duplicate active authorization for the same capability: at most
-- one 'authorized' row per (host_id, capability) at a time. A host may
-- still accumulate historical rows over time (revoked, later re-granted),
-- the same partial-unique-index technique already used by
-- guide_candidates_one_open_per_host (0022).
create unique index if not exists guide_platform_authorizations_one_active_idx
  on public.guide_platform_authorizations (host_id, capability)
  where status = 'authorized';

create index if not exists guide_platform_authorizations_host_idx
  on public.guide_platform_authorizations (host_id);

alter table public.guide_platform_authorizations enable row level security;

-- The authorized person may read their own authorization records --
-- proven self-read pattern, same shape as entitlements/guide_certifications.
-- No grant, revoke, or self-service authorization capability -- select only.
create policy "guide platform authorizations self read"
  on public.guide_platform_authorizations for select
  using (auth.uid() = host_id);

-- Admin manages authorization records -- same admin-all pattern used
-- throughout this schema. Ordinary users cannot grant themselves (or
-- anyone else) a professional capability; only an admin-authenticated
-- session can write this table.
create policy "guide platform authorizations admin all"
  on public.guide_platform_authorizations for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
