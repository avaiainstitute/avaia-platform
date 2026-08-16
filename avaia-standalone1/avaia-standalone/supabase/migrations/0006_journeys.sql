-- Journey continuity, step 1 — explicit Journey grouping.
--
-- Today, which conversations belong to "the same Journey" is an inference
-- from timestamp proximity, computed fresh by whatever code happens to look
-- (e.g. the referral lookup in api/conversation/route.ts, which just takes
-- the most recent referral for a host+stage). This already broke once this
-- session: a Defying Grief referral was picked up by a general-program
-- InnerCompass conversation purely because it was more recent, requiring a
-- manual SQL fix. This migration makes the relationship an explicit,
-- stored fact instead of a runtime guess.
--
-- Schema only — additive, non-destructive. Every clause is skipped if it
-- already exists, safe to re-run. Historical backfill (assigning journey_id
-- to existing conversations) is a separate, reviewable script — see the
-- accompanying instructions, not run automatically here, because it touches
-- existing rows rather than only adding new structure.
--
-- Run this once against the live database (Supabase SQL editor).

create table if not exists public.journeys (
  id            uuid primary key default gen_random_uuid(),
  host_id       uuid not null references auth.users (id) on delete cascade,
  program       text not null default 'general' check (program in ('general', 'defying-grief')),
  started_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists journeys_host_idx on public.journeys (host_id, started_at);

alter table public.journeys enable row level security;

drop policy if exists "journeys are self-only" on public.journeys;
create policy "journeys are self-only"
  on public.journeys for all
  using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- Nullable and unenforced by design — a conversation whose Journey can't be
-- confidently determined (see the backfill script) stays null rather than
-- being assigned a guessed value.
alter table public.conversations
  add column if not exists journey_id uuid references public.journeys (id) on delete set null;

create index if not exists conversations_journey_idx on public.conversations (journey_id);
