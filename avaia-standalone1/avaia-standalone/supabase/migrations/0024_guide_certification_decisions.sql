-- Certified AVAIA Guide — certification decision records (Phase C.7B).
-- Purely additive: one new table, zero alter statements on any existing
-- table, zero application code changes required to register it.
--
-- Three institutional facts now exist as three separate tables, none
-- collapsed into another:
--   guide_candidate_evidence        -- what the candidate demonstrated
--   guide_certification_decisions   -- what AVAIA decided at a review, and
--                                       what record supports that decision
--   guide_certifications             -- whether AVAIA actually certified the
--                                       person, and current standing
--
-- Modeled directly on the Program Operations + Records Packet's Form 9 --
-- Certification Decision Record, and the three-value decision vocabulary
-- used identically across Instrument 11 (Assessment Instruments),
-- Evaluator Handbook §20, and Candidate Pathway + Assessment §11.
--
-- ============================================================================
-- IMPORTANT -- GOVERNING DISTINCTIONS PRESERVED BY THIS TABLE
--
-- 1. Certification decisions are append-only institutional review records.
--    A candidate may accumulate multiple decision rows over time (e.g. an
--    earlier 'development_required' followed by a later 'certified') --
--    every row is permanent; none is ever updated or superseded in place.
--
-- 2. A certification decision is separate from certification standing.
--    This table records what AVAIA decided at a review. guide_certifications
--    records whether AVAIA actually certified the person and the ongoing
--    institutional standing of that certification. They answer different
--    questions and must not be merged.
--
-- 3. Recording a decision does not itself create guide_certifications.
--    Even a 'certified' decision row here does not, by itself, create or
--    modify any guide_certifications row -- that remains a separate,
--    deliberate, later action (not built in this phase).
--
-- 4. Recording a decision does not automatically change
--    guide_candidates.status. Candidate lifecycle status stays a separate,
--    manual, human decision through the existing status control.
--
-- 5. Recording a decision does not grant platform authorization. It never
--    touches profiles.role, Toolkit access, Guided Journey access, Youth
--    Guide permission, Experience permission, or any other capability.
--
-- 6. evidence_complete_attested and critical_fail_gates_clear_attested
--    preserve the human/institutional attestations made AT DECISION TIME.
--    They are not live-derived values -- evidence continues to accumulate
--    in guide_candidate_evidence after a decision is recorded, and this
--    table intentionally freezes what was attested at the moment of that
--    specific decision, so a historical decision record never silently
--    appears to say something different later.
--
-- 7. decision_date, evaluated_at, and authorized_at represent distinct
--    institutional acts, preserved as Form 9 itself does (a decision date,
--    a separate evaluator signature date, and a separate AVAIA
--    authorization date) -- even when all three happen on the same day in
--    practice, they are not collapsed into one timestamp.
-- ============================================================================

create table if not exists public.guide_certification_decisions (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.guide_candidates (id) on delete cascade,
  -- Denormalized for direct host-keyed queries, consistent with
  -- guide_certifications.host_id.
  host_id      uuid not null references auth.users (id) on delete cascade,
  decision     text not null check (decision in ('certified', 'development_required', 'not_currently_eligible')),
  decision_date timestamptz not null default now(),
  decision_rationale text not null,
  continuing_development_notes text,
  evidence_complete_attested boolean not null,
  critical_fail_gates_clear_attested boolean not null,
  curriculum_version text,
  guide_manual_version text,
  assessment_packet_version text,
  -- evaluated_by/authorized_by are nullable, matching every other
  -- attribution column in this schema (certified_by, admitted_by,
  -- recorded_by) -- a NOT NULL column cannot coexist with ON DELETE SET
  -- NULL. The same account may occupy both roles; nothing here requires
  -- them to differ.
  evaluated_by uuid references auth.users (id) on delete set null,
  evaluated_at timestamptz not null default now(),
  authorized_by uuid references auth.users (id) on delete set null,
  authorized_at timestamptz not null default now()
);

create index if not exists guide_certification_decisions_candidate_idx
  on public.guide_certification_decisions (candidate_id, decision_date);

alter table public.guide_certification_decisions enable row level security;

-- Admin-all only for this phase -- no candidate self-read. Candidate
-- visibility of internal certification decision records (evaluator
-- rationale, development notes) remains an open founder decision, not
-- resolved here; admin-only is the safe, reversible default until it is.
create policy "guide certification decisions admin all"
  on public.guide_certification_decisions for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
