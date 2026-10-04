-- 0116_certification_move6.sql
--
-- Guide Certification completion (Move 6). Additive and safe to re-run.
--
--   1. Evidence vocabulary: 'host_seat_experience' (the candidate's own
--      Host-seat experience) joins the evidence_type check. Existing rows and
--      the other twelve types are unchanged.
--   2. Entitlements: 'candidacy' joins the source check. Admission gives a
--      candidate the AVAIA access needed to certify; it is tied to candidacy and
--      is not a permanent free membership. Someone who already has a membership
--      keeps it untouched (no candidacy row is created for them).
--   3. certification_applications: the front door. A signed-in person applies
--      (no fee) and saves a payment method (no charge). A human reviews and
--      decides admission. Only if admitted is the $1,495 charged to the saved
--      method. Two gates: admission makes a Candidate; certification makes a Guide.
--   4. Human evaluation records, admin-only (a candidate cannot read them;
--      people communicate outcomes): the ten-item Boundary Gate, the Universal
--      Practice Lab Evaluation per lab, the 11-row Observed Practicum rubric.
--      The system only adds up what a human recorded.
--   5. AI Host practice (candidate-private, no admin policy, never scored; token usage
--      is recorded as telemetry, widened in section 6): the
--      AI plays the Host from the Host Card only. It never evaluates anyone.

-- 1 ---------------------------------------------------------------------------
alter table public.guide_candidate_evidence drop constraint if exists guide_candidate_evidence_evidence_type_check;
alter table public.guide_candidate_evidence add constraint guide_candidate_evidence_evidence_type_check
  check (evidence_type = any (array[
    'candidate_agreement','foundations_knowledge_check','judgment_scenarios','table_building_exercise',
    'recognition_assessment','conversation_review','practice_facilitation','toolkit_experience_assembly',
    'boundary_gate','observed_practicum','guides_record_sample','reflection_debrief','host_seat_experience'
  ]));

-- 2 ---------------------------------------------------------------------------
alter table public.entitlements drop constraint if exists entitlements_source_check;
alter table public.entitlements add constraint entitlements_source_check
  check (source in
    ('individual', 'supported', 'family', 'gift', 'sponsored', 'organization', 'founder_test', 'candidacy'));

-- 3 ---------------------------------------------------------------------------
create table if not exists public.certification_applications (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  -- Prospectus v0.1 application fields. Nothing else is collected.
  full_name text not null,
  contact text not null,
  why_interested text not null,
  work_context text not null,
  how_use_avaia text not null,
  pathway text not null check (pathway in ('core_certification', 'other_permission')),
  pathway_note text,
  orientation_agreed boolean not null default false,
  -- pending_payment_method: submitted, card not saved yet (nothing to review)
  -- ready_for_review:       card saved, waiting for a human admission decision
  -- admitted / not_admitted: the human decision (Gate 1)
  status text not null default 'pending_payment_method'
    check (status in ('pending_payment_method', 'ready_for_review', 'admitted', 'not_admitted')),
  submitted_at timestamptz not null default now(),
  -- Saved payment method (Stripe setup mode). Never charged before admission.
  stripe_customer_id text,
  stripe_setup_session_id text,
  stripe_payment_method_id text,
  payment_method_saved_at timestamptz,
  -- The human admission decision.
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  decision_note text,
  candidate_id uuid references public.guide_candidates(id) on delete set null,
  -- Charge, only after admission. A failed charge never revokes admission.
  charge_status text not null default 'not_charged'
    check (charge_status in ('not_charged', 'charging', 'charged', 'failed', 'not_applicable')),
  charge_attempts integer not null default 0,
  charge_payment_intent_id text,
  charge_failure text,
  charged_at timestamptz,
  -- Denial handling (messaging, reapplication, refund policy) is not decided.
  -- Until the owner marks a not-admitted application handled, it stays visible.
  denial_handled boolean not null default false,
  updated_at timestamptz not null default now()
);

create unique index if not exists certification_applications_one_open_per_host
  on public.certification_applications (host_id)
  where status in ('pending_payment_method', 'ready_for_review');
create index if not exists certification_applications_status_idx
  on public.certification_applications (status, submitted_at);

alter table public.certification_applications enable row level security;

do $$ begin
  create policy "certification applications self read" on public.certification_applications for select
    using (auth.uid() = host_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "certification applications self insert" on public.certification_applications for insert
    with check (auth.uid() = host_id and status = 'pending_payment_method' and charge_status = 'not_charged');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "certification applications admin all" on public.certification_applications for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

comment on table public.certification_applications is
  'Guide certification applications. Application plus a saved payment method (no charge), then a human admission decision; the $1,495 is charged only after admission. Admission makes a Candidate, never a Certified Guide (Decision 0004).';

-- 4 ---------------------------------------------------------------------------
-- Admin-only: no candidate policy. A candidate learns outcomes from a person.
create table if not exists public.certification_gate_evaluations (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.guide_candidates(id) on delete cascade,
  evaluator_id uuid references auth.users(id) on delete set null,
  -- ten Boundary Gate items -> 'met' | 'not_met'
  items jsonb not null check (jsonb_typeof(items) = 'object'),
  all_met boolean not null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists certification_gate_evaluations_candidate_idx
  on public.certification_gate_evaluations (candidate_id, created_at desc);

create table if not exists public.certification_lab_evaluations (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.guide_candidates(id) on delete cascade,
  lab_key text not null check (lab_key like 'lab-%'),
  evaluator_id uuid references auth.users(id) on delete set null,
  -- Universal Practice Lab Evaluation: nine criteria + the four-part
  -- Candidate Feedback Response (receive, understand, adjust, try_again).
  ratings jsonb not null check (jsonb_typeof(ratings) = 'object'),
  feedback_response jsonb not null check (jsonb_typeof(feedback_response) = 'object'),
  -- The Retry Rule: a retry changes the story and preserves the competency.
  targeted_retry_required boolean not null default false,
  -- The evaluator's own confirmation that this lab's conditions are met.
  lab_complete boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists certification_lab_evaluations_candidate_idx
  on public.certification_lab_evaluations (candidate_id, lab_key, created_at desc);

create table if not exists public.certification_practicum_evaluations (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.guide_candidates(id) on delete cascade,
  evaluator_id uuid references auth.users(id) on delete set null,
  -- eleven rubric rows -> 'not_yet' | 'developing' | 'meets'
  rows jsonb not null check (jsonb_typeof(rows) = 'object'),
  all_meets boolean not null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists certification_practicum_evaluations_candidate_idx
  on public.certification_practicum_evaluations (candidate_id, created_at desc);

alter table public.certification_gate_evaluations enable row level security;
alter table public.certification_lab_evaluations enable row level security;
alter table public.certification_practicum_evaluations enable row level security;

do $$ begin
  create policy "certification gate evaluations admin all" on public.certification_gate_evaluations for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "certification lab evaluations admin all" on public.certification_lab_evaluations for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "certification practicum evaluations admin all" on public.certification_practicum_evaluations for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- 5 ---------------------------------------------------------------------------
-- Candidate-private practice conversations with an AI playing the Host. There is
-- deliberately NO admin policy: the practice belongs to the candidate. Nothing
-- reads these to evaluate, score or certify; the AI never does.
create table if not exists public.certification_practice_sessions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.guide_candidates(id) on delete cascade,
  lab_key text not null check (lab_key like 'lab-%'),
  -- Lab 12 has Scenarios A, B and C; other labs use null.
  scenario text,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists certification_practice_sessions_candidate_idx
  on public.certification_practice_sessions (candidate_id, created_at desc);

create table if not exists public.certification_practice_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.certification_practice_sessions(id) on delete cascade,
  role text not null check (role in ('candidate', 'host')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists certification_practice_messages_session_idx
  on public.certification_practice_messages (session_id, created_at);

alter table public.certification_practice_sessions enable row level security;
alter table public.certification_practice_messages enable row level security;

do $$ begin
  create policy "certification practice sessions self read" on public.certification_practice_sessions for select
    using (exists (select 1 from public.guide_candidates c where c.id = certification_practice_sessions.candidate_id and c.host_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "certification practice sessions self insert" on public.certification_practice_sessions for insert
    with check (exists (
      select 1 from public.guide_candidates c
      where c.id = certification_practice_sessions.candidate_id and c.host_id = auth.uid()
        and c.status in ('admitted', 'in_training', 'development_required')));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "certification practice sessions self update" on public.certification_practice_sessions for update
    using (exists (select 1 from public.guide_candidates c where c.id = certification_practice_sessions.candidate_id and c.host_id = auth.uid()))
    with check (exists (select 1 from public.guide_candidates c where c.id = certification_practice_sessions.candidate_id and c.host_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "certification practice messages self read" on public.certification_practice_messages for select
    using (exists (
      select 1 from public.certification_practice_sessions s
      join public.guide_candidates c on c.id = s.candidate_id
      where s.id = certification_practice_messages.session_id and c.host_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "certification practice messages self insert" on public.certification_practice_messages for insert
    with check (exists (
      select 1 from public.certification_practice_sessions s
      join public.guide_candidates c on c.id = s.candidate_id
      where s.id = certification_practice_messages.session_id and c.host_id = auth.uid()
        and c.status in ('admitted', 'in_training', 'development_required')));
exception when duplicate_object then null; end $$;

comment on table public.certification_practice_sessions is
  'Candidate-private AI-Host practice sessions. No admin policy by design. AI supports practice; it never evaluates, scores or certifies.';


-- 6 ---------------------------------------------------------------------------
-- AI usage telemetry for the AI Host practice (token counts only, never content).
alter table public.ai_usage_events drop constraint if exists ai_usage_events_feature_check;
alter table public.ai_usage_events add constraint ai_usage_events_feature_check check (feature in (
  'iap_conversation', 'cat_conversation', 'innercompass_conversation',
  'iap_referral', 'cat_referral', 'innercompass_referral',
  'cat_opening', 'innercompass_opening', 'iap_origin_opening',
  'unsung_heroes_recognition', 'unsung_heroes_conversation',
  'chemistry_virtue_formula', 'transcript_cleanup',
  'preparation_snapshot', 'preparation_chat',
  'room_conversation', 'room_referral', 'room_bring_forward_suggestion',
  'unsaid_conversation', 'prospect_research', 'founder_note_extraction',
  'certification_practice_host'
));

-- Verification (read-only).
select
  (select count(*) from public.certification_applications) as applications,
  (select count(*) from pg_policies where tablename = 'certification_applications') as application_policies,
  (select count(*) from pg_policies where tablename in ('certification_practice_sessions', 'certification_practice_messages') and policyname like '%admin%') as practice_admin_policies_must_be_zero,
  (select pg_get_constraintdef(oid) like '%host_seat_experience%' from pg_constraint where conname = 'guide_candidate_evidence_evidence_type_check') as evidence_check_widened,
  (select pg_get_constraintdef(oid) like '%candidacy%' from pg_constraint where conname = 'entitlements_source_check') as entitlement_source_widened;
