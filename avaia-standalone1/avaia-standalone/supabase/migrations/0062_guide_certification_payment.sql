-- Certified AVAIA Guide -- $4,500 program payment record. A payment fact
-- ONLY: it does not create, and must never be read as, a guide_candidates
-- row or any other candidacy/certification fact. Whether a completed
-- payment should automatically admit someone as a candidate is an explicit
-- owner decision, not assumed here -- see the Final Report. Pay-in-full
-- only; no installment schedule is built, per explicit instruction not to
-- invent one.
create table if not exists public.guide_certification_payments (
  id                          uuid primary key default gen_random_uuid(),
  host_id                     uuid not null references auth.users (id) on delete cascade,
  stripe_checkout_session_id  text not null unique,
  stripe_payment_intent_id    text,
  amount_cents                integer not null,
  currency                    text not null default 'usd',
  paid_at                     timestamptz not null default now()
);

create index if not exists guide_certification_payments_host_idx
  on public.guide_certification_payments (host_id);

alter table public.guide_certification_payments enable row level security;

create policy "guide certification payments self read"
  on public.guide_certification_payments for select
  using (auth.uid() = host_id);

create policy "guide certification payments admin all"
  on public.guide_certification_payments for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
