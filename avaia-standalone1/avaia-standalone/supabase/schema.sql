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
  id                    uuid primary key references auth.users (id) on delete cascade,
  consent_at            timestamptz,           -- when the Host accepted the disclaimer
  disclaimer_version    text,                  -- which disclaimer they accepted
  adult_confirmed       boolean not null default false,
  minor_with_guardian   boolean not null default false,
  membership_status     text not null default 'free' check (membership_status in ('free', 'member')),
  role                  text not null default 'member' check (role in ('member', 'community_leader', 'guide', 'admin')),
  -- Marketing consent is deliberately separate from consent_at above -- the
  -- account/legal disclaimer never implies permission to send marketing.
  -- Optional, off by default, capturable (and later changeable) on its own.
  marketing_consent     boolean not null default false,
  marketing_consent_at  timestamptz,
  marketing_consent_source text,
  -- Set alongside role = 'guide' -- a simple audit record of when someone
  -- was certified, not a tiered/per-tool certification system (not required
  -- by the Guide Toolkit's first build).
  guide_certified_at    timestamptz,
  -- Youth Journey, Phase 1 (0017) -- the smallest signal that selects
  -- Youth's starting developmental guidance (8-11 / 12-14 / 15-17); the
  -- Guide still adapts to the individual Host from there. Nullable and
  -- meaningless for every adult profile. Deliberately not a birthdate --
  -- see 0017's comment.
  developmental_band    text check (developmental_band in ('8-11', '12-14', '15-17')),
  created_at            timestamptz not null default now()
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
  program       text not null default 'general' check (program in ('general', 'defying-grief', 'youth')),
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
  program       text not null default 'general' check (program in ('general', 'defying-grief', 'youth')),
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

-- Which unsung_heroes_conversations row produced a given recognition --
-- added in 0013_guide_toolkit_participant_record.sql, as an alter (rather
-- than inline on public.recognitions above) since that table is declared
-- before this one exists. Nullable: recognitions created before this
-- migration have no way to be backfilled, and stay honestly unlinked rather
-- than guessed at. This is what lets the Guide Toolkit's Participant Record
-- trace a recognition back to the guide_sessions row (and therefore
-- participant) that produced it.
alter table public.recognitions
  add column if not exists conversation_id uuid
    references public.unsung_heroes_conversations (id) on delete set null;

create index if not exists recognitions_conversation_idx
  on public.recognitions (conversation_id);

-- ---------------------------------------------------------------------------
-- contact_submissions — the public, unauthenticated form at /contact
-- ---------------------------------------------------------------------------
create table if not exists public.contact_submissions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  reason     text not null check (reason in (
                'general', 'guiding', 'workshops', 'schools', 'certification', 'other'
              )),
  message    text not null,
  created_at timestamptz not null default now()
);

-- No RLS policies at all (service-role only, same posture as the Stripe
-- webhook and the GPT OAuth tables) -- only /api/contact, via the admin
-- client, can ever touch this table. There is no signed-in Host to scope to.
alter table public.contact_submissions enable row level security;

-- ---------------------------------------------------------------------------
-- guide_participants / guide_sessions — the AVAIA Guide Toolkit's
-- lightweight participant/session model. A participant needs no AVAIA
-- account; a Guide-facilitated conversation still lives in the ordinary
-- conversations/messages/referrals tables with host_id = the Guide's own
-- account (see lib/guide.ts) -- these two tables only track who a session
-- was really for, not the conversation content itself.
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
  -- No foreign key: this may hold either a public.conversations id (IAP/
  -- CAT/InnerCompass/Defying Grief) or a public.unsung_heroes_conversations
  -- id (Unsung Heroes) -- one column can't reference two tables. Which
  -- table to query is always determined by `tool` in lib/guide.ts.
  conversation_id  uuid,
  -- Only meaningful for 'iap' sessions -- which program to create the
  -- conversation under. CAT/InnerCompass sessions are always a handoff
  -- from an existing conversation, which already carries its own program.
  program          text not null default 'general' check (program in ('general', 'defying-grief')),
  -- Infrastructure only -- see 0013_guide_toolkit_participant_record.sql's
  -- comment. Every currently-installed tool only ever runs as an adult
  -- individual session, so this reads 'adult_individual' everywhere until a
  -- youth or group tool actually exists to set it otherwise.
  session_context  text not null default 'adult_individual'
                     check (session_context in ('adult_individual', 'youth_individual', 'group')),
  status           text not null default 'active' check (status in ('active', 'complete')),
  created_at       timestamptz not null default now()
);

create index if not exists guide_sessions_guide_idx
  on public.guide_sessions (guide_id, created_at);

alter table public.guide_sessions enable row level security;
create policy "guide sessions are owner-only"
  on public.guide_sessions for all
  using (auth.uid() = guide_id) with check (auth.uid() = guide_id);

-- ---------------------------------------------------------------------------
-- library_entries — ported from the unmerged `library` branch, unchanged in
-- shape. library_suggestions and the admin CRUD/review UI are not ported in
-- this pass -- this is the data layer plus a read-only Guide browse view.
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
      select 1 from public.entitlements e
      where e.host_id = auth.uid() and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  );

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

-- ---------------------------------------------------------------------------
-- library_host_entries — Phase 1 Living Library, the Host's own private
-- relationship to a Library Entry (explored / saved / dismissed / noted).
-- See 0014_library_host_entries.sql for the full rationale.
-- ---------------------------------------------------------------------------
create table if not exists public.library_host_entries (
  id                uuid primary key default gen_random_uuid(),
  host_id           uuid not null references auth.users (id) on delete cascade,
  library_entry_id  uuid not null references public.library_entries (id) on delete cascade,
  explored_at       timestamptz,
  state             text check (state in ('save', 'not_for_me')),
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

-- ---------------------------------------------------------------------------
-- Living Library concept/cross-reference foundation -- see
-- 0015_library_concepts.sql for full rationale. Purely additive: no
-- library_entries column changes, current retrieval and current tags/
-- virtues/secondary_losses are untouched. "proposed" vs "published" on
-- every relationship/junction row makes the Important Source Discipline
-- requirement structural -- a "proposed" row is invisible to a Host by
-- RLS, not merely by app-level filtering.
-- ---------------------------------------------------------------------------
create table if not exists public.library_concepts (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description       text,
  alternate_terms   text[] not null default '{}',
  distinctions      jsonb not null default '[]',
  tensions          jsonb not null default '[]',
  status            text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  editor_id         uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists library_concepts_name_idx on public.library_concepts (lower(name));
create index if not exists library_concepts_status_idx on public.library_concepts (status);

alter table public.library_concepts enable row level security;
create policy "library concepts published read"
  on public.library_concepts for select using (status = 'published');
create policy "library concepts admin all"
  on public.library_concepts for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.library_questions (
  id           uuid primary key default gen_random_uuid(),
  question     text not null,
  status       text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  editor_id    uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists library_questions_status_idx on public.library_questions (status);

alter table public.library_questions enable row level security;
create policy "library questions published read"
  on public.library_questions for select using (status = 'published');
create policy "library questions admin all"
  on public.library_questions for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.library_concept_relations (
  id                uuid primary key default gen_random_uuid(),
  from_concept_id   uuid not null references public.library_concepts (id) on delete cascade,
  to_concept_id     uuid not null references public.library_concepts (id) on delete cascade,
  relation_type     text not null check (relation_type in (
                       'related_to', 'contrasts_with', 'commonly_confused_with', 'dimension_of'
                     )),
  note              text,
  proposed_by       text not null default 'editor' check (proposed_by in ('editor', 'model')),
  status            text not null default 'proposed' check (status in ('proposed', 'published')),
  editor_id         uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (from_concept_id <> to_concept_id),
  unique (from_concept_id, to_concept_id, relation_type)
);

create index if not exists library_concept_relations_from_idx on public.library_concept_relations (from_concept_id);
create index if not exists library_concept_relations_to_idx on public.library_concept_relations (to_concept_id);

alter table public.library_concept_relations enable row level security;
create policy "library concept relations published read"
  on public.library_concept_relations for select using (status = 'published');
create policy "library concept relations admin all"
  on public.library_concept_relations for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.library_entry_concepts (
  id                 uuid primary key default gen_random_uuid(),
  library_entry_id   uuid not null references public.library_entries (id) on delete cascade,
  concept_id         uuid not null references public.library_concepts (id) on delete cascade,
  note               text,
  proposed_by        text not null default 'editor' check (proposed_by in ('editor', 'model')),
  status             text not null default 'proposed' check (status in ('proposed', 'published')),
  editor_id          uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (library_entry_id, concept_id)
);

create index if not exists library_entry_concepts_entry_idx on public.library_entry_concepts (library_entry_id);
create index if not exists library_entry_concepts_concept_idx on public.library_entry_concepts (concept_id);

alter table public.library_entry_concepts enable row level security;
create policy "library entry concepts published read"
  on public.library_entry_concepts for select using (status = 'published');
create policy "library entry concepts admin all"
  on public.library_entry_concepts for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.library_question_concepts (
  id             uuid primary key default gen_random_uuid(),
  question_id    uuid not null references public.library_questions (id) on delete cascade,
  concept_id     uuid not null references public.library_concepts (id) on delete cascade,
  note           text,
  proposed_by    text not null default 'editor' check (proposed_by in ('editor', 'model')),
  status         text not null default 'proposed' check (status in ('proposed', 'published')),
  editor_id      uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (question_id, concept_id)
);

create index if not exists library_question_concepts_question_idx on public.library_question_concepts (question_id);
create index if not exists library_question_concepts_concept_idx on public.library_question_concepts (concept_id);

alter table public.library_question_concepts enable row level security;
create policy "library question concepts published read"
  on public.library_question_concepts for select using (status = 'published');
create policy "library question concepts admin all"
  on public.library_question_concepts for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.library_entry_questions (
  id                 uuid primary key default gen_random_uuid(),
  library_entry_id   uuid not null references public.library_entries (id) on delete cascade,
  question_id        uuid not null references public.library_questions (id) on delete cascade,
  note               text,
  proposed_by        text not null default 'editor' check (proposed_by in ('editor', 'model')),
  status             text not null default 'proposed' check (status in ('proposed', 'published')),
  editor_id          uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (library_entry_id, question_id)
);

create index if not exists library_entry_questions_entry_idx on public.library_entry_questions (library_entry_id);
create index if not exists library_entry_questions_question_idx on public.library_entry_questions (question_id);

alter table public.library_entry_questions enable row level security;
create policy "library entry questions published read"
  on public.library_entry_questions for select using (status = 'published');
create policy "library entry questions admin all"
  on public.library_entry_questions for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- Living Library minimum historical provenance layer -- see
-- 0016_library_provenance.sql for full rationale. Purely additive:
-- library_entries is untouched. Person -> Work -> Source Version ->
-- Passage -> Passage<->Concept, fully separate from library_entries.
-- ---------------------------------------------------------------------------
create table if not exists public.library_people (
  id              uuid primary key default gen_random_uuid(),
  canonical_name  text not null,
  disambiguation  text,
  birth_year      integer,
  death_year      integer,
  description     text,
  status          text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists library_people_identity_idx
  on public.library_people (canonical_name, coalesce(disambiguation, ''));
create index if not exists library_people_status_idx on public.library_people (status);

alter table public.library_people enable row level security;
create policy "library people published read"
  on public.library_people for select using (status = 'published');
create policy "library people admin all"
  on public.library_people for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.library_works (
  id                  uuid primary key default gen_random_uuid(),
  person_id           uuid not null references public.library_people (id) on delete restrict,
  title               text not null,
  original_date_text  text,
  work_type           text,
  description         text,
  status              text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists library_works_identity_idx
  on public.library_works (person_id, lower(title));
create index if not exists library_works_status_idx on public.library_works (status);
create index if not exists library_works_person_idx on public.library_works (person_id);

alter table public.library_works enable row level security;
create policy "library works published read"
  on public.library_works for select using (status = 'published');
create policy "library works admin all"
  on public.library_works for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.library_source_versions (
  id                   uuid primary key default gen_random_uuid(),
  work_id              uuid not null references public.library_works (id) on delete restrict,
  version_label        text not null,
  translator_editor    text,
  publisher            text,
  publication_year     integer,
  source_url           text,
  archive_source       text,
  rights_status        text not null default 'unreviewed'
                         check (rights_status in ('unreviewed', 'public_domain', 'permission_granted', 'licensed', 'restricted')),
  verification_status  text not null default 'unverified'
                         check (verification_status in ('unverified', 'partially_verified', 'verified')),
  status               text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index if not exists library_source_versions_identity_idx
  on public.library_source_versions (work_id, lower(version_label));
create index if not exists library_source_versions_status_idx on public.library_source_versions (status);
create index if not exists library_source_versions_work_idx on public.library_source_versions (work_id);

alter table public.library_source_versions enable row level security;
create policy "library source versions published read"
  on public.library_source_versions for select using (status = 'published');
create policy "library source versions admin all"
  on public.library_source_versions for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.library_passages (
  id                   uuid primary key default gen_random_uuid(),
  source_version_id    uuid not null references public.library_source_versions (id) on delete restrict,
  locator              text not null,
  exact_text           text,
  avaia_paraphrase     text,
  context_note         text,
  verification_status  text not null default 'unverified'
                         check (verification_status in ('unverified', 'partially_verified', 'verified')),
  rights_status        text not null default 'unreviewed'
                         check (rights_status in ('unreviewed', 'public_domain', 'permission_granted', 'licensed', 'restricted')),
  status               text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (source_version_id, locator)
);

create index if not exists library_passages_status_idx on public.library_passages (status);
create index if not exists library_passages_source_version_idx on public.library_passages (source_version_id);

alter table public.library_passages enable row level security;
create policy "library passages published read"
  on public.library_passages for select using (status = 'published');
create policy "library passages admin all"
  on public.library_passages for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.library_passage_concepts (
  id           uuid primary key default gen_random_uuid(),
  passage_id   uuid not null references public.library_passages (id) on delete cascade,
  concept_id   uuid not null references public.library_concepts (id) on delete cascade,
  note         text,
  proposed_by  text not null default 'editor' check (proposed_by in ('editor', 'model')),
  status       text not null default 'proposed' check (status in ('proposed', 'published')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (passage_id, concept_id)
);

create index if not exists library_passage_concepts_passage_idx on public.library_passage_concepts (passage_id);
create index if not exists library_passage_concepts_concept_idx on public.library_passage_concepts (concept_id);

alter table public.library_passage_concepts enable row level security;
create policy "library passage concepts published read"
  on public.library_passage_concepts for select using (status = 'published');
create policy "library passage concepts admin all"
  on public.library_passage_concepts for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- AI usage instrumentation -- operational telemetry only, never Host content.
-- Records raw token counts per Anthropic call so cost-per-Host/cost-per-Journey
-- can be calculated later from a centralized, effective-dated pricing model
-- (not part of this migration). Written exclusively by the service-role
-- client from lib/engine/ai-usage.ts; no Host-facing RLS policy exists, so
-- this table is never queryable through the normal browser/session client.
create table if not exists public.ai_usage_events (
  id                           uuid primary key default gen_random_uuid(),
  host_id                      uuid references auth.users (id) on delete cascade,
  -- Not a foreign key: this column holds either a public.conversations id
  -- (Journey conversation turns, referrals, openings) or an Unsung Heroes
  -- conversation id, depending on feature -- two different source tables,
  -- so it's stored as a plain identifier rather than constrained to one.
  conversation_id              uuid,
  feature                      text not null check (feature in (
                                  'iap_conversation', 'cat_conversation', 'innercompass_conversation',
                                  'iap_referral', 'cat_referral', 'innercompass_referral',
                                  'cat_opening', 'innercompass_opening',
                                  'unsung_heroes_recognition', 'unsung_heroes_conversation',
                                  'chemistry_virtue_formula', 'transcript_cleanup'
                                )),
  stage                        text check (stage in ('iap', 'cat', 'innercompass')),
  model                        text not null,
  input_tokens                 integer not null,
  output_tokens                 integer not null,
  cache_creation_input_tokens  integer not null default 0,
  cache_read_input_tokens      integer not null default 0,
  created_at                   timestamptz not null default now()
);

create index if not exists ai_usage_events_host_idx on public.ai_usage_events (host_id, created_at);
create index if not exists ai_usage_events_feature_idx on public.ai_usage_events (feature, created_at);

alter table public.ai_usage_events enable row level security;
-- Deliberately no policy: operational telemetry, not Host content. Only the
-- service-role client (bypasses RLS) ever reads or writes this table.

-- Membership entitlement foundation -- Phase 1 of the Universal Membership
-- architecture. Separates WHO currently has access (this table) from
-- profiles.membership_status, which is a frozen, unread legacy column as
-- of this migration -- kept in place, not dropped, not modified.
-- isMember() (lib/membership.ts) resolves access from here instead.
create table if not exists public.entitlements (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references auth.users (id) on delete cascade,
  status      text not null default 'active' check (status in ('active', 'revoked')),
  -- null = open-ended (an ongoing subscription, the only kind granted in
  -- this phase). Set only for a future fixed-term arrangement (e.g.
  -- Organization access -- not built yet). Checked live at query time,
  -- so no background expiry job is required for correctness.
  expires_at  timestamptz,
  -- Reporting/attribution only -- never used for authorization logic.
  -- 'individual' is the only source any code path grants in this phase;
  -- the others are named here so later phases don't need a schema change
  -- just to record a new funding arrangement.
  source      text not null check (source in
                ('individual', 'supported', 'family', 'gift', 'sponsored', 'organization')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists entitlements_host_active_idx
  on public.entitlements (host_id) where status = 'active';

alter table public.entitlements enable row level security;
-- A Host may read their own entitlement rows -- this is the Host's own
-- access/billing status, not private conversation content, and
-- isMember() itself queries through the caller's own per-request client,
-- so it needs this policy to see anything at all. Only the service-role
-- client (the Stripe webhook, and the one-time backfill in migration
-- 0019) ever writes to this table.
create policy "entitlements self read"
  on public.entitlements for select
  using (auth.uid() = host_id);

-- ---------------------------------------------------------------------------
-- AVAIA Experience/Class Toolkit -- minimum data model, first slice
-- (migration 0020). Purely additive. "Room" is explicitly NOT this --
-- the Room is the Host's own experiential architecture, not a
-- multi-Host container; nothing here represents an event, a group, or
-- multiple Hosts sharing one record. Component references reuse the
-- existing ToolKey vocabulary (lib/toolkit.ts) rather than a second
-- taxonomy, validated at the application layer
-- (lib/experiences.ts), not a rigid database check. No
-- required_permission / certification-tier field -- that data model
-- isn't finalized and nothing here reads one; deferred to a future
-- additive migration once it exists.
-- ---------------------------------------------------------------------------
create table if not exists public.experiences (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  summary              text,
  status               text not null default 'draft'
                         check (status in ('draft', 'published', 'archived')),
  components           text[] not null default '{}',
  conversation_stages  text[] not null default '{}'
                         check (conversation_stages <@ array['iap', 'cat', 'innercompass']),
  editor_id            uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index if not exists experiences_title_idx on public.experiences (lower(title));
create index if not exists experiences_status_idx on public.experiences (status);

alter table public.experiences enable row level security;
create policy "experiences guide read"
  on public.experiences for select
  using (
    status = 'published'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'guide')
  );
create policy "experiences admin all"
  on public.experiences for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- classes -- the modular Class Library. `family` is the Class system's
-- own five-way grouping (Self / Relationships / Life & Change / Virtue &
-- Contribution / Clarity & Agency) -- a separate taxonomy from the ten
-- canonical Virtue Families in lib/virtues.ts, not to be confused with it.
create table if not exists public.classes (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  family               text not null
                         check (family in ('self', 'relationships', 'life_change',
                                            'virtue_contribution', 'clarity_agency')),
  summary              text,
  status               text not null default 'draft'
                         check (status in ('draft', 'published', 'archived')),
  components           text[] not null default '{}',
  conversation_stages  text[] not null default '{}'
                         check (conversation_stages <@ array['iap', 'cat', 'innercompass']),
  editor_id            uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index if not exists classes_title_idx on public.classes (lower(title));
create index if not exists classes_status_idx on public.classes (status);
create index if not exists classes_family_idx on public.classes (family);

alter table public.classes enable row level security;
create policy "classes guide read"
  on public.classes for select
  using (
    status = 'published'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'guide')
  );
create policy "classes admin all"
  on public.classes for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- experience_classes -- which Classes support which full Experiences.
-- No rows exist by default -- no Experience-to-Class relationships were
-- specified in the approved source material, so none are invented here.
create table if not exists public.experience_classes (
  id             uuid primary key default gen_random_uuid(),
  experience_id  uuid not null references public.experiences (id) on delete cascade,
  class_id       uuid not null references public.classes (id) on delete cascade,
  note           text,
  created_at     timestamptz not null default now(),
  unique (experience_id, class_id)
);

alter table public.experience_classes enable row level security;
create policy "experience classes guide read"
  on public.experience_classes for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'guide'));
create policy "experience classes admin all"
  on public.experience_classes for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
