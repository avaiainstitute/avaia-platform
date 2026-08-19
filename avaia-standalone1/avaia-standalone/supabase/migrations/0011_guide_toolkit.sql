-- AVAIA Guide Toolkit — first build.
--
-- Adds the Guide role (same pattern already used for profiles.role, and the
-- same superset-friendly approach the unmerged `library` branch used to add
-- 'admin' — this migration only adds 'guide', not 'admin', since nothing on
-- this branch uses an admin role yet) plus the lightweight participant/
-- session model that lets a Guide facilitate a canonical AVAIA tool for
-- someone who has never created an AVAIA account, while still allowing that
-- participant to be linked to a real Host account when one exists.
--
-- Deliberately does NOT touch conversations, messages, referrals, journeys,
-- or any frozen-engine table. A Guide-facilitated conversation is still an
-- ordinary row in those tables (host_id = the Guide's own account) — see
-- lib/guide.ts for how the two layers connect.

alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
    check (role in ('member', 'community_leader', 'guide'));

alter table public.profiles
  add column if not exists guide_certified_at timestamptz;

-- ---------------------------------------------------------------------------
-- guide_participants — a person a Guide is working with. No AVAIA account
-- required. `linked_host_id` is set at creation time only if an existing
-- AVAIA account is found for the given email (see the participant-creation
-- action) — this migration does not add any later auto-linking trigger;
-- that's a deliberate, separate future step, not required for this build.
-- ---------------------------------------------------------------------------
create table if not exists public.guide_participants (
  id              uuid primary key default gen_random_uuid(),
  guide_id        uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  email           text,
  linked_host_id  uuid references auth.users (id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists guide_participants_guide_idx
  on public.guide_participants (guide_id, created_at);

alter table public.guide_participants enable row level security;
create policy "guide participants are owner-only"
  on public.guide_participants for all
  using (auth.uid() = guide_id) with check (auth.uid() = guide_id);

-- ---------------------------------------------------------------------------
-- guide_sessions — one Guide-facilitated instance of a canonical tool with a
-- participant. `conversation_id` links to the real engine-side conversation
-- once one exists (null until the Guide actually begins). `tool` uses the
-- complete canonical registry (see lib/toolkit.ts) even though only 'iap'
-- has an installed route in this build -- the vocabulary is meant to be
-- complete from the start, per the approved build direction.
-- ---------------------------------------------------------------------------
create table if not exists public.guide_sessions (
  id               uuid primary key default gen_random_uuid(),
  guide_id         uuid not null references auth.users (id) on delete cascade,
  participant_id   uuid references public.guide_participants (id) on delete set null,
  tool             text not null check (tool in (
                      'preparation', 'iap', 'cat', 'innercompass',
                      'secondary-loss', 'chemistry', 'table-formation',
                      'council', 'give', 'defying-grief', 'unsung-heroes',
                      'library', 'youth-group'
                    )),
  conversation_id  uuid references public.conversations (id) on delete set null,
  status           text not null default 'active' check (status in ('active', 'complete')),
  created_at       timestamptz not null default now()
);

create index if not exists guide_sessions_guide_idx
  on public.guide_sessions (guide_id, created_at);

alter table public.guide_sessions enable row level security;
create policy "guide sessions are owner-only"
  on public.guide_sessions for all
  using (auth.uid() = guide_id) with check (auth.uid() = guide_id);
