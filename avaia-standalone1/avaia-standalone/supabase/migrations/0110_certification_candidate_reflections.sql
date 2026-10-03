-- 0110_certification_candidate_reflections.sql
--
-- Candidate Workbook, the minimum persistent piece the Certification
-- Classroom needs: the candidate's own written response to a lesson's
-- existing workbook reflection prompt, saved, returned to, and edited.
--
-- Additive only: one new table. It does not touch the curriculum registry
-- (certification_curriculum_items), progress (certification_candidate_
-- progress), evidence (guide_candidate_evidence), or any other table, and it
-- does not re-seed anything. Safe to re-run (idempotent).
--
-- PRIVACY, ENFORCED IN THE DATABASE: a candidate's reflections belong to the
-- candidate. There is deliberately NO admin policy on this table, so even an
-- admin's own RLS-bound client cannot read a candidate's reflections. This
-- mirrors the Candidate Workbook source's own rule ("not a Host record...
-- belongs to the candidate's certification process"). No operational, digest,
-- or admin surface reads this table. Nothing here is interpreted, scored, or
-- evaluated by anything: it is the candidate's own writing and nothing else.
-- (The service-role key bypasses RLS in general, as it does everywhere in
-- AVAIA; no application code reads this table with it.)
--
-- Writes are limited to a candidacy that is currently active (admitted,
-- in_training, or development_required). A candidate can always read their
-- own rows.

create table if not exists certification_candidate_reflections (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references guide_candidates(id) on delete cascade,
  item_key text not null check (item_key like 'lesson-%'),
  -- A lesson can carry more than one reflection prompt; the index is the
  -- prompt's position in the lesson's existing workbook field.
  prompt_index integer not null default 0 check (prompt_index >= 0),
  response text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, item_key, prompt_index)
);

create index if not exists certification_candidate_reflections_candidate_idx
  on certification_candidate_reflections (candidate_id, item_key);

alter table certification_candidate_reflections enable row level security;

do $$ begin
  create policy "certification candidate reflections self read" on certification_candidate_reflections for select
    using (exists (
      select 1 from guide_candidates c
      where c.id = certification_candidate_reflections.candidate_id and c.host_id = auth.uid()
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "certification candidate reflections self insert" on certification_candidate_reflections for insert
    with check (exists (
      select 1 from guide_candidates c
      where c.id = certification_candidate_reflections.candidate_id
        and c.host_id = auth.uid()
        and c.status in ('admitted', 'in_training', 'development_required')
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "certification candidate reflections self update" on certification_candidate_reflections for update
    using (exists (
      select 1 from guide_candidates c
      where c.id = certification_candidate_reflections.candidate_id and c.host_id = auth.uid()
    ))
    with check (exists (
      select 1 from guide_candidates c
      where c.id = certification_candidate_reflections.candidate_id
        and c.host_id = auth.uid()
        and c.status in ('admitted', 'in_training', 'development_required')
    ));
exception when duplicate_object then null; end $$;

comment on table certification_candidate_reflections is
  'A certification candidate''s own written responses to lesson workbook prompts. Candidate-private: no admin policy by design; never read by operations, digests, or admin surfaces; never interpreted or scored.';


-- Cron health tracking for the two certification schedules the classroom
-- work adds (certification-operations, certification-companion). Widens the
-- same check 0074/0076/0079 widened; it only accepts the two new names and
-- changes no existing row.
--
-- Guarded: if the cron_runs table does not exist in a given database (its
-- own migration, 0074, was never applied there), this step does nothing
-- instead of failing the whole script. Nothing in the classroom depends on it.
do $$
begin
  if to_regclass('public.cron_runs') is not null then
    alter table public.cron_runs drop constraint if exists cron_runs_cron_name_check;
    alter table public.cron_runs
      add constraint cron_runs_cron_name_check
      check (cron_name in (
        'host-onboarding', 'guide-operations', 'founder-digest',
        'entitlement-reconciliation', 'guardian-consent-reminder',
        'family-invite-reminder',
        'certification-operations', 'certification-companion'
      ));
  end if;
end $$;

-- Verification (read-only): the table exists, RLS is on, and there is no
-- admin policy on it.
select
  (select count(*) from certification_candidate_reflections) as rows_now,
  (select relrowsecurity from pg_class where relname = 'certification_candidate_reflections') as rls_enabled,
  (select count(*) from pg_policies where tablename = 'certification_candidate_reflections') as policies;
