-- Certified AVAIA Guide — candidacy and certification records (Phase C,
-- first implementation slice). Purely additive: three new tables, zero
-- alter statements on any existing table, zero application code changes
-- required to register them.
--
-- Three institutional facts, kept as three separate tables rather than one
-- overloaded status field, per the approved Phase C architecture:
--   INTEREST       -- already satisfied by public.contact_submissions
--                      (0010_contact_submissions.sql). Not touched here.
--   CANDIDACY      -- guide_candidates: AVAIA's intentional decision to
--                      admit an existing account into the certification
--                      pathway, and that candidacy's ongoing lifecycle.
--   CERTIFICATION  -- guide_certifications: the competency-based decision
--                      itself, and its ongoing institutional standing.
-- guide_candidate_history is a lightweight, append-only institutional log
-- attached to a candidacy -- not event sourcing, not a generic audit trail
-- for every table, just a place to preserve notes/evaluation events/status
-- changes over time in a candidate's own words.
--
-- ============================================================================
-- IMPORTANT -- CERTIFICATION STANDING IS NOT PLATFORM AUTHORIZATION.
--
-- guide_certifications.standing answers one question only: "has AVAIA
-- certified this person, and what is the current institutional standing of
-- that certification?" It must NOT be used, by itself, to determine:
--   - Toolkit access
--   - private Guided Journey access
--   - Youth Guide facilitation permission
--   - Experience permissions
--   - Guide matching/booking eligibility
--   - or any other platform capability
-- "Which platform capabilities does this person currently have?" is a
-- separate authorization question, deliberately not answered by this
-- migration and not built here. The precedent for this exact separation
-- already exists in production: public.entitlements answers "does this
-- Host have active membership?" while profiles.role answers "does this
-- account have Toolkit access?" -- two different tables, read by two
-- different functions (isMember() vs. the role === 'guide' check in
-- app/toolkit/layout.tsx), never conflated. guide_certifications and any
-- future authorization mechanism must stay just as separate.
--
-- Nothing in this migration is read by any live request path. It is not
-- wired into isGuide(), isAuthorizedGuideConversation(),
-- app/toolkit/layout.tsx, profiles.role, or profiles.guide_certified_at
-- (which remains exactly as inert as it already was).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- guide_candidates -- one row per admitted certification candidacy.
-- Candidacy requires an existing AVAIA account: host_id is not null, and
-- rows are never created automatically from contact_submissions -- an admin
-- (or, until an admin UI exists, Dorian via the Supabase SQL editor) always
-- makes this an intentional insert. The partial unique index below allows
-- a host's full candidacy history to accumulate over time (e.g. withdraw,
-- later re-admit) while still preventing two concurrently OPEN candidacies
-- for the same person.
-- ---------------------------------------------------------------------------
create table if not exists public.guide_candidates (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null references auth.users (id) on delete cascade,
  -- Candidate lifecycle only -- never a certification decision and never a
  -- platform permission. 'withdrawn' and 'not_certified' are the only
  -- statuses that close a candidacy (see the partial unique index below);
  -- every other value is still an open, in-progress candidacy.
  status       text not null default 'admitted' check (status in (
                 'admitted', 'in_training', 'development_required',
                 'paused', 'hold', 'withdrawn', 'not_certified'
               )),
  admitted_at  timestamptz not null default now(),
  admitted_by  uuid references auth.users (id) on delete set null,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Enforces "candidacy and certification remain separate facts" at the data
-- level for the candidacy side: at most one OPEN candidacy per host at a
-- time. A host may still accumulate multiple historical rows (e.g. an
-- earlier withdrawn candidacy, then a later admitted one).
create unique index if not exists guide_candidates_one_open_per_host
  on public.guide_candidates (host_id)
  where status not in ('withdrawn', 'not_certified');

create index if not exists guide_candidates_host_idx
  on public.guide_candidates (host_id);

alter table public.guide_candidates enable row level security;

create policy "guide candidates self read"
  on public.guide_candidates for select
  using (auth.uid() = host_id);

create policy "guide candidates admin all"
  on public.guide_candidates for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- guide_certifications -- one row per certification grant. Only created
-- when AVAIA actually certifies a candidate; a "not certified" outcome is
-- recorded as a guide_candidates.status change plus a guide_candidate_history
-- entry, not a row here, since nothing was granted in that case.
--
-- `standing` (NOT `status` -- deliberately distinct name from every other
-- status-shaped column in this schema, so the institutional-recognition-
-- only meaning can't be casually confused with a permission flag) is the
-- institution's current recognition of this certification:
--   active   -- AVAIA currently recognizes this certification as valid and
--               in good standing.
--   paused   -- AVAIA has temporarily suspended recognition of the
--               certification itself (e.g. pending re-evaluation, a
--               concern under review, a voluntary leave) -- a statement
--               about the certification's institutional status, not about
--               what the person can currently do on the platform.
--   revoked  -- AVAIA has permanently withdrawn recognition of the
--               certification. The institutional judgment itself,
--               independent of and prior to any platform-permission
--               consequence that might separately, later follow.
-- ---------------------------------------------------------------------------
create table if not exists public.guide_certifications (
  id                   uuid primary key default gen_random_uuid(),
  candidate_id         uuid not null references public.guide_candidates (id) on delete cascade,
  -- Denormalized for direct host-keyed queries, the same convenience
  -- guide_sessions.guide_id and entitlements.host_id already get.
  host_id              uuid not null references auth.users (id) on delete cascade,
  certified_at         timestamptz not null default now(),
  certified_by         uuid references auth.users (id) on delete set null,
  standing             text not null default 'active' check (standing in ('active', 'paused', 'revoked')),
  standing_changed_at  timestamptz not null default now(),
  standing_changed_by  uuid references auth.users (id) on delete set null,
  standing_notes       text
);

create index if not exists guide_certifications_host_idx
  on public.guide_certifications (host_id);
create index if not exists guide_certifications_candidate_idx
  on public.guide_certifications (candidate_id);

alter table public.guide_certifications enable row level security;

create policy "guide certifications self read"
  on public.guide_certifications for select
  using (auth.uid() = host_id);

create policy "guide certifications admin all"
  on public.guide_certifications for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- guide_candidate_history -- lightweight, append-only institutional log
-- attached to a candidacy. Preserves meaningful status changes, notes,
-- development/evaluation events, and certification-related decisions over
-- time. Deliberately NOT event sourcing (no replay/reconstruction
-- requirement, existing rows are never rewritten) and NOT a competency-
-- management system (no domain/rubric/rating columns) -- 'evaluation_note'
-- exists as a free-text entry_type today; a future, separately-approved
-- competency architecture can either add its own table keyed on
-- candidate_id, or add new entry_type values here, without any change to
-- this table's shape.
-- ---------------------------------------------------------------------------
create table if not exists public.guide_candidate_history (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.guide_candidates (id) on delete cascade,
  entry_type    text not null check (entry_type in (
                  'note', 'status_change', 'development_event',
                  'evaluation_note', 'certification_event', 'document_received'
                )),
  body          text not null,
  recorded_by   uuid references auth.users (id) on delete set null,
  recorded_at   timestamptz not null default now()
);

create index if not exists guide_candidate_history_candidate_idx
  on public.guide_candidate_history (candidate_id, recorded_at);

alter table public.guide_candidate_history enable row level security;

-- No direct host_id column here -- ownership is via the parent candidacy,
-- so self-read joins back to guide_candidates the same way a Guide's own
-- session-scoped tables key off a parent row elsewhere in this schema.
create policy "guide candidate history self read"
  on public.guide_candidate_history for select
  using (exists (
    select 1 from public.guide_candidates c
    where c.id = candidate_id and c.host_id = auth.uid()
  ));

create policy "guide candidate history admin all"
  on public.guide_candidate_history for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
