-- Host / Participant Operations Agent: the smallest additive schema change needed.
--
-- Everything this agent *reads* already exists (profiles, conversations,
-- messages metadata only, guide_participants, guide_sessions,
-- guide_journey_access, guide_certifications, guide_platform_authorizations).
-- No new lifecycle enum is added -- conversations.status and
-- guide_sessions.status remain the sole authoritative ones.
--
-- The one thing that doesn't already exist is a durable record of which
-- Host/Participant exceptions have already been notified, so the daily
-- cron can apply the same cooldown/idempotency pattern
-- certification_operations_exceptions and guide_access_exceptions already
-- use. A single table covers both subject kinds (Host journey state and
-- Guide-facilitated participant state) via subject_type, rather than two
-- near-identical tables, since both share the exact same exception
-- vocabulary and admin-only read pattern.

create table if not exists host_participant_operations_exceptions (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('host', 'guide_participant')),
  subject_id uuid not null,
  category text not null check (
    category in ('MISSING', 'WAITING', 'STALE', 'MISMATCH', 'FAILED', 'HUMAN_DECISION_REQUIRED', 'POLICY_REQUIRED')
  ),
  detail text not null,
  operational_state text not null,
  sent_at timestamptz not null default now()
);

create index if not exists host_participant_operations_exceptions_subject_idx
  on host_participant_operations_exceptions (subject_type, subject_id, category, sent_at desc);

alter table host_participant_operations_exceptions enable row level security;

-- Internal operations ledger, like certification_operations_exceptions and
-- guide_access_exceptions: admin-only, single policy. Hosts and Guides
-- never see exception tracking -- only AVAIA admin, via the admin view.
create policy "host participant operations exceptions admin all"
  on host_participant_operations_exceptions
  for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
