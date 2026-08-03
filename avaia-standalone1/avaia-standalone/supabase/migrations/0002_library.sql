-- AVAIA Library — schema addition, run once against the live database
-- (Supabase SQL editor), after 0001_membership_status.sql. Safe to re-run:
-- every clause is skipped if it already exists.
--
-- profiles.role is added fresh here (this branch does not include the
-- Unsung Heroes branch's commits) but uses the SAME column name and a
-- superset of values ('member' | 'community_leader' | 'admin') so the two
-- branches stay compatible when both eventually merge.

alter table public.profiles
  add column if not exists role text not null default 'member'
    check (role in ('member', 'community_leader', 'admin'));

-- ---------------------------------------------------------------------------
-- library_entries — the AVAIA Library. Only admin accounts (profiles.role =
-- 'admin') may create, edit, publish, or archive; visibility for everyone
-- else is entirely status/visibility driven (see RLS below).
-- ---------------------------------------------------------------------------
create table if not exists public.library_entries (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  great_idea            text not null,   -- the central subject / "Great Idea"
  overview              text not null,
  -- Array of {family, element} objects — element is nullable when only the
  -- family is relevant. family/element values are validated at the
  -- application layer against lib/virtues.ts, the same pattern used for
  -- recognitions.virtue_name on the unsung-heroes branch.
  virtues               jsonb not null default '[]',
  -- Secondary Loss names (lib/institution.ts SECONDARY_LOSSES) — validated
  -- app-side, not constrained here (kept as plain strings, like tags).
  secondary_losses      text[] not null default '{}',
  journey_stages        text[] not null default '{}'
                          check (journey_stages <@ array['iap', 'cat', 'innercompass']),
  programs              text[] not null default '{}'
                          check (programs <@ array['general', 'defying-grief']),
  content_type          text not null check (content_type in ('avaia-owned', 'external-resource')),
  body                  text,               -- AVAIA-owned content
  external_url          text,               -- external resource fields
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

-- Published + public: visible to everyone, including signed-out visitors.
create policy "library entries public read"
  on public.library_entries for select
  using (status = 'published' and visibility = 'public');

-- Published + member: visible to signed-in members.
create policy "library entries member read"
  on public.library_entries for select
  using (
    status = 'published' and visibility = 'member'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.membership_status = 'member'
    )
  );

-- Admins can read/write everything, including drafts and archived entries.
create policy "library entries admin all"
  on public.library_entries for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- library_suggestions — signed-in Hosts of any role may submit a resource
-- suggestion. Suggestions never auto-publish; only an admin reviewing the
-- queue can approve (which creates a real library_entries draft) or reject.
-- ---------------------------------------------------------------------------
create table if not exists public.library_suggestions (
  id                        uuid primary key default gen_random_uuid(),
  submitted_by              uuid not null references auth.users (id) on delete cascade,
  title                     text not null,
  author                    text,
  link                      text,
  description               text,
  why_relevant              text not null,
  suggested_virtue_family   text,
  suggested_virtue_name     text,
  suggested_secondary_loss  text,
  suggested_program         text,
  status                    text not null default 'pending'
                              check (status in ('pending', 'approved', 'rejected')),
  reviewed_by               uuid references auth.users (id) on delete set null,
  reviewed_at               timestamptz,
  review_notes              text,
  created_at                timestamptz not null default now()
);

create index if not exists library_suggestions_status_idx on public.library_suggestions (status, created_at);

alter table public.library_suggestions enable row level security;

create policy "library suggestions insert as self"
  on public.library_suggestions for insert
  with check (auth.uid() = submitted_by);

create policy "library suggestions read own or admin"
  on public.library_suggestions for select
  using (
    auth.uid() = submitted_by
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "library suggestions admin review"
  on public.library_suggestions for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
