-- AVAIA Guide Toolkit — expansion pass (CAT/InnerCompass, Unsung Heroes,
-- Library).
--
-- 1. guide_sessions.conversation_id was created with a foreign key to
--    public.conversations only. Unsung Heroes conversations live in a
--    separate table (unsung_heroes_conversations, its own engine, its own
--    frozen tables) -- a single FK column can't reference either table
--    depending on `tool`. Dropping the FK; the actual table to query is
--    always determined by `tool` in application code (lib/guide.ts), and
--    RLS (owner-only on guide_sessions itself) is unaffected either way.
alter table public.guide_sessions
  drop constraint if exists guide_sessions_conversation_id_fkey;

-- 1b. `program` -- which of the two AVAIA programs (general / defying-grief)
-- an 'iap' session should create its conversation under. Only meaningful
-- for 'iap' sessions (where the Guide is choosing where to start); CAT/
-- InnerCompass sessions are always a handoff from an existing conversation,
-- which already carries its own program forward.
alter table public.guide_sessions
  add column if not exists program text not null default 'general'
    check (program in ('general', 'defying-grief'));

-- 2. 'admin' role, for the Library port below -- same pattern as 'guide',
-- and the exact value the unmerged `library` branch already used, so
-- nothing here needs to be renamed if that branch's admin UI is ported
-- later.
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
    check (role in ('member', 'community_leader', 'guide', 'admin'));

-- ---------------------------------------------------------------------------
-- library_entries — ported from the unmerged `library` branch's
-- 0002_library.sql, unchanged in shape. library_suggestions and the admin
-- CRUD/suggestion-review UI are NOT ported in this pass -- this is the data
-- layer plus a read-only Guide browse view, not the full content-management
-- tooling; that remains a separate, later step.
-- ---------------------------------------------------------------------------
create table if not exists public.library_entries (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  great_idea            text not null,
  overview              text not null,
  virtues               jsonb not null default '[]',
  secondary_losses      text[] not null default '{}',
  journey_stages        text[] not null default '{}'
                          check (journey_stages <@ array['iap', 'cat', 'innercompass']),
  programs              text[] not null default '{}'
                          check (programs <@ array['general', 'defying-grief']),
  content_type          text not null check (content_type in ('avaia-owned', 'external-resource')),
  body                  text,
  external_url          text,
  external_author       text,
  external_description  text,
  status                text not null default 'draft'
                          check (status in ('draft', 'published', 'archived')),
  visibility            text not null default 'member'
                          check (visibility in ('public', 'member')),
  tags                  text[] not null default '{}',
  editor_id             uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists library_entries_status_visibility_idx
  on public.library_entries (status, visibility);
create index if not exists library_entries_virtues_idx on public.library_entries using gin (virtues);
create index if not exists library_entries_secondary_losses_idx on public.library_entries using gin (secondary_losses);
create index if not exists library_entries_programs_idx on public.library_entries using gin (programs);
create index if not exists library_entries_tags_idx on public.library_entries using gin (tags);

alter table public.library_entries enable row level security;

create policy "library entries public read"
  on public.library_entries for select
  using (status = 'published' and visibility = 'public');

create policy "library entries member read"
  on public.library_entries for select
  using (
    status = 'published' and visibility = 'member'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.membership_status = 'member')
  );

-- New in this port: a certified Guide sees published entries regardless of
-- visibility tier, independent of their own personal membership_status --
-- consistent with Guide access being independent of membership everywhere
-- else in this build.
create policy "library entries guide read"
  on public.library_entries for select
  using (
    status = 'published'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'guide')
  );

create policy "library entries admin all"
  on public.library_entries for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
