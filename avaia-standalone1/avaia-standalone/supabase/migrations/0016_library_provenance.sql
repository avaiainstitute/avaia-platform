-- AVAIA Living Library — minimum historical provenance layer.
--
-- Purely additive: library_entries is untouched (no passage_id column,
-- no rendering change). Historical source material connects to concepts
-- through its own chain -- Person -> Work -> Source Version -> Passage ->
-- Passage<->Concept -- fully separate from library_entries, so the same
-- passage can be linked to many concept neighborhoods without ever being
-- retyped, and so a Library Entry never needs to know a passage exists.
--
-- Same status discipline as 0015: first-class objects (people, works,
-- source versions, passages) use draft|published|archived; the one
-- junction (passage<->concept) uses proposed|published plus proposed_by,
-- matching the Important Source Discipline requirement -- a "proposed"
-- link is invisible to a Host by RLS, not merely by app-level filtering.
--
-- Deletion behavior deliberately differs by relationship shape. The
-- chain person -> work -> source_version -> passage links first-class
-- objects to first-class objects (a Work has its own real content, not
-- merely a pointer), so each of those three foreign keys is ON DELETE
-- RESTRICT: deleting a person, work, or source version fails outright
-- while anything still references it, rather than silently deleting an
-- entire tree of potentially verified, published content underneath one
-- accidental delete. library_passage_concepts, by contrast, is a true
-- junction table exactly like library_entry_concepts/
-- library_question_concepts/library_concept_relations/
-- library_entry_questions/library_host_entries already elsewhere in this
-- schema -- a row with no independent meaning once either endpoint is
-- gone -- so both of its foreign keys stay ON DELETE CASCADE, consistent
-- with every existing junction table in the Library.

-- ---------------------------------------------------------------------------
-- library_people — a historical/modern source person or institutional
-- voice. Uniqueness is (canonical_name, coalesced disambiguation) rather
-- than name alone specifically so Alfred Adler and Mortimer J. Adler stay
-- distinct identities while an accidental duplicate "Aristotle" row is
-- still caught. coalesce(disambiguation, '') is required here -- a plain
-- multi-column unique constraint would never catch two rows that both
-- leave disambiguation null, since NULL never equals NULL in Postgres.
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

-- ---------------------------------------------------------------------------
-- library_works — one intellectual work by a library_people row.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- library_source_versions — the exact edition/translation/archive
-- version of a work used for verification or quotation.
-- ---------------------------------------------------------------------------
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

-- Smallest reasonable safeguard, not over-designed: one level down from
-- library_works' own (person, title) index, keeping a work's version
-- labels distinct from each other.
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

-- ---------------------------------------------------------------------------
-- library_passages — a reusable passage/fragment from a source version.
-- exact_text is nullable by design: AVAIA can publish a verified
-- AVAIA-authored paraphrase when direct quotation rights aren't cleared,
-- without withholding the passage entirely. unique(source_version_id,
-- locator) enforces this packet's own stated purpose at the schema level
-- -- the same locator from the same version can't be entered twice by two
-- editors who don't know about each other's work.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- library_passage_concepts — a passage connected to a concept, with a
-- reason. Additive alongside library_entry_concepts; entries and passages
-- each connect to concepts through their own junction, never through
-- each other.
-- ---------------------------------------------------------------------------
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
