-- The Pink Shoelace Foundation's minimum data layer (Automation Blueprint,
-- Phase 1). Purely additive: five new tables, four new columns on the
-- already-live contact_submissions table, zero other alter statements.
--
-- ARCHITECTURE: Option A from the Build Map -- Pink Shoelace stays exactly
-- as it is (hand-coded static HTML, no rebuild), and gets a real backend by
-- reusing AVAIA's existing Supabase project. Every table below is prefixed
-- pink_ and keyed by nothing from auth.users, on purpose: Pink Shoelace has
-- no accounts and no Hosts. These tables never reference host_id,
-- conversations, messages, or referrals, and no existing AVAIA table is
-- altered to point at them. Same project, same infrastructure, fully
-- separate namespace -- "distinguishable in the data even if they share
-- infrastructure," per the owner's own instruction.
--
-- POSTURE: every pink_ table follows the exact precedent already set by
-- contact_submissions (0010) -- RLS enabled, zero public policies. There is
-- no signed-in visitor to scope rows to (Pink Shoelace has no login), so
-- only the service-role client (server-side API routes and cron jobs, see
-- lib/supabase/admin.ts) can ever read or write these tables. Nothing here
-- is reachable from the browser.
--
-- WHAT THIS DOES NOT DO: no table here is wired to any live form yet where
-- none currently exists (see docs/PINK_INTEGRATION.md for exactly what
-- remains to activate each one), no donation/payment processor is
-- referenced, and no partnership "levels" or packages are invented --
-- pink_partnerships.stage is a relationship-tracking field, not a pricing
-- tier.

create table if not exists public.pink_contact_submissions (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  email             text not null,
  message           text not null,
  category          text not null default 'general' check (category in (
                      'general', 'partnership', 'media_press', 'volunteer_or_donate', 'other'
                    )),
  status            text not null default 'new' check (status in (
                      'new', 'acknowledged', 'in_progress', 'resolved'
                    )),
  needs_dorian      boolean not null default false,
  follow_up_needed  boolean not null default false,
  source            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.pink_contact_submissions enable row level security;

create table if not exists public.pink_participation_interest (
  id                uuid primary key default gen_random_uuid(),
  interest_type     text not null check (interest_type in (
                      'wear_shoelace', 'walk_alongside', 'honor_someone',
                      'foundation_participation', 'other'
                    )),
  name              text not null,
  email             text not null,
  note              text,
  honoree_name      text,
  status            text not null default 'new' check (status in (
                      'new', 'acknowledged', 'in_progress', 'resolved'
                    )),
  needs_dorian      boolean not null default false,
  follow_up_needed  boolean not null default false,
  source            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.pink_participation_interest enable row level security;

create table if not exists public.pink_partnerships (
  id                    uuid primary key default gen_random_uuid(),
  organization_name     text not null,
  organization_type     text check (organization_type in (
                          'school', 'business', 'hospital', 'grief_organization',
                          'community_organization', 'sports_organization', 'event', 'other'
                        )),
  contact_name           text,
  contact_email          text,
  contact_phone          text,
  relevance              text not null default 'both' check (relevance in ('pink', 'avaia', 'both')),
  how_found              text,
  stage                  text not null default 'inquiry' check (stage in (
                           'inquiry', 'in_conversation', 'active', 'paused', 'closed'
                         )),
  last_contact_at        timestamptz,
  next_follow_up_at      timestamptz,
  notes                  text,
  dorian_action_needed   boolean not null default false,
  source_contact_id      uuid references public.pink_contact_submissions (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists pink_partnerships_follow_up_idx
  on public.pink_partnerships (next_follow_up_at);

alter table public.pink_partnerships enable row level security;

create table if not exists public.pink_donor_sponsor_records (
  id             uuid primary key default gen_random_uuid(),
  donor_name     text not null,
  donor_type     text check (donor_type in ('individual', 'business_sponsor', 'organization', 'other')),
  contact_email  text,
  status         text not null default 'interest_only' check (status in (
                   'interest_only', 'pledged', 'active', 'lapsed'
                 )),
  notes          text,
  source_contact_id uuid references public.pink_contact_submissions (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.pink_donor_sponsor_records enable row level security;

alter table public.contact_submissions
  add column if not exists status text not null default 'new' check (status in (
    'new', 'acknowledged', 'in_progress', 'resolved'
  )),
  add column if not exists needs_dorian boolean not null default false,
  add column if not exists follow_up_needed boolean not null default false,
  add column if not exists resolved_at timestamptz;
