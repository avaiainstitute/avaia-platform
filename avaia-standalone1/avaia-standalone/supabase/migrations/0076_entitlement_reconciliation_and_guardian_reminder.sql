-- Automation audit findings #2.4 (Stripe <-> entitlements reconciliation)
-- and #5.3 (guardian-consent stall reminder). Widens cron_runs (0074) to
-- accept the two new scheduled jobs' names, and adds the same
-- idempotency-tracking table for guardian-consent reminders that
-- host_onboarding_reminders/guide_candidate_reminders already established
-- in 0064 -- same shape, same posture, no new pattern invented.

alter table public.cron_runs
  drop constraint if exists cron_runs_cron_name_check;

alter table public.cron_runs
  add constraint cron_runs_cron_name_check
  check (cron_name in (
    'host-onboarding', 'guide-operations', 'founder-digest',
    'entitlement-reconciliation', 'guardian-consent-reminder'
  ));

-- guardian_consent_reminders -- one row per reminder actually sent to a
-- Guide about a guardian consent that has been pending too long. Metadata
-- only: participant id, which state was pending, and when -- never any
-- Youth content, disclosure text, or the guardian's own contact details.
create table if not exists public.guardian_consent_reminders (
  id                    uuid primary key default gen_random_uuid(),
  guide_participant_id  uuid not null references public.guide_participants (id) on delete cascade,
  guide_id              uuid not null references auth.users (id) on delete cascade,
  reminder_type         text not null check (reminder_type in (
                          'consent_pending', 'assent_not_confirmed'
                        )),
  sent_at               timestamptz not null default now()
);

create index if not exists guardian_consent_reminders_participant_idx
  on public.guardian_consent_reminders (guide_participant_id, reminder_type, sent_at desc);

alter table public.guardian_consent_reminders enable row level security;

create policy "guardian consent reminders admin all"
  on public.guardian_consent_reminders for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
