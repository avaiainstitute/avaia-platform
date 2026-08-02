-- Unsung Heroes program — schema addition. The Secondary Loss -> Virtue
-- restoration mapping this program draws on already exists as
-- SECONDARY_LOSSES in lib/institution.ts (Meaning->Gratitude,
-- Reality->Humility, ... Attachment/Support->Love) — nothing new needed there,
-- Path Three's guidance references it directly rather than duplicating it.
--
-- Run this once against the live database (Supabase SQL editor). Safe to
-- re-run: every clause is skipped if it already exists.

-- profiles.role — coarse account type. Plain Hosts are 'member'; a
-- 'community_leader' account additionally gets cross-school/organization
-- visibility, scoped by the community_contacts rows below.
alter table public.profiles
  add column if not exists role text not null default 'member'
    check (role in ('member', 'community_leader'));

-- ---------------------------------------------------------------------------
-- community_contacts — the "on file" directory that Unsung Heroes visibility
-- depends on. Recognition visibility is never chosen by the observer; it
-- follows entirely from these rows: who is the teacher/administrator for a
-- school, who is a specific person's guardian, who is the contact for a
-- business/organization, and which schools/organizations a community_leader
-- is scoped to. A user can hold more than one contact row (e.g. a
-- community_leader scoped to several schools).
-- ---------------------------------------------------------------------------
create table if not exists public.community_contacts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  contact_role          text not null check (contact_role in (
                            'teacher', 'school_admin', 'guardian',
                            'business_contact', 'community_leader'
                          )),
  -- Scope for teacher / school_admin / community_leader (matched against
  -- recognitions.context_school).
  school                text,
  -- Scope for business_contact / community_leader (matched against
  -- recognitions.context_organization or context_business).
  organization          text,
  -- Scope for 'guardian' only: the specific person they're guardian of.
  guardian_of_name      text,
  guardian_of_user_id   uuid references auth.users (id) on delete cascade,
  created_at            timestamptz not null default now()
);

create index if not exists community_contacts_user_idx on public.community_contacts (user_id);

alter table public.community_contacts enable row level security;
create policy "community contacts are self-only"
  on public.community_contacts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- recognitions — the Unsung Heroes recognition card. observer_id is always
-- the signed-in Host recording it; observed_name is who they're recognizing,
-- optionally linked to a real AVAIA account via observed_user_id. virtue_name
-- is validated at the application layer against lib/virtues.ts (123 elements
-- is too many to enumerate in a check constraint); virtue_family is the one
-- piece constrained here since there are only ten.
-- ---------------------------------------------------------------------------
create table if not exists public.recognitions (
  id                    uuid primary key default gen_random_uuid(),
  observer_id           uuid not null references auth.users (id) on delete cascade,
  observed_name         text not null,
  observed_user_id      uuid references auth.users (id) on delete set null,
  virtue_family         text not null check (virtue_family in (
                            'wisdom', 'justice', 'fortitude', 'self-control', 'love',
                            'positive-attitude', 'hard-work', 'integrity', 'gratitude', 'humility'
                          )),
  virtue_name           text,
  story                 text not null,
  why_it_mattered       text not null,
  reflection            text not null,  -- why the observer noticed it — core, not optional
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

-- SELECT is the rule set from the spec: the observer and the linked observed
-- account can always see it; school cards are visible to the linked teacher,
-- school administrator, and guardian on file; community cards are visible to
-- the business/organization contact on file; community_leader accounts see
-- any card in a school/organization they are scoped to.
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
            or cc.guardian_of_name = recognitions.observed_name
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

-- ---------------------------------------------------------------------------
-- unsung_heroes_conversations / unsung_heroes_messages — a separate, parallel
-- record from the core Journey's conversations/messages tables (see
-- lib/engine/unsung-heroes.ts). Kept fully independent so nothing here can
-- affect IAP/CAT/InnerCompass.
-- ---------------------------------------------------------------------------
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
