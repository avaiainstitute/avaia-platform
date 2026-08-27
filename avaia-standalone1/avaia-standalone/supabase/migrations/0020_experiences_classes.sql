-- AVAIA Experience/Class Toolkit -- minimum data model, first slice.
--
-- Purely additive: three new tables, no change to any existing table,
-- column, or RLS policy. Nothing here touches lib/engine/*, the Library
-- (library_entries/library_concepts/etc.), profiles, conversations,
-- journeys, or referrals.
--
-- "Room" is explicitly NOT this -- per the governing correction, the
-- Room is the Host's own experiential architecture, not a multi-Host
-- container. Nothing here represents an event, a group, or multiple
-- Hosts sharing one record. No participant/event infrastructure exists
-- in this migration, deliberately.
--
-- Component references (the `components` column) deliberately reuse
-- the existing ToolKey vocabulary already defined in lib/toolkit.ts
-- ("chemistry", "unsung-heroes", "secondary-loss", "table-formation",
-- "council", "library", ...) rather than inventing a second taxonomy.
-- Validated at the application layer (lib/experiences.ts), not a rigid
-- database check -- the same posture library_entries.great_idea
-- already uses for its own free-text-but-validated field. Table
-- Formation and Council may be referenced here even though both remain
-- "not-yet-specified" in TOOL_REGISTRY -- a component tag never
-- requires the underlying feature to exist yet.
--
-- No required_permission / certification-tier field exists here --
-- deliberately removed before implementation. The certification/
-- permission data model isn't finalized, and nothing in this slice
-- reads such a field; encoding an undefined model now would be premature
-- schema expansion. A future additive migration is the right vehicle
-- once that model is actually designed.

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

-- ---------------------------------------------------------------------------
-- classes -- the modular Class Library. `family` is the Class system's
-- own five-way grouping (Self / Relationships / Life & Change / Virtue &
-- Contribution / Clarity & Agency) -- a separate taxonomy from the ten
-- canonical Virtue Families in lib/virtues.ts, not to be confused with it.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- experience_classes -- which Classes support which full Experiences.
-- Left empty by this migration (no rows inserted) -- no Experience-to-
-- Class relationships were specified in the approved source material,
-- so none are invented here.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Seed: the 11 approved Experience titles and 20 approved Class
-- titles/families, as drafts only. Nothing published by this migration.
-- No summary, components, conversation_stages, or experience_classes
-- relationship is invented for any record -- every field the source
-- material didn't explicitly specify is left at its empty default.
-- ---------------------------------------------------------------------------
insert into public.experiences (title, status) values
  ('The Empty Chair', 'draft'),
  ('Let Go of the Outcome', 'draft'),
  ('My Virtue Signature', 'draft'),
  ('The Things We Lose After the Loss', 'draft'),
  ('When Love Loses Visibility', 'draft'),
  ('What Is Mine to Carry?', 'draft'),
  ('Who Do I Invite to My Table?', 'draft'),
  ('The Life I Didn''t Plan', 'draft'),
  ('The Story I''ve Been Telling Myself', 'draft'),
  ('What I Never Got to Say', 'draft'),
  ('The Person I Needed', 'draft')
on conflict do nothing;

insert into public.classes (title, family, status) values
  ('Who Am I Becoming?', 'self', 'draft'),
  ('What Do I Want?', 'self', 'draft'),
  ('The Parts of Me I Left Behind', 'self', 'draft'),
  ('The Courage to Be Seen', 'self', 'draft'),

  ('The People Who Changed Me', 'relationships', 'draft'),
  ('The Words I Needed', 'relationships', 'draft'),
  ('Questions Without Answers', 'relationships', 'draft'),
  ('Who Gets a Seat at My Table?', 'relationships', 'draft'),

  ('When Both Things Are True', 'life_change', 'draft'),
  ('The Things I Carry', 'life_change', 'draft'),
  ('The Life Between Decisions', 'life_change', 'draft'),
  ('What Still Matters?', 'life_change', 'draft'),

  ('Same Virtue, Different Expression', 'virtue_contribution', 'draft'),
  ('Who Might Need Someone Like Me?', 'virtue_contribution', 'draft'),
  ('Virtue in Action', 'virtue_contribution', 'draft'),
  ('Recognition Changes Things', 'virtue_contribution', 'draft'),

  ('What Am I Trying to Control?', 'clarity_agency', 'draft'),
  ('Holding Both Sides of the Rope', 'clarity_agency', 'draft'),
  ('What Became Visible?', 'clarity_agency', 'draft'),
  ('What Belongs to Me?', 'clarity_agency', 'draft')
on conflict do nothing;
