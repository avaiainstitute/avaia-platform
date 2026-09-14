-- Automation audit finding #1 (cron/notification silent-failure hardening).
-- Each of the three scheduled /api/cron/* routes now records its own
-- outcome here (success/partial/error) instead of leaving Vercel's ephemeral
-- function logs as the only trace. This does not replace real monitoring
-- (nothing external pings this app to confirm a cron ran at all -- if a
-- cron never fires, there is still no row here to notice), but it turns
-- "the cron ran and errored" or "the cron ran and some sends failed" from
-- invisible into something the founder digest can read and report on.

create table if not exists public.cron_runs (
  id           uuid primary key default gen_random_uuid(),
  cron_name    text not null check (cron_name in (
                 'host-onboarding', 'guide-operations', 'founder-digest'
               )),
  started_at   timestamptz not null,
  finished_at  timestamptz not null default now(),
  status       text not null check (status in ('success', 'partial', 'error')),
  detail       jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists cron_runs_name_started_idx
  on public.cron_runs (cron_name, started_at desc);

alter table public.cron_runs enable row level security;

create policy "cron runs admin read"
  on public.cron_runs for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- No insert/update/delete policy: only the service-role client (used
-- exclusively by the cron routes themselves) ever writes here, matching the
-- posture already established for host_onboarding_reminders/
-- guide_candidate_reminders in 0064.
