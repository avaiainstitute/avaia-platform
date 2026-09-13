-- Idempotency tracking for the two scheduled reminder jobs (Automation
-- Blueprint, Agents 6 and 7). Purely additive: two new tables, no alter
-- statements.

create table if not exists public.host_onboarding_reminders (
  id             uuid primary key default gen_random_uuid(),
  host_id        uuid not null references auth.users (id) on delete cascade,
  reminder_type  text not null check (reminder_type in (
                   'iap_stalled', 'cat_eligible_no_start', 'cat_stalled', 'innercompass_stalled'
                 )),
  sent_at        timestamptz not null default now()
);

create index if not exists host_onboarding_reminders_host_idx
  on public.host_onboarding_reminders (host_id, reminder_type, sent_at desc);

alter table public.host_onboarding_reminders enable row level security;

create policy "host onboarding reminders admin all"
  on public.host_onboarding_reminders for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.guide_candidate_reminders (
  id             uuid primary key default gen_random_uuid(),
  candidate_id   uuid references public.guide_candidates (id) on delete cascade,
  host_id        uuid references auth.users (id) on delete cascade,
  reminder_type  text not null check (reminder_type in (
                   'candidacy_stalled', 'paid_awaiting_decision'
                 )),
  sent_at        timestamptz not null default now(),
  constraint guide_candidate_reminders_key_matches_type check (
    (reminder_type = 'candidacy_stalled' and candidate_id is not null)
    or
    (reminder_type = 'paid_awaiting_decision' and host_id is not null)
  )
);

create index if not exists guide_candidate_reminders_candidate_idx
  on public.guide_candidate_reminders (candidate_id, reminder_type, sent_at desc);
create index if not exists guide_candidate_reminders_host_idx
  on public.guide_candidate_reminders (host_id, reminder_type, sent_at desc);

alter table public.guide_candidate_reminders enable row level security;

create policy "guide candidate reminders admin all"
  on public.guide_candidate_reminders for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
