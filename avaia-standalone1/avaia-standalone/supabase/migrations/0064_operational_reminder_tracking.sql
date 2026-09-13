-- Idempotency tracking for the two scheduled reminder jobs (Automation
-- Blueprint, Agents 6 and 7). Purely additive: two new tables, no alter
-- statements. Each table exists for one reason only -- so a cron job that
-- runs daily never sends the same person the same reminder twice. Neither
-- table stores conversation content, application material content, or any
-- Youth-linked data; both store only identifiers, a reminder-type label,
-- and a timestamp.

-- ---------------------------------------------------------------------------
-- host_onboarding_reminders -- one row per stalled-stage reminder actually
-- sent to a Host. reminder_type names which stalled state triggered it
-- (see lib/ops/host-onboarding.ts), never the content of any conversation.
-- Admin/service-role only: this is operational bookkeeping, not something
-- a Host has any reason to read themselves.
-- ---------------------------------------------------------------------------
create table if not exists public.host_onboarding_reminders (
  id             uuid primary key default gen_random_uuid(),
  host_id        uuid not null references auth.users (id) on delete cascade,
  reminder_type  text not null check (reminder_type in (
                   'iap_stalled', 'cat_eligible_no_start', 'cat_stalled', 'innercompass_stalled'
                 )),
  sent_at        timestamptz not null default now()
);

-- One reminder of a given type per Host per rolling window is enforced in
-- application code (lib/ops/host-onboarding.ts checks the most recent row
-- before sending), not by a unique index here -- a Host can legitimately
-- stall at the same stage more than once over time (e.g. resume, stall
-- again months later), and each occurrence is a real, separate event worth
-- its own row.
create index if not exists host_onboarding_reminders_host_idx
  on public.host_onboarding_reminders (host_id, reminder_type, sent_at desc);

alter table public.host_onboarding_reminders enable row level security;

create policy "host onboarding reminders admin all"
  on public.host_onboarding_reminders for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- guide_candidate_reminders -- the same idempotency pattern, for the Guide
-- Operations cron job. Deliberately a separate table from
-- guide_candidate_history (0022): history is an institutional log a Guide
-- can read about their own candidacy; this is bookkeeping for an automated
-- job, admin-only, and never surfaced to the candidate.
--
-- Two waiting states key differently, so both id columns are nullable and
-- exactly one is populated per row: 'candidacy_stalled' is about an open
-- guide_candidates row (candidate_id set); 'paid_awaiting_decision' is
-- about a guide_certification_payments fact that, per 0062's own comment,
-- never requires a guide_candidates row to exist yet (host_id set instead).
-- ---------------------------------------------------------------------------
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
