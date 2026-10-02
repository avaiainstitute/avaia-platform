-- The AVAIA Conversation Integrity & Boundary Oversight Agent's data
-- layer. Purely additive: three new tables. Audited first (see the final
-- report for the full audit):
--
--  - A real crisis detection/prefilter already exists and is NOT
--    duplicated here: lib/engine/anthropic.ts's detectCrisis() (a
--    conservative, recall-favoring keyword pre-check) already runs on
--    every Host turn in app/api/conversation/route.ts, logging to the
--    existing crisis_events table (host_id, conversation_id, created_at
--    only -- no content, by design, per that table's own comment). This
--    migration does not touch crisis_events and does not re-implement
--    crisis detection; it adds a SAFETY_PROTOCOL check (see
--    lib/conversation-integrity.ts) that correlates an existing
--    crisis_events row with whether the very next AI/Guide-role reply
--    actually contained crisis-protocol language -- verifying the
--    established pathway was followed, never re-deciding whether a
--    crisis existed.
--  - No prompt-version or model-version table exists anywhere (only a
--    single AVAIA_MODEL string constant in lib/engine/prompts.ts, never
--    persisted per-message). conversation_integrity_flags.model_snapshot
--    below is a plain text snapshot of that constant's value at
--    detection time -- the most truthful thing available -- not a
--    foreign key into an invented prompt_versions table.
--  - No admin surface has ever read public.conversations or
--    public.messages before this build.
--
-- GOVERNING ROLE enforced structurally: this agent flags possible
-- boundary issues in AVAIA's own system/Guide behavior for human
-- disposition -- it never stores a diagnostic conclusion about the Host.
-- flag_category and avaia_rule_implicated describe the AVAIA rule a
-- turn may be inconsistent with; nothing on this table lets automation
-- write "Host is unstable" or any other character/psychological
-- judgment, about the Host or the Guide. human_disposition is only ever
-- populated by a human reviewer -- a flag by itself is never a finding.
--
-- PRIVACY / MINIMUM DATA: no column here duplicates conversation content.
-- detection_basis is a short description of what triggered the flag (e.g.
-- "keyword pattern: diagnostic-language prefilter"), never the message
-- text itself; message_id is a pointer back into the existing, already
-- access-controlled messages table for an authorized reviewer to open
-- directly, not a copy.

create table if not exists public.conversation_integrity_flags (
  id                     uuid primary key default gen_random_uuid(),
  conversation_id        uuid references public.conversations (id) on delete cascade,
  -- The Host who owns the conversation (conversations.host_id) -- kept
  -- here, not just joinable, so a flag's RLS insert-check and later
  -- admin queries don't require trusting a join at insert time. Mirrors
  -- crisis_events' own host_id column exactly.
  host_id                uuid references auth.users (id) on delete set null,
  message_id             uuid references public.messages (id) on delete set null,
  stage                  text check (stage in ('iap', 'cat', 'innercompass')),
  -- Free text, deliberately NOT re-declaring conversations.program's own
  -- check constraint here -- this table reads that value, it doesn't own
  -- it, and duplicating the check risks silently drifting out of sync if
  -- that table's own program list changes.
  program                text,
  involved_role          text check (involved_role in ('host', 'guide')),
  flag_category          text not null check (flag_category in (
                            'DIAGNOSTIC_OVERREACH', 'PRESCRIPTION', 'SCOPE_OVERREACH',
                            'CAPACITY_OR_CONSENT', 'FORCED_DISCLOSURE', 'HOST_OWNERSHIP',
                            'RECOGNITION_OVERREACH', 'EMOTIONAL_INTENSITY_MISUSE', 'PRIVACY_SCOPE',
                            'YOUTH_SAFEGUARD', 'SAFETY_PROTOCOL', 'IMPROPER_CARRY_FORWARD',
                            'SYSTEM_PROMPT_BEHAVIOR', 'POLICY_REQUIRED', 'LEGAL_REVIEW_REQUIRED'
                          )),
  severity               text not null check (severity in (
                            'INFORMATIONAL', 'REVIEW', 'HIGH_PRIORITY', 'POLICY_REQUIRED',
                            'LEGAL_REVIEW_REQUIRED'
                          )),
  avaia_rule_implicated  text not null,
  detection_basis        text not null,
  model_snapshot         text,
  review_required        boolean not null default true,
  review_status          text not null default 'open' check (review_status in ('open', 'in_review', 'resolved')),
  human_disposition      text check (human_disposition in (
                            'NO_VIOLATION', 'COACHING_OR_CORRECTION', 'SYSTEM_PROMPT_FIX',
                            'GUIDE_REVIEW_REQUIRED', 'ACCESS_OR_PRIVACY_ACTION', 'SAFETY_ESCALATION',
                            'POLICY_REQUIRED', 'LEGAL_REVIEW_REQUIRED'
                         )),
  corrective_action      text,
  reviewed_by            uuid references auth.users (id) on delete set null,
  reviewed_at            timestamptz,
  created_at             timestamptz not null default now()
);

create index if not exists conversation_integrity_flags_conversation_idx
  on public.conversation_integrity_flags (conversation_id, created_at desc);
create index if not exists conversation_integrity_flags_review_idx
  on public.conversation_integrity_flags (review_status, severity, created_at desc);

alter table public.conversation_integrity_flags enable row level security;
-- Insert-only self policy, identical in shape to crisis_events' own
-- "crisis insert self" policy -- lets the live conversation route record
-- a flag using the Host's own session client (the same client that
-- already inserts into crisis_events today) without an admin client in
-- the hot streaming path. Deliberately NO self-select policy: this is
-- oversight data about the conversation's behavior, not the Host's own
-- record, and exposing raw flags to the person the conversation is about
-- is not what this agent is for (see item 24 -- a Guide-facing surface
-- is built separately, server-side, never by granting table-level read).
do $$ begin
  create policy "conversation integrity insert self" on public.conversation_integrity_flags
    for insert with check (auth.uid() = host_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "conversation integrity admin all" on public.conversation_integrity_flags
    for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- conversation_integrity_scans -- one row per conversation, the scan
-- cursor the post-conversation integrity scan uses so it never re-scans
-- the same messages twice. Purely operational bookkeeping -- admin/
-- service-role only, same zero-self-policy posture as
-- guide_candidate_history and program_authorization_history.
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_integrity_scans (
  conversation_id          uuid primary key references public.conversations (id) on delete cascade,
  last_scanned_message_id  uuid references public.messages (id) on delete set null,
  last_scanned_at          timestamptz not null default now()
);

alter table public.conversation_integrity_scans enable row level security;

-- ---------------------------------------------------------------------------
-- conversation_integrity_reminders -- idempotency/cooldown tracking, same
-- shape and purpose as every other *_reminders table in this codebase.
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_integrity_reminders (
  id              uuid primary key default gen_random_uuid(),
  flag_id         uuid not null references public.conversation_integrity_flags (id) on delete cascade,
  reminder_type   text not null check (reminder_type in (
                    'reviewer_reminder', 'unresolved_review_notification', 'pattern_detected_notification'
                  )),
  sent_at         timestamptz not null default now()
);

create index if not exists conversation_integrity_reminders_flag_idx
  on public.conversation_integrity_reminders (flag_id, reminder_type, sent_at desc);

alter table public.conversation_integrity_reminders enable row level security;
do $$ begin
  create policy "conversation integrity reminders admin all" on public.conversation_integrity_reminders
    for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;
