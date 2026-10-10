-- AVAIA DEMO DATABASE BUILD, SUPPLEMENT (run after bundle 9).
-- Production has one table that no migration file in the current repository creates: gpt_handoff_sessions (kept as history, never used by code).
-- It came from the original migration 0003_gpt_iap_handoff.sql (repository commit 4a09d69, 2026-08-06), whose file was later replaced when two branches were merged.
-- The text below is that original file, byte for byte. It was never altered afterwards.

-- GPT-IAP handoff — proof of concept. Run once against the live database
-- (Supabase SQL editor), after 0001/0002.
--
-- Purpose: a short-lived, single-use bearer token binding one Host's IAP
-- attempt to the referral that eventually comes back from the real IAP
-- custom GPT via a GPT Action. This table is the ONLY new AVAIA surface this
-- architecture needs — conversations, referrals, and everything downstream
-- (workbook, dashboard, membership, program) are untouched and populated
-- exactly as they already are.
--
-- Locked out of anon/authenticated entirely (RLS enabled, zero policies) —
-- every access to this table goes through the service-role client
-- (lib/supabase/admin.ts), the same pattern already used for the Stripe
-- webhook. The token itself is a bearer secret; nothing about who can read
-- it should depend on a client-side policy.

create table if not exists public.gpt_handoff_sessions (
  id               uuid primary key default gen_random_uuid(),
  host_id          uuid not null references auth.users (id) on delete cascade,
  stage            text not null check (stage in ('iap')),
  token            text not null unique,
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  status           text not null default 'pending' check (status in ('pending', 'used', 'expired')),
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  used_at          timestamptz
);

create index if not exists gpt_handoff_sessions_token_idx on public.gpt_handoff_sessions (token);
create index if not exists gpt_handoff_sessions_host_idx on public.gpt_handoff_sessions (host_id);

alter table public.gpt_handoff_sessions enable row level security;
-- Deliberately no policies — service-role only, by design, not omission.

select 'SUPPLEMENT FINISHED: gpt_handoff_sessions created' as build_status;
