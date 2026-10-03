-- Certification Operations Agent: the smallest additive schema change needed.
--
-- Everything the Operations Agent *reads* already exists (guide_candidates,
-- guide_candidate_evidence, guide_certification_decisions, guide_certifications,
-- guide_platform_authorizations, profiles, certification_candidate_progress,
-- certification_curriculum_items, guide_candidate_history). No new lifecycle
-- enum is added; guide_candidates.status remains the sole authoritative one.
--
-- The one thing that does not already exist anywhere is a durable record of
-- *which exceptions have already been notified*, so the daily cron can apply
-- the same cooldown/idempotency pattern guide_candidate_reminders already
-- uses (see lib/ops/guide-operations.ts). guide_candidate_reminders itself
-- was not reused because its reminder_type vocabulary is specific to
-- candidate-facing stall reminders, not admin-facing exception categories --
-- reusing it would mean overloading one column with two unrelated meanings.
-- This table mirrors its shape exactly otherwise.

create table if not exists certification_operations_exceptions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references guide_candidates(id) on delete cascade,
  host_id uuid not null references profiles(id) on delete cascade,
  category text not null check (
    category in ('MISSING', 'WAITING', 'STALE', 'MISMATCH', 'FAILED', 'HUMAN_DECISION_REQUIRED', 'POLICY_REQUIRED')
  ),
  detail text not null,
  derived_state text not null,
  sent_at timestamptz not null default now()
);

create index if not exists certification_operations_exceptions_candidate_idx
  on certification_operations_exceptions (candidate_id, category, sent_at desc);

alter table certification_operations_exceptions enable row level security;

-- Internal operations ledger, like guide_candidate_reminders: admin-only,
-- single policy, no candidate self-read. Candidates never see exception
-- tracking -- they only ever see their own lifecycle status and, separately,
-- whatever the Companion already surfaces to them.
create policy "certification operations exceptions admin all"
  on certification_operations_exceptions
  for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
