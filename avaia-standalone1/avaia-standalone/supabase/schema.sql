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
  role                text not null default 'member' check (role in ('member', 'community_leader')),
  created_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are self-only (select)"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles are self-only (insert)"
  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles are self-only (update)"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a bare profile row when a new auth user signs up, and convert
-- any pending Workbook-sharing invites (see shared_access_invites near the
-- end of this file) addressed to this email into real grants.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;

  insert into public.shared_access (owner_id, shared_with_id, scope, conversation_id, granted_at)
  select owner_id, new.id, scope, conversation_id, now()
  from public.shared_access_invites
  where lower(invited_email) = lower(new.email)
    and accepted_at is null;

  update public.shared_access_invites
  set accepted_at = now()
  where lower(invited_email) = lower(new.email)
    and accepted_at is null;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- journeys — explicit grouping of one Host's IAP -> CAT -> InnerCompass
-- conversations into a single Journey. Previously an inference from
-- timestamp proximity; that broke once (a Defying Grief referral picked up
-- by an unrelated general-program InnerCompass conversation purely because
-- it was more recent). journey_id below makes the relationship a stored
-- fact. Nullable/unenforced on conversations by design: a conversation
-- whose Journey can't be confidently determined stays unresolved rather
-- than guessed.
-- ---------------------------------------------------------------------------
create table if not exists public.journeys (
  id            uuid primary key default gen_random_uuid(),
  host_id       uuid not null references auth.users (id) on delete cascade,
  program       text not null default 'general' check (program in ('general', 'defying-grief')),
  started_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists journeys_host_idx on public.journeys (host_id, started_at);

alter table public.journeys enable row level security;
create policy "journeys are self-only"
  on public.journeys for all
  using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- ---------------------------------------------------------------------------
-- conversations — one row per stage the Host walks (iap / cat / innercompass)
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  host_id       uuid not null references auth.users (id) on delete cascade,
  stage         text not null check (stage in ('iap', 'cat', 'innercompass')),
  status        text not null default 'active' check (status in ('active', 'complete')),
  -- Which program this conversation belongs to. A label for scoping queries
  -- (e.g. Defying Grief's dashboard), not a continuity mechanism — Room
  -- Identity/referral content/completion state all still live entirely in
  -- this table and referrals, keyed by conversation_id as they always have.
  program       text not null default 'general' check (program in ('general', 'defying-grief')),
  -- Explicit Journey this conversation belongs to — see journeys above.
  journey_id    uuid references public.journeys (id) on delete set null,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists conversations_host_idx on public.conversations (host_id, created_at);
create index if not exists conversations_journey_idx on public.conversations (journey_id);

alter table public.conversations enable row level security;
create policy "conversations are self-only"
  on public.conversations for all
  using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- Read-only extension for Workbook sharing (see shared_access near the end
-- of this file) — never changes who can write.
create policy "conversations shared read"
  on public.conversations for select
  using (
    exists (
      select 1 from public.shared_access sa
      where sa.shared_with_id = auth.uid()
        and sa.revoked_at is null
        and sa.owner_id = conversations.host_id
        and (
          sa.scope = 'workbook'
          or (sa.scope = 'conversation' and sa.conversation_id = conversations.id)
        )
    )
  );

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

create policy "messages shared read"
  on public.messages for select
  using (
    exists (
      select 1 from public.shared_access sa
      join public.conversations c on c.id = messages.conversation_id
      where sa.shared_with_id = auth.uid()
        and sa.revoked_at is null
        and sa.owner_id = c.host_id
        and (
          sa.scope = 'workbook'
          or (sa.scope = 'conversation' and sa.conversation_id = messages.conversation_id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- referrals — the AVAIA Standard Referral that carries between stages
-- ---------------------------------------------------------------------------
create table if not exists public.referrals (
  id               uuid primary key default gen_random_uuid(),
  host_id          uuid not null references auth.users (id) on delete cascade,
  from_stage       text not null,
  to_stage         text not null,
  content          jsonb not null,   -- structured referral fields (Host Overview, Identity Threads, ...)
  -- Which conversation this referral closed out of. Nullable because it
  -- pre-dates this column; without it, a 'conversation'-scope Workbook share
  -- can't identify which single referral belongs to that conversation.
  -- Unique (see migration 0008): at most one referral per conversation --
  -- the backstop that makes generateReferral() safe against two
  -- near-simultaneous completion signals (e.g. a typed request and a
  -- button click) producing two referrals for the same handoff.
  conversation_id  uuid references public.conversations (id) on delete set null unique,
  created_at       timestamptz not null default now()
);

create index if not exists referrals_host_idx on public.referrals (host_id, created_at);

alter table public.referrals enable row level security;
create policy "referrals are self-only"
  on public.referrals for all
  using (auth.uid() = host_id) with check (auth.uid() = host_id);

create policy "referrals shared read"
  on public.referrals for select
  using (
    exists (
      select 1 from public.shared_access sa
      where sa.shared_with_id = auth.uid()
        and sa.revoked_at is null
        and sa.owner_id = referrals.host_id
        and (
          sa.scope = 'workbook'
          or (sa.scope in ('conversation', 'referral') and sa.conversation_id = referrals.conversation_id)
        )
    )
  );

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
-- Workbook sharing — see supabase/migrations/0002_workbook_sharing.sql for
-- full commentary; kept in sync here for fresh installs.
-- ---------------------------------------------------------------------------

create table if not exists public.shared_access (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users (id) on delete cascade,
  shared_with_id   uuid not null references auth.users (id) on delete cascade,
  scope            text not null check (scope in ('conversation', 'workbook', 'referral')),
  conversation_id  uuid references public.conversations (id) on delete cascade,
  granted_at       timestamptz not null default now(),
  revoked_at       timestamptz,
  constraint shared_access_scope_shape check (
    (scope in ('conversation', 'referral') and conversation_id is not null)
    or (scope = 'workbook' and conversation_id is null)
  )
);

create index if not exists shared_access_owner_idx on public.shared_access (owner_id);
create index if not exists shared_access_shared_with_idx on public.shared_access (shared_with_id);

alter table public.shared_access enable row level security;

create policy "shared_access owner manage"
  on public.shared_access for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "shared_access recipient read"
  on public.shared_access for select
  using (auth.uid() = shared_with_id);

create table if not exists public.shared_access_invites (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users (id) on delete cascade,
  invited_email    text not null,
  scope            text not null check (scope in ('conversation', 'workbook', 'referral')),
  conversation_id  uuid references public.conversations (id) on delete cascade,
  invited_at       timestamptz not null default now(),
  accepted_at      timestamptz,
  constraint shared_access_invites_scope_shape check (
    (scope in ('conversation', 'referral') and conversation_id is not null)
    or (scope = 'workbook' and conversation_id is null)
  )
);

create index if not exists shared_access_invites_owner_idx on public.shared_access_invites (owner_id);
create index if not exists shared_access_invites_email_idx on public.shared_access_invites (invited_email);

alter table public.shared_access_invites enable row level security;

create policy "shared_access_invites owner manage"
  on public.shared_access_invites for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- GPT IAP workshop OAuth — see supabase/migrations/0004_gpt_iap_workshop.sql
-- for full commentary; kept in sync here for fresh installs. Both tables are
-- service-role only (RLS enabled, zero policies) -- the real IAP custom
-- GPT's Action is the only client.
-- ---------------------------------------------------------------------------

create table if not exists public.oauth_authorization_codes (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  host_id          uuid not null references auth.users (id) on delete cascade,
  client_id        text not null,
  redirect_uri     text not null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  used_at          timestamptz
);

create index if not exists oauth_authorization_codes_code_idx on public.oauth_authorization_codes (code);

alter table public.oauth_authorization_codes enable row level security;

create table if not exists public.oauth_access_tokens (
  id               uuid primary key default gen_random_uuid(),
  access_token     text not null unique,
  host_id          uuid not null references auth.users (id) on delete cascade,
  client_id        text not null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz,
  revoked_at       timestamptz
);

create index if not exists oauth_access_tokens_token_idx on public.oauth_access_tokens (access_token);
create index if not exists oauth_access_tokens_host_idx on public.oauth_access_tokens (host_id);

alter table public.oauth_access_tokens enable row level security;

-- ---------------------------------------------------------------------------
-- Unsung Heroes — a separate program from the core Journey (IAP/CAT/
-- InnerCompass). See supabase/migrations/0005_unsung_heroes.sql for the full
-- commentary; virtue recognition is the front door, acknowledgment is the
-- reason underneath it. Kept in sync here for fresh installs.
-- ---------------------------------------------------------------------------

create table if not exists public.community_contacts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  contact_role          text not null check (contact_role in (
                            'teacher', 'school_admin', 'guardian',
                            'business_contact', 'community_leader'
                          )),
  school                text,
  organization          text,
  guardian_of_name      text,
  guardian_of_user_id   uuid references auth.users (id) on delete cascade,
  created_at            timestamptz not null default now()
);

create index if not exists community_contacts_user_idx on public.community_contacts (user_id);

alter table public.community_contacts enable row level security;
create policy "community contacts are self-only"
  on public.community_contacts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.recognitions (
  id                    uuid primary key default gen_random_uuid(),
  observer_id           uuid not null references auth.users (id) on delete cascade,
  observed_user_id      uuid references auth.users (id) on delete set null,
  title                 text not null,
  who_became_visible    text not null,
  story                 text not null,
  virtue_family         text not null check (virtue_family in (
                            'wisdom', 'justice', 'fortitude', 'self-control', 'love',
                            'positive-attitude', 'hard-work', 'integrity', 'gratitude', 'humility'
                          )),
  primary_virtue        text,
  supporting_virtues    text[] not null default '{}',
  virtue_elements       text[] not null default '{}',
  reflection            text not null,
  personal_insight      text not null,
  community_impact      text not null,
  next_practice         text,
  questions_to_revisit  text[] not null default '{}',
  conversation_path     text not null check (conversation_path in (
                            'i_saw_someone', 'someone_recognized_me',
                            'something_difficult', 'i_want_to_grow'
                          )),
  context_type          text not null check (context_type in ('school', 'community', 'family')),
  context_school        text,
  context_teacher       text,
  context_grade         text,
  context_business      text,
  context_organization  text,
  context_event         text,
  created_at            timestamptz not null default now()
);

create index if not exists recognitions_observer_idx on public.recognitions (observer_id, created_at);
create index if not exists recognitions_observed_user_idx on public.recognitions (observed_user_id);

alter table public.recognitions enable row level security;

create policy "recognitions insert as self"
  on public.recognitions for insert
  with check (auth.uid() = observer_id);

create policy "recognitions self update"
  on public.recognitions for update
  using (auth.uid() = observer_id) with check (auth.uid() = observer_id);

create policy "recognitions self delete"
  on public.recognitions for delete
  using (auth.uid() = observer_id);

create policy "recognitions visible to observer, observed, and community contacts"
  on public.recognitions for select
  using (
    auth.uid() = observer_id
    or auth.uid() = observed_user_id
    or (
      context_type = 'school' and exists (
        select 1 from public.community_contacts cc
        where cc.user_id = auth.uid()
          and cc.contact_role in ('teacher', 'school_admin')
          and cc.school = recognitions.context_school
      )
    )
    or (
      context_type = 'school' and exists (
        select 1 from public.community_contacts cc
        where cc.user_id = auth.uid()
          and cc.contact_role = 'guardian'
          and (
            cc.guardian_of_user_id = recognitions.observed_user_id
            or cc.guardian_of_name = recognitions.who_became_visible
          )
      )
    )
    or (
      context_type = 'community' and exists (
        select 1 from public.community_contacts cc
        where cc.user_id = auth.uid()
          and cc.contact_role = 'business_contact'
          and (
            cc.organization = recognitions.context_organization
            or cc.organization = recognitions.context_business
          )
      )
    )
    or exists (
      select 1 from public.community_contacts cc
      where cc.user_id = auth.uid()
        and cc.contact_role = 'community_leader'
        and (
          (recognitions.context_type = 'school' and cc.school = recognitions.context_school)
          or (
            recognitions.context_type = 'community'
            and (
              cc.organization = recognitions.context_organization
              or cc.organization = recognitions.context_business
            )
          )
        )
    )
  );

create table if not exists public.unsung_heroes_conversations (
  id            uuid primary key default gen_random_uuid(),
  host_id       uuid not null references auth.users (id) on delete cascade,
  path          text not null check (path in (
                    'i_saw_someone', 'someone_recognized_me',
                    'something_difficult', 'i_want_to_grow'
                  )),
  status        text not null default 'active' check (status in ('active', 'complete')),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists unsung_heroes_conversations_host_idx
  on public.unsung_heroes_conversations (host_id, created_at);

alter table public.unsung_heroes_conversations enable row level security;
create policy "unsung heroes conversations are self-only"
  on public.unsung_heroes_conversations for all
  using (auth.uid() = host_id) with check (auth.uid() = host_id);

create table if not exists public.unsung_heroes_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.unsung_heroes_conversations (id) on delete cascade,
  host_id          uuid not null references auth.users (id) on delete cascade,
  role             text not null check (role in ('host', 'guide')),
  content          text not null,
  created_at       timestamptz not null default now()
);

create index if not exists unsung_heroes_messages_conversation_idx
  on public.unsung_heroes_messages (conversation_id, created_at);

alter table public.unsung_heroes_messages enable row level security;
create policy "unsung heroes messages are self-only"
  on public.unsung_heroes_messages for all
  using (auth.uid() = host_id) with check (auth.uid() = host_id);
