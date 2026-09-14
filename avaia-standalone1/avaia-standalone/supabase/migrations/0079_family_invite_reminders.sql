-- Automation audit finding #2.5 (stalled Family Membership invite
-- reminder). Widens cron_runs (0074, 0076) to accept the new scheduled
-- job's name, and adds the same idempotency-tracking shape every other
-- reminder in this codebase already uses (host_onboarding_reminders,
-- guide_candidate_reminders, guardian_consent_reminders). No new
-- family_members status or business rule -- this only tracks when a
-- reminder was sent for a given still-'invited' row.

alter table public.cron_runs
  drop constraint if exists cron_runs_cron_name_check;

alter table public.cron_runs
  add constraint cron_runs_cron_name_check
  check (cron_name in (
    'host-onboarding', 'guide-operations', 'founder-digest',
    'entitlement-reconciliation', 'guardian-consent-reminder',
    'family-invite-reminder'
  ));

create table if not exists public.family_invite_reminders (
  id                uuid primary key default gen_random_uuid(),
  family_member_id  uuid not null references public.family_members (id) on delete cascade,
  sent_at           timestamptz not null default now()
);

create index if not exists family_invite_reminders_member_idx
  on public.family_invite_reminders (family_member_id, sent_at desc);

alter table public.family_invite_reminders enable row level security;

create policy "family invite reminders admin all"
  on public.family_invite_reminders for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
