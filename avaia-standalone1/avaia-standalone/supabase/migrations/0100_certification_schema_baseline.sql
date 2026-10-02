-- 0100_certification_schema_baseline.sql
--
-- RECONCILIATION, NOT NEW SCHEMA. The Guide Certification data model
-- (guide_candidates and everything below) already exists and is live in
-- production -- it was applied directly against the database outside both
-- this repo's migrations/ folder and Supabase's own tracked Management-API
-- migration history (confirmed via SUPABASE_LIST_MIGRATION_HISTORY, which
-- lists only 0063_pink_shoelace_foundation, 0064_operational_reminder_tracking,
-- pink_partnership_donor_linkage, 0072_partnership_donor_program_prospects,
-- 0073_command_center, and agent_system_completion -- none of which create
-- any guide_candidate_*/guide_certification_* table). lib/ops/guide-operations.ts
-- even comments that this schema came from "migrations 0022, 0024, 0062",
-- none of which exist in supabase/migrations/ either.
--
-- This migration captures the schema AS IT ACTUALLY STANDS in production
-- today, column-for-column, constraint-for-constraint, and policy-for-policy,
-- confirmed by direct introspection of information_schema.columns,
-- pg_constraint, and pg_policies on project fupalguhcdlxosocbymc immediately
-- before writing this file. Every statement below is written
-- IF NOT EXISTS / DO-block-guarded so it is safe to run against the
-- database that already has these objects -- it changes nothing live; it
-- makes the repository tell the truth about what is already there, so the
-- Certification Companion migration that follows (0101) can declare real
-- foreign keys into this schema instead of guessing at it.
--
-- Nothing here was redesigned. No column, constraint, or policy below
-- differs from what is live today.

-- ============================================================= guide_candidates
create table if not exists guide_candidates (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'admitted'
    check (status = any (array['admitted','in_training','development_required','paused','hold','withdrawn','not_certified'])),
  admitted_at timestamptz not null default now(),
  admitted_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_for_review boolean not null default false,
  ready_for_review_notes text,
  ready_for_review_marked_at timestamptz,
  ready_for_review_marked_by uuid references auth.users(id) on delete set null
);
alter table guide_candidates enable row level security;
do $$ begin
  create policy "guide candidates self read" on guide_candidates for select using (auth.uid() = host_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "guide candidates admin all" on guide_candidates for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ===================================================== guide_candidate_history
create table if not exists guide_candidate_history (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references guide_candidates(id) on delete cascade,
  entry_type text not null
    check (entry_type = any (array['note','status_change','development_event','evaluation_note','certification_event','document_received'])),
  body text not null,
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);
alter table guide_candidate_history enable row level security;
-- Live production has no self-read/admin policies listed for this table at
-- the time of this dump beyond RLS being enabled; left exactly as found
-- rather than inventing a policy that doesn't exist today.

-- ==================================================== guide_candidate_evidence
create table if not exists guide_candidate_evidence (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references guide_candidates(id) on delete cascade,
  evidence_type text not null
    check (evidence_type = any (array['candidate_agreement','foundations_knowledge_check','judgment_scenarios','table_building_exercise','recognition_assessment','conversation_review','practice_facilitation','toolkit_experience_assembly','boundary_gate','observed_practicum','guides_record_sample','reflection_debrief'])),
  rating text not null check (rating = any (array['competent','development_required','critical_fail'])),
  summary text not null,
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);
alter table guide_candidate_evidence enable row level security;
do $$ begin
  create policy "guide candidate evidence self read" on guide_candidate_evidence for select
    using (exists (select 1 from guide_candidates c where c.id = guide_candidate_evidence.candidate_id and c.host_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "guide candidate evidence admin all" on guide_candidate_evidence for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ===================================================== guide_candidate_reminders
create table if not exists guide_candidate_reminders (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references guide_candidates(id) on delete cascade,
  host_id uuid references auth.users(id) on delete cascade,
  reminder_type text not null check (reminder_type = any (array['candidacy_stalled','paid_awaiting_decision'])),
  sent_at timestamptz not null default now(),
  constraint guide_candidate_reminders_key_matches_type check (
    (reminder_type = 'candidacy_stalled' and candidate_id is not null)
    or (reminder_type = 'paid_awaiting_decision' and host_id is not null)
  )
);
alter table guide_candidate_reminders enable row level security;
do $$ begin
  create policy "guide candidate reminders admin all" on guide_candidate_reminders for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ========================================================= guide_certifications
create table if not exists guide_certifications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references guide_candidates(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  certified_at timestamptz not null default now(),
  certified_by uuid references auth.users(id) on delete set null,
  standing text not null default 'active' check (standing = any (array['active','paused','revoked'])),
  standing_changed_at timestamptz not null default now(),
  standing_changed_by uuid references auth.users(id) on delete set null,
  standing_notes text
);
alter table guide_certifications enable row level security;
do $$ begin
  create policy "guide certifications self read" on guide_certifications for select using (auth.uid() = host_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "guide certifications admin all" on guide_certifications for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ================================================= guide_certification_decisions
create table if not exists guide_certification_decisions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references guide_candidates(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision = any (array['certified','development_required','not_currently_eligible'])),
  decision_date timestamptz not null default now(),
  decision_rationale text not null,
  continuing_development_notes text,
  evidence_complete_attested boolean not null,
  critical_fail_gates_clear_attested boolean not null,
  curriculum_version text,
  guide_manual_version text,
  assessment_packet_version text,
  evaluated_by uuid references auth.users(id) on delete set null,
  evaluated_at timestamptz not null default now(),
  authorized_by uuid references auth.users(id) on delete set null,
  authorized_at timestamptz not null default now()
);
alter table guide_certification_decisions enable row level security;
do $$ begin
  create policy "guide certification decisions admin all" on guide_certification_decisions for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ================================================== guide_certification_payments
create table if not exists guide_certification_payments (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  amount_cents integer not null,
  currency text not null default 'usd',
  paid_at timestamptz not null default now()
);
alter table guide_certification_payments enable row level security;
do $$ begin
  create policy "guide certification payments self read" on guide_certification_payments for select using (auth.uid() = host_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "guide certification payments admin all" on guide_certification_payments for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ================================================= guide_platform_authorizations
create table if not exists guide_platform_authorizations (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  capability text not null check (capability = any (array['toolkit','guided_journey_facilitation'])),
  status text not null default 'authorized' check (status = any (array['authorized','revoked'])),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  status_changed_by uuid references auth.users(id) on delete set null,
  status_changed_at timestamptz not null default now(),
  notes text
);
alter table guide_platform_authorizations enable row level security;
do $$ begin
  create policy "guide platform authorizations self read" on guide_platform_authorizations for select using (auth.uid() = host_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "guide platform authorizations admin all" on guide_platform_authorizations for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ============================================================ organizations
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_type text not null default 'other' check (org_type = any (array['school','community_org','other'])),
  contact_name text,
  contact_email text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table organizations enable row level security;
do $$ begin
  create policy "organizations creator write" on organizations for all
    using (created_by = auth.uid()) with check (created_by = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "organizations guide read" on organizations for select
    using (exists (select 1 from guide_platform_authorizations a where a.host_id = auth.uid() and a.capability = 'toolkit' and a.status = 'authorized'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "organizations admin all" on organizations for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ======================================================== organization_admins
create table if not exists organization_admins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'authorized' check (status = any (array['authorized','revoked'])),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  status_changed_by uuid references auth.users(id) on delete set null,
  status_changed_at timestamptz not null default now(),
  notes text
);
alter table organization_admins enable row level security;
do $$ begin
  create policy "organization admins self read" on organization_admins for select using (auth.uid() = host_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "organization admins platform admin all" on organization_admins for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ======================================================== organization_guides
create table if not exists organization_guides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  guide_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'connected' check (status = any (array['connected','disconnected'])),
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  status_changed_by uuid references auth.users(id) on delete set null,
  status_changed_at timestamptz not null default now(),
  unique (organization_id, guide_id)
);
alter table organization_guides enable row level security;
do $$ begin
  create policy "organization guides self read" on organization_guides for select using (auth.uid() = guide_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "organization guides platform admin all" on organization_guides for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- =========================================================== guide_journey_access
-- Depends on journeys(id, host_id) carrying a matching composite unique/PK
-- (already true live -- this FK is already enforced in production).
create table if not exists guide_journey_access (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null,
  host_id uuid not null,
  guide_id uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (journey_id, host_id) references journeys(id, host_id) on delete cascade
);
alter table guide_journey_access enable row level security;
do $$ begin
  create policy "guide journey access host select" on guide_journey_access for select using (auth.uid() = host_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "guide journey access guide select" on guide_journey_access for select using (auth.uid() = guide_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "guide journey access host insert" on guide_journey_access for insert
    with check (
      auth.uid() = host_id
      and exists (select 1 from guide_certifications gc where gc.host_id = guide_journey_access.guide_id and gc.standing = 'active')
      and exists (select 1 from guide_platform_authorizations gpa where gpa.host_id = guide_journey_access.guide_id and gpa.capability = 'guided_journey_facilitation' and gpa.status = 'authorized')
    );
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "guide journey access host revoke" on guide_journey_access for update
    using (auth.uid() = host_id and revoked_at is null)
    with check (auth.uid() = host_id and revoked_at is not null);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "guide journey access admin all" on guide_journey_access for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;
