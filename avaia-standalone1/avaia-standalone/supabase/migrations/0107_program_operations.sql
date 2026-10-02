-- The AVAIA Program Operations Agent's data layer: post-certification
-- specialty-program authorization. Purely additive: five new tables.
--
-- AUDIT FINDING THIS MIGRATION IS SCOPED TO (see the final report for the
-- full audit): guide_platform_authorizations exists and is real/wired, but
-- its `capability` CHECK constraint allows exactly two values --
-- 'toolkit' and 'guided_journey_facilitation' -- both coarse platform
-- gates. There is no per-program authorization concept anywhere in the
-- schema: /toolkit/defying-grief and /toolkit/unsung-heroes are both
-- gated by the single app/toolkit/layout.tsx check (isGuideToolkitAuthorized),
-- which only looks at the generic 'toolkit' capability. A Guide authorized
-- for the Toolkit at all can reach both program sections today -- "has
-- this Guide learned and demonstrated how to facilitate this particular
-- program" is not tracked anywhere. View from Above has no Guide-
-- facilitated flow in the app at all (book content only). Shared Room has
-- no implementation anywhere outside curriculum text. Youth is listed in
-- the Toolkit tool registry as "not-yet-specified" with no guardian-
-- consent/assent model. None of those three are activated here.
--
-- MODEL, deliberately mirroring the existing certification schema
-- (0100_certification_schema_baseline.sql) field-for-field where the
-- shape matches, rather than inventing a new convention:
--   guide_candidates              -> program_authorization_enrollments
--   guide_certifications          -> program_authorizations
--   guide_candidate_evidence      -> program_authorization_evidence
--   guide_candidate_history       -> program_authorization_history
-- One shared engine for every program (item 3's "do not create five
-- independent authorization systems") -- `program` is a column, not five
-- separate table sets. The CHECK constraint on `program` lists only
-- 'defying_grief' and 'unsung_heroes' -- the two this build fully
-- operationalizes. Adding 'view_from_above' / 'shared_room' /
-- 'youth_facilitation' later is a one-line additive CHECK change once
-- each program's own infrastructure is actually ready; listing them now,
-- unused, would let a row be created for a program with no real workflow
-- behind it, which is exactly the "pretending those three are ready
-- today" the governing instruction prohibits.
--
-- HUMAN AUTHORIZATION BOUNDARY, enforced structurally: there is no
-- 'authorized' value in program_authorization_enrollments.status. An
-- authorization only exists as a fact once a human creates a row in
-- program_authorizations -- the exact same split guide_candidates /
-- guide_certifications already uses, so "ready for human review" and
-- "authorized" can never be the same stored state by construction.
--
-- CANDIDATE/EVALUATOR ISOLATION: program_authorization_evidence keeps the
-- same self-read + admin-all RLS shape as guide_candidate_evidence
-- (established, already-approved precedent). program_authorization_history
-- keeps the same posture as guide_candidate_history: RLS enabled, zero
-- policies -- admin/service-role access only, nothing a Guide's own
-- session can read. The real isolation lever is at the application layer
-- (see lib/program-operations.ts and the Guide-facing view): the Guide-
-- facing code never queries evidence or history at all, regardless of
-- what RLS would technically allow, per the governing instruction's own
-- wording -- a Guide must not receive evaluator-only material "merely
-- because those records exist in the same database."

-- ---------------------------------------------------------------------------
-- program_authorization_enrollments -- one row per (Guide, program). Not
-- unique on (host_id, program): if a program authorization is later
-- revoked and the Guide re-enrolls, that is a new, real enrollment event
-- worth its own row, exactly like a candidate could in principle restart
-- candidacy. "Current" is resolved the same way every other append-style
-- table in this codebase resolves "current": latest updated_at.
-- ---------------------------------------------------------------------------
create table if not exists public.program_authorization_enrollments (
  id                          uuid primary key default gen_random_uuid(),
  host_id                     uuid not null references auth.users (id) on delete cascade,
  program                     text not null check (program in ('defying_grief', 'unsung_heroes')),
  version                     text,
  status                      text not null default 'enrolled' check (status in (
                                'enrolled', 'in_training', 'practice_evidence', 'ready_for_human_review',
                                'development_required', 'not_authorized', 'paused', 'withdrawn'
                              )),
  evaluator_id                uuid references auth.users (id) on delete set null,
  ready_for_review            boolean not null default false,
  ready_for_review_notes      text,
  ready_for_review_marked_at  timestamptz,
  ready_for_review_marked_by  uuid references auth.users (id) on delete set null,
  enrolled_at                 timestamptz not null default now(),
  enrolled_by                 uuid references auth.users (id) on delete set null,
  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists program_authorization_enrollments_host_idx
  on public.program_authorization_enrollments (host_id, program, updated_at desc);

alter table public.program_authorization_enrollments enable row level security;
do $$ begin
  create policy "program authorization enrollments self read" on public.program_authorization_enrollments
    for select using (auth.uid() = host_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "program authorization enrollments admin all" on public.program_authorization_enrollments
    for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- program_authorizations -- the human decision + ongoing standing. Mirrors
-- guide_certifications exactly. A row here is the only fact that means
-- "this Guide is authorized for this program" -- nothing in
-- program_authorization_enrollments.status can represent that on its own.
-- ---------------------------------------------------------------------------
create table if not exists public.program_authorizations (
  id                    uuid primary key default gen_random_uuid(),
  enrollment_id         uuid not null references public.program_authorization_enrollments (id) on delete cascade,
  host_id               uuid not null references auth.users (id) on delete cascade,
  program               text not null check (program in ('defying_grief', 'unsung_heroes')),
  authorized_at         timestamptz not null default now(),
  authorized_by         uuid references auth.users (id) on delete set null,
  standing              text not null default 'active' check (standing in ('active', 'paused', 'revoked')),
  standing_changed_at   timestamptz not null default now(),
  standing_changed_by   uuid references auth.users (id) on delete set null,
  standing_notes        text
);

create index if not exists program_authorizations_host_idx
  on public.program_authorizations (host_id, program);

alter table public.program_authorizations enable row level security;
do $$ begin
  create policy "program authorizations self read" on public.program_authorizations
    for select using (auth.uid() = host_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "program authorizations admin all" on public.program_authorizations
    for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- program_authorization_evidence -- mirrors guide_candidate_evidence
-- exactly, including its rating vocabulary (critical_fail is never
-- averaged away -- see lib/program-operations.ts). evidence_type is kept
-- operationally generic (training/practice/observation/evaluator review/
-- reflection) rather than inventing Defying-Grief- or Unsung-Heroes-
-- specific assessment names this build has no source material for.
-- ---------------------------------------------------------------------------
create table if not exists public.program_authorization_evidence (
  id              uuid primary key default gen_random_uuid(),
  enrollment_id   uuid not null references public.program_authorization_enrollments (id) on delete cascade,
  evidence_type   text not null check (evidence_type in (
                    'training_progress_check', 'practice_facilitation', 'observed_session',
                    'evaluator_review', 'reflection_debrief'
                  )),
  rating          text not null check (rating in ('competent', 'development_required', 'critical_fail')),
  summary         text not null,
  recorded_by     uuid references auth.users (id) on delete set null,
  recorded_at     timestamptz not null default now()
);

alter table public.program_authorization_evidence enable row level security;
do $$ begin
  create policy "program authorization evidence self read" on public.program_authorization_evidence
    for select using (
      exists (
        select 1 from public.program_authorization_enrollments e
        where e.id = program_authorization_evidence.enrollment_id and e.host_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "program authorization evidence admin all" on public.program_authorization_evidence
    for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- program_authorization_history -- mirrors guide_candidate_history exactly,
-- including its posture: RLS enabled, zero policies. Admin/service-role
-- access only -- no authenticated session, Guide or otherwise, can read
-- this table directly.
-- ---------------------------------------------------------------------------
create table if not exists public.program_authorization_history (
  id              uuid primary key default gen_random_uuid(),
  enrollment_id   uuid not null references public.program_authorization_enrollments (id) on delete cascade,
  entry_type      text not null check (entry_type in (
                    'note', 'status_change', 'development_event', 'evaluation_note', 'decision_event'
                  )),
  body            text not null,
  recorded_by     uuid references auth.users (id) on delete set null,
  recorded_at     timestamptz not null default now()
);

alter table public.program_authorization_history enable row level security;
-- Deliberately no self-read/admin policy, matching guide_candidate_history's
-- own documented posture exactly -- left as-is rather than inventing a
-- policy that table's own precedent doesn't have.

-- ---------------------------------------------------------------------------
-- program_authorization_reminders -- idempotency/cooldown tracking, same
-- shape and purpose as host_onboarding_reminders / guide_candidate_reminders
-- (0064).
-- ---------------------------------------------------------------------------
create table if not exists public.program_authorization_reminders (
  id              uuid primary key default gen_random_uuid(),
  enrollment_id   uuid not null references public.program_authorization_enrollments (id) on delete cascade,
  reminder_type   text not null check (reminder_type in (
                    'evaluator_task_reminder', 'ready_for_review_notification', 'stale_training_reminder',
                    'human_decision_notification', 'reassessment_reminder', 'permission_mismatch_alert'
                  )),
  sent_at         timestamptz not null default now()
);

create index if not exists program_authorization_reminders_enrollment_idx
  on public.program_authorization_reminders (enrollment_id, reminder_type, sent_at desc);

alter table public.program_authorization_reminders enable row level security;
do $$ begin
  create policy "program authorization reminders admin all" on public.program_authorization_reminders
    for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;
