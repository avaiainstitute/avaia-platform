-- 0101_certification_companion.sql
--
-- AVAIA Certification Companion -- smallest working implementation.
-- Extends the existing Guide Certification schema (0100 baseline); creates
-- no parallel system. Every new table below keys into guide_candidates
-- (candidate_id) or auth.users (host_id), the same two anchors every
-- existing certification table already uses. RLS follows the exact
-- two-policy shape already established across guide_candidate_*/
-- guide_certification_* tables: "self read/write own rows" (auth.uid())
-- plus "admin all" (profiles.role = 'admin').
--
-- Candidate/evaluator isolation is NOT a policy decision on these tables --
-- it is enforced by what the Companion's application code imports (see
-- lib/certification-content.ts), since the content these tables ever
-- reference (certification_curriculum_items) carries no evaluator-only
-- fields at all. These tables hold conversation/progress/check-in state,
-- never assessment content.

-- ======================================================== certification_content_version
-- One row per published content version. Lets every decision, progress
-- row, and Companion conversation be traced back to the exact content
-- version a candidate was shown -- mirrors
-- guide_certification_decisions.curriculum_version/guide_manual_version/
-- assessment_packet_version, which already exist as free-text columns on
-- that table with nothing populating them yet.
create table if not exists certification_content_version (
  id uuid primary key default gen_random_uuid(),
  curriculum_version text not null,
  workbook_version text,
  assessment_packet_version text,
  lab_manual_version text,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null,
  notes text
);
alter table certification_content_version enable row level security;
do $$ begin
  create policy "certification content version candidate read" on certification_content_version for select
    using (exists (select 1 from guide_candidates c where c.host_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "certification content version admin all" on certification_content_version for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ======================================================= certification_curriculum_items
-- Canonical, machine-readable registry of every candidate-visible unit --
-- one row per lesson / Tier-1 self-check / Practice Lab. Generated
-- mechanically from this session's module1-7-data.js / lab-manual-data.js
-- (see lib/certification-content.ts) -- never hand-authored, never includes
-- answer keys, Witness/Facilitator Card content, or evaluator rubric text.
-- This is the item registry certification_candidate_progress below points
-- into; it is what makes "candidate progress per lesson/item" possible at
-- all, which the live schema has no mechanism for today.
create table if not exists certification_curriculum_items (
  id uuid primary key default gen_random_uuid(),
  content_version_id uuid not null references certification_content_version(id) on delete cascade,
  item_key text not null,           -- e.g. "lesson-3.9", "tier1-2.3", "lab-10"
  item_type text not null check (item_type = any (array['lesson','tier1_item','practice_lab','boundary_gate_item'])),
  module_num integer,
  title text not null,
  sort_order integer not null default 0,
  unique (content_version_id, item_key)
);
alter table certification_curriculum_items enable row level security;
do $$ begin
  create policy "certification curriculum items candidate read" on certification_curriculum_items for select
    using (exists (select 1 from guide_candidates c where c.host_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "certification curriculum items admin all" on certification_curriculum_items for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ====================================================== certification_candidate_progress
-- Candidate SELF-REPORT only -- "I studied this" / "I ran this Lab" -- and
-- is structurally separate from guide_candidate_evidence (admin/evaluator-
-- write-only, unchanged by this migration). This is the ONE new table a
-- candidate can write to directly. It has no bearing on certification
-- eligibility by itself; nothing reads it when evaluating a candidate. That
-- separation is what makes "the Companion cannot waive requirements or
-- decide certification" a schema fact instead of a prompt instruction.
create table if not exists certification_candidate_progress (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references guide_candidates(id) on delete cascade,
  item_key text not null,
  status text not null default 'not_started' check (status = any (array['not_started','in_progress','self_checked_complete'])),
  self_reported_at timestamptz,
  last_touched_at timestamptz not null default now(),
  unique (candidate_id, item_key)
);
alter table certification_candidate_progress enable row level security;
do $$ begin
  create policy "certification candidate progress self all" on certification_candidate_progress for all
    using (exists (select 1 from guide_candidates c where c.id = certification_candidate_progress.candidate_id and c.host_id = auth.uid()))
    with check (exists (select 1 from guide_candidates c where c.id = certification_candidate_progress.candidate_id and c.host_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "certification candidate progress admin all" on certification_candidate_progress for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ===================================================== certification_companion_conversations
create table if not exists certification_companion_conversations (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references guide_candidates(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status = any (array['active','closed'])),
  created_at timestamptz not null default now()
);
alter table certification_companion_conversations enable row level security;
do $$ begin
  create policy "certification companion conversations self all" on certification_companion_conversations for all
    using (auth.uid() = host_id) with check (auth.uid() = host_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "certification companion conversations admin read" on certification_companion_conversations for select
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ======================================================== certification_companion_messages
create table if not exists certification_companion_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references certification_companion_conversations(id) on delete cascade,
  role text not null check (role = any (array['candidate','companion'])),
  content text not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
alter table certification_companion_messages enable row level security;
do $$ begin
  create policy "certification companion messages self all" on certification_companion_messages for all
    using (exists (select 1 from certification_companion_conversations c where c.id = certification_companion_messages.conversation_id and c.host_id = auth.uid()))
    with check (exists (select 1 from certification_companion_conversations c where c.id = certification_companion_messages.conversation_id and c.host_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "certification companion messages admin read" on certification_companion_messages for select
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ========================================================= certification_companion_checkins
-- Deliberately a NEW table, not a new row type bolted onto
-- guide_candidate_reminders -- that table's own code comment
-- (lib/ops/guide-operations.ts) states it "never contacts a Guide candidate
-- directly." Reusing it for candidate-facing check-ins would quietly
-- change an existing, already-relied-on guarantee. Same
-- cooldown-via-last-row idempotency shape as guide_candidate_reminders.
create table if not exists certification_companion_checkins (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references guide_candidates(id) on delete cascade,
  checkin_type text not null default 'progress_waiting' check (checkin_type = any (array['progress_waiting'])),
  sent_at timestamptz not null default now(),
  channel text not null default 'email' check (channel = any (array['email'])),
  acknowledged_at timestamptz
);
alter table certification_companion_checkins enable row level security;
do $$ begin
  create policy "certification companion checkins self read" on certification_companion_checkins for select
    using (exists (select 1 from guide_candidates c where c.id = certification_companion_checkins.candidate_id and c.host_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "certification companion checkins admin all" on certification_companion_checkins for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ====================================================== certification_companion_escalations
-- Mirrors crisis_events' shape and intent for a second, certification-
-- specific category of "this needs a person" -- a request to waive a
-- requirement, a dispute about a recorded evaluation, or any question that
-- reaches into Boundary Gate / Observed Practicum judgment territory, or
-- that lib/certification-content.ts returns no confident match for.
create table if not exists certification_companion_escalations (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references guide_candidates(id) on delete cascade,
  conversation_id uuid references certification_companion_conversations(id) on delete set null,
  category text not null check (category = any (array['crisis','waiver_request','evaluation_dispute','judgment_territory','no_confident_match'])),
  note text,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  resolved_at timestamptz
);
alter table certification_companion_escalations enable row level security;
do $$ begin
  create policy "certification companion escalations self read" on certification_companion_escalations for select
    using (exists (select 1 from guide_candidates c where c.id = certification_companion_escalations.candidate_id and c.host_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "certification companion escalations admin all" on certification_companion_escalations for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

create index if not exists idx_certification_curriculum_items_content_version on certification_curriculum_items(content_version_id);
create index if not exists idx_certification_candidate_progress_candidate on certification_candidate_progress(candidate_id);
create index if not exists idx_certification_companion_conversations_candidate on certification_companion_conversations(candidate_id);
create index if not exists idx_certification_companion_messages_conversation on certification_companion_messages(conversation_id, created_at);
create index if not exists idx_certification_companion_checkins_candidate on certification_companion_checkins(candidate_id, sent_at desc);
create index if not exists idx_certification_companion_escalations_candidate on certification_companion_escalations(candidate_id);
