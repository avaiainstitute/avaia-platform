-- AVAIA Living Library — concept/cross-reference foundation.
--
-- Purely additive: no column on library_entries changes, current
-- retrieval (lib/library-retrieval.ts) is untouched, current tags/
-- virtues/secondary_losses stay exactly as they are. Six new tables:
-- two first-class objects (concepts, questions) and four directional
-- many-to-many junctions between them and library_entries. Deliberately
-- NOT a single generic polymorphic "edges" table -- each junction gets a
-- real foreign key to real tables, so referential integrity is enforced
-- by Postgres rather than trusted to application code. That costs more
-- tables; it buys correctness that's easy to reason about later, which
-- matters more for editorial content this codebase will keep growing.
--
-- "proposed" vs "published" on every relationship/junction row is the
-- Important Source Discipline requirement made structural: a
-- model-assisted suggestion and an editorially reviewed fact are never
-- the same row state, and RLS below means a "proposed" row is literally
-- invisible to a Host regardless of anything the app forgets to filter.

-- ---------------------------------------------------------------------------
-- library_concepts — a Great Idea / concept. Distinctions and tensions are
-- kept as small jsonb arrays on the row itself (not their own tables) --
-- editorial content specific to one concept, not a relationship to
-- another object, and jsonb keeps the shape extensible without a future
-- migration once real content defines what it should look like.
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

-- ---------------------------------------------------------------------------
-- library_questions — a canonical Human Question, first-class rather than
-- free text on a concept, since one question may legitimately connect to
-- several concepts and several entries (see the two junctions below).
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- library_concept_relations — directional concept <-> concept edges. A
-- deliberately small, fixed vocabulary rather than a free-text type field.
-- "contains" and "dimension of" are the same directional pair expressed
-- from opposite ends, so only one type (dimension_of) is needed, read as
-- "from is a dimension of to": from = the dimension/part, to = the
-- larger concept/whole. Example: Reciprocity --dimension_of--> Connection.
--
-- Deliberately excludes anything implying historical development, source/
-- work lineage, or authorship (e.g. "historical_development",
-- "contemporary_extension") -- the Person/Work/Version/Fragment provenance
-- layer is intentionally deferred, and a concept-to-concept edge is the
-- wrong place for it to arrive prematurely. When that layer is designed,
-- it gets its own relationship vocabulary between sources/works, not a
-- concept_relations value.
-- ---------------------------------------------------------------------------
create table if not exists public.library_concept_relations (
  id                uuid primary key default gen_random_uuid(),
  from_concept_id   uuid not null references public.library_concepts (id) on delete cascade,
  to_concept_id     uuid not null references public.library_concepts (id) on delete cascade,
  relation_type     text not null check (relation_type in (
                       'related_to', 'contrasts_with', 'commonly_confused_with', 'dimension_of'
                     )),
  -- Why this relationship exists -- provenance, not a bare tag.
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

-- ---------------------------------------------------------------------------
-- library_entry_concepts — a Library Entry connected to a concept, with a
-- reason. Additive alongside library_entries.tags/virtues/secondary_losses
-- -- none of those change or get removed.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- library_question_concepts — a question connected to a concept it raises
-- ("raises question about" from the spec's relationship examples).
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- library_entry_questions — a Library Entry connected to a question it
-- addresses, independent of whether it shares an explicit concept link.
-- ---------------------------------------------------------------------------
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
