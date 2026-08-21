-- AVAIA Living Library — Phase 1: Host continuity layer only.
--
-- library_entries already exists (0012_guide_toolkit_expansion.sql) and
-- needs no schema change for Phase 1 -- its existing virtues/
-- secondary_losses/programs/journey_stages/tags columns already cover
-- every connection Phase 1 needs. This migration adds exactly one new
-- table: the Host's own, private relationship to a Library Entry
-- (explored / saved / dismissed / noted). One row per (host, entry) -- a
-- current-state relationship, not an event log, matching "My Library
-- represents what the Host explicitly chose to keep," not a duplicate
-- content repository.

create table if not exists public.library_host_entries (
  id                uuid primary key default gen_random_uuid(),
  host_id           uuid not null references auth.users (id) on delete cascade,
  library_entry_id  uuid not null references public.library_entries (id) on delete cascade,
  -- Set once, the first time the Host opens this entry's detail page.
  -- Never cleared. Independent of `state` below -- exploring and later
  -- saving or dismissing are two different, both-true facts.
  explored_at       timestamptz,
  -- The Host's current explicit choice about this entry, if any. Null
  -- means "opened it, no explicit decision yet" -- a legitimate state, not
  -- an omission. Mutually exclusive and freely reversible (choosing one
  -- clears the other; choosing the same one again clears it back to null).
  state             text check (state in ('save', 'not_for_me')),
  -- Host-authored, stored verbatim. Never rewritten by anything else.
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (host_id, library_entry_id)
);

create index if not exists library_host_entries_host_idx
  on public.library_host_entries (host_id, updated_at);

alter table public.library_host_entries enable row level security;
create policy "library host entries are owner-only"
  on public.library_host_entries for all
  using (auth.uid() = host_id) with check (auth.uid() = host_id);
