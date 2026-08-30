-- Certified AVAIA Guide — candidate evidence index (Phase C.4, first
-- implementation slice). Purely additive: one new table, zero alter
-- statements on any existing table, zero application code changes
-- required to register it.
--
-- guide_candidates and guide_candidate_history (0022) preserve WHO a
-- candidate is and WHAT HAPPENED to their candidacy over time. Neither
-- table can truthfully answer "what demonstrated evidence justified
-- certifying this person?" without free-text parsing -- that is a
-- structurally different institutional fact, not an overload of either
-- existing table. guide_candidate_evidence is that fact: an institutional
-- evidence index of the candidate's demonstrated Guide stewardship,
-- recording that a recognized evidence instrument was administered/
-- observed, what a human evaluator found, and nothing else.
--
-- ============================================================================
-- IMPORTANT -- THIS IS AN EVIDENCE INDEX, NOT A HOST-CONTENT REPOSITORY.
--
-- guide_candidate_evidence must not become a repository of Host/private
-- conversation content. Evidence summaries describe the CANDIDATE's
-- demonstrated stewardship behavior and the evaluator's finding -- never:
--   - Host stories
--   - Host disclosures
--   - verbatim Host statements
--   - conversation transcripts
--   - unnecessary identifying information about a Host
-- This is why the table deliberately has no conversation_id, no Host
-- identifier, and no transcript field of any kind -- see the Evidence
-- Hierarchy in the AVAIA Certified Guide Evaluator Handbook ("Guide's
-- Record sample ... Must not become unauthorized private-content
-- collection") and the Program Operations + Records Packet's own evidence-
-- index rule ("It should not become a second repository of private Host
-- content.").
--
-- IMPORTANT -- EVIDENCE IS EVIDENCE. IT DOES NOT DECIDE ANYTHING.
--
-- This table does not determine certification, does not calculate
-- certification readiness, and does not automatically change
-- guide_candidates.status or guide_certifications in any way. A
-- 'development_required' or 'critical_fail' finding here is a fact about
-- one piece of evidence -- whether/when that should affect a candidate's
-- lifecycle status or a future certification decision remains a separate,
-- later, human institutional judgment (the later certification-decision
-- architecture), never automated from this table. Nothing in this
-- migration is read by any live request path.
--
-- IMPORTANT -- NO SINGLE "14 COMPETENCY DOMAIN" LIST EXISTS TO RECORD.
--
-- The certification source materials define three different, differently
-- grouped competency enumerations across documents (curriculum domains,
-- practicum rubric rows, evaluator training focus) -- none of them a
-- single database-ready list. What IS consistent across every source
-- document is the 12 required evidence instruments below (Assessment
-- Instruments Instrument 11 / Candidate Pathway Appendix A), which is why
-- evidence_type enumerates instruments, not competencies. There is no
-- one-row-per-competency structure here, and none should be added later
-- without a fresh, separately-approved audit.
-- ============================================================================

create table if not exists public.guide_candidate_evidence (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.guide_candidates (id) on delete cascade,
  evidence_type text not null check (evidence_type in (
                  'candidate_agreement', 'foundations_knowledge_check', 'judgment_scenarios',
                  'table_building_exercise', 'recognition_assessment', 'conversation_review',
                  'practice_facilitation', 'toolkit_experience_assembly', 'boundary_gate',
                  'observed_practicum', 'guides_record_sample', 'reflection_debrief'
                )),
  -- Not nullable, by design -- every recorded piece of evidence carries a
  -- human evaluator's finding. Multiple rows of the same evidence_type are
  -- intentional and expected: a later reassessment adds a new row rather
  -- than overwriting an earlier one, preserving the full evidence history
  -- the same way guide_candidate_history never overwrites prior entries.
  rating        text not null check (rating in ('competent', 'development_required', 'critical_fail')),
  -- Evaluator rationale describing demonstrated stewardship behavior --
  -- see the privacy principle above. NOT Host story/content.
  summary       text not null,
  recorded_by   uuid references auth.users (id) on delete set null,
  recorded_at   timestamptz not null default now()
);

create index if not exists guide_candidate_evidence_candidate_idx
  on public.guide_candidate_evidence (candidate_id, recorded_at);

alter table public.guide_candidate_evidence enable row level security;

-- Same join-back self-read shape already used by guide_candidate_history
-- (0022) -- no direct host_id column here either; ownership is via the
-- parent candidacy.
create policy "guide candidate evidence self read"
  on public.guide_candidate_evidence for select
  using (exists (
    select 1 from public.guide_candidates c
    where c.id = candidate_id and c.host_id = auth.uid()
  ));

-- Current role='admin' institutional-management pattern only -- no
-- evaluator role/permission exists yet (Founder Decision + Launch
-- Readiness Book explicitly leaves "First evaluator authority" open).
-- recorded_by is a plain auth.users reference, not constrained to admin at
-- the column level, so a future evaluator model only needs a new RLS
-- policy here, never a schema change.
create policy "guide candidate evidence admin all"
  on public.guide_candidate_evidence for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
