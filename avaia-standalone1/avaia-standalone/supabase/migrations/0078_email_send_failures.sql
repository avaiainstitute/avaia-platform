-- Automation audit finding #1.2: centralizes email-send failure logging.
-- lib/resend.ts's sendEmail is the one chokepoint every email-sending
-- caller in this codebase already goes through; every caller already
-- wraps it in its own try/catch and swallows the failure (a deliberate,
-- consistent "never block the user" pattern) -- but until now the only
-- trace was a console.error line in Vercel's ephemeral logs. This table
-- is that trace, written once, centrally, by sendEmail itself.

create table if not exists public.email_send_failures (
  id          uuid primary key default gen_random_uuid(),
  context     text,
  error       text not null,
  created_at  timestamptz not null default now()
);

create index if not exists email_send_failures_created_idx
  on public.email_send_failures (created_at desc);

alter table public.email_send_failures enable row level security;

create policy "email send failures admin read"
  on public.email_send_failures for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- No insert/update/delete policy: only the service-role client (used by
-- sendEmail's own internal recordEmailSendFailure) ever writes here.
