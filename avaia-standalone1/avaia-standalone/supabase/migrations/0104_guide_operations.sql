-- Guide Operations Agent: the smallest additive schema change needed.
--
-- Everything the Guide Operations resolver *reads* already exists
-- (guide_certifications, guide_platform_authorizations, profiles,
-- guide_journey_access, guide_certification_decisions). No new permission
-- system and no replacement for guide_certifications.standing.
--
-- The one thing that does not already exist is a durable record of which
-- mismatches have already been notified, for the same cooldown/idempotency
-- pattern used elsewhere (guide_candidate_reminders,
-- certification_operations_exceptions). guide_candidate_reminders itself
-- was not reused: its reminder_type is CHECK-constrained to exactly
-- ('candidacy_stalled', 'paid_awaiting_decision') with a compound
-- constraint tying each type to a specific required FK -- widening it to
-- 8 unrelated post-certification mismatch types would overload a
-- pipeline-specific column with an unrelated vocabulary. This table
-- mirrors certification_operations_exceptions's shape instead, scoped to
-- host_id only (a certified Guide is not a pipeline "candidate" for this
-- purpose).

create table if not exists guide_access_exceptions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles(id) on delete cascade,
  mismatch_type text not null check (
    mismatch_type in (
      'active_certification_missing_operational_access',
      'paused_certification_active_access',
      'revoked_certification_active_access',
      'toolkit_authorization_without_active_certification',
      'journey_authorization_without_active_certification',
      'host_access_without_valid_standing',
      'role_guide_without_certification',
      'incomplete_certification_handoff'
    )
  ),
  detail text not null,
  operational_state text not null,
  sent_at timestamptz not null default now()
);

create index if not exists guide_access_exceptions_host_idx
  on guide_access_exceptions (host_id, mismatch_type, sent_at desc);

alter table guide_access_exceptions enable row level security;

-- Internal operations ledger, admin-only, single policy -- same posture as
-- certification_operations_exceptions. Guides never see this table.
create policy "guide access exceptions admin all"
  on guide_access_exceptions
  for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
