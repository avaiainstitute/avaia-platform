-- AVAIA conversation engine — Supabase schema (the Workbook).
--
-- Run in the AVAIA Supabase project's SQL editor. Every table is protected by
-- Row-Level Security: a Host can only ever read or write their own rows
-- (host_id = auth.uid()). Sensitive personal content lives here, so RLS is the
-- backbone of the privacy model — nothing is exposed cross-Host.
--
-- Auth is Supabase magic-link (email). auth.users is managed by Supabase; we
-- keep an app-level profile keyed to it.

-- ---------------------------------------------------------------------------
-- profiles — one row per Host, with consent + eligibility record
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  consent_at          timestamptz,           -- when the Host accepted the disclaimer
  disclaimer_version  text,                  -- which disclaimer they accepted
  adult_confirmed     boolean not null default false,
  minor_with_guardian boolean not null default false,
  membership_status   text not null default 'free' check (membership_status in ('free', 'member')),
  role                text not null default 'member' check (role in ('member', 'community_leader', 'admin')),
  created_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are self-only (select)"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles are self-only (insert)"
  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles are self-only (update)"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a bare profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- conversations — one row per stage the Host walks (iap / cat / innercompass)
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  host_id       uuid not null references auth.users (id) on delete cascade,
  stage         text not null check (stage in ('iap', 'cat', 'innercompass')),
  status        text not null default 'active' check (status in ('active', 'complete')),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists conversations_host_idx on public.conversations (host_id, created_at);

alter table public.conversations enable row level security;
create policy "conversations are self-only"
  on public.conversations for all
  using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- ---------------------------------------------------------------------------
-- messages — every Host + Guide turn (this IS the Workbook conversation record)
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  host_id          uuid not null references auth.users (id) on delete cascade,
  role             text not null check (role in ('host', 'guide')),
  content          text not null,
  created_at       timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;
create policy "messages are self-only"
  on public.messages for all
  using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- ---------------------------------------------------------------------------
-- referrals — the AVAIA Standard Referral that carries between stages
-- ---------------------------------------------------------------------------
create table if not exists public.referrals (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null references auth.users (id) on delete cascade,
  from_stage   text not null,
  to_stage     text not null,
  content      jsonb not null,   -- structured referral fields (Host Overview, Identity Threads, ...)
  created_at   timestamptz not null default now()
);

create index if not exists referrals_host_idx on public.referrals (host_id, created_at);

alter table public.referrals enable row level security;
create policy "referrals are self-only"
  on public.referrals for all
  using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- ---------------------------------------------------------------------------
-- crisis_events — anonymous-count oversight of when the safety net fires.
-- No conversation text is stored here (privacy); only that it happened.
-- ---------------------------------------------------------------------------
create table if not exists public.crisis_events (
  id               uuid primary key default gen_random_uuid(),
  host_id          uuid references auth.users (id) on delete set null,
  conversation_id  uuid references public.conversations (id) on delete set null,
  created_at       timestamptz not null default now()
);

alter table public.crisis_events enable row level security;
-- A Host may insert their own crisis event; reads are reserved for admin/service role.
create policy "crisis insert self"
  on public.crisis_events for insert with check (auth.uid() = host_id);

-- ---------------------------------------------------------------------------
-- AVAIA Library — see supabase/migrations/0002_library.sql for full
-- commentary; kept in sync here for fresh installs.
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
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.membership_status = 'member'
    )
  );

create policy "library entries admin all"
  on public.library_entries for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

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
