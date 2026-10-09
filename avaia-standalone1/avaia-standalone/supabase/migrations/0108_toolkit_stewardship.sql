-- The AVAIA Toolkit Stewardship Agent's data layer. Purely additive: two
-- new tables. Audited first (see the final report for the full audit):
-- no feedback/support/ticket infrastructure of any kind existed anywhere
-- in this schema before this migration. contact_submissions (0010) is the
-- public marketing-site contact form -- a different purpose, not reused
-- or extended here, since a Guide's Toolkit question is not a public
-- inquiry.
--
-- GOVERNING ROLE enforced structurally: this agent supports, monitors,
-- organizes, detects, and routes -- it never redefines AVAIA. There is no
-- column anywhere on toolkit_support_items that lets automation record an
-- approval of a new use, adaptation, Experience, or policy; "resolution"
-- and "state" transitions into anything beyond open/in_review/
-- awaiting_human are only ever written by a human reviewer through the
-- admin surface, never inferred by the resolver.
--
-- tool_key's check list mirrors guide_sessions.tool's own existing check
-- list (0011_guide_toolkit.sql) exactly, which itself mirrors
-- lib/toolkit.ts's ToolKey union -- one already-established canonical
-- list, not a new one invented for this table.

create table if not exists public.toolkit_support_items (
  id                        uuid primary key default gen_random_uuid(),
  host_id                   uuid not null references auth.users (id) on delete cascade,
  tool_key                  text not null check (tool_key in (
                              'preparation', 'iap', 'cat', 'innercompass',
                              'secondary-loss', 'chemistry', 'table-formation',
                              'council', 'give', 'defying-grief', 'unsung-heroes',
                              'library', 'youth-group'
                            )),
  category                  text not null check (category in (
                              'SUPPORT', 'BUG', 'MISSING_ASSET', 'VERSION', 'CLARIFICATION',
                              'ADAPTATION_REQUEST', 'ADDITION_REQUEST', 'AUTHORIZATION_QUESTION',
                              'POLICY_REQUIRED'
                            )),
  description               text not null,
  -- Route or resource this concerns (e.g. "/toolkit/defying-grief"), and
  -- any current version/status string the Guide is reporting against --
  -- both free text since neither Toolkit routes nor Toolkit content carry
  -- a formal version identifier anywhere in this codebase today (see the
  -- audit: TOOL_REGISTRY is static code, not a versioned DB record).
  affected_resource         text,
  current_version_or_status text,
  state                     text not null default 'open' check (state in (
                              'open', 'in_review', 'awaiting_human', 'resolved', 'closed'
                            )),
  requires_human_approval   boolean not null default false,
  assigned_to               uuid references auth.users (id) on delete set null,
  resolution                text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists toolkit_support_items_host_idx
  on public.toolkit_support_items (host_id, created_at desc);
create index if not exists toolkit_support_items_state_idx
  on public.toolkit_support_items (state, category, created_at desc);

alter table public.toolkit_support_items enable row level security;
-- A Guide may see and create their own support items (same self-row
-- shape as guide_candidates); only an admin may change state, resolution,
-- or assignment -- there is no self-update policy here at all, so a Guide
-- cannot resolve, close, or reassign their own item.
do $$ begin
  create policy "toolkit support self read" on public.toolkit_support_items
    for select using (auth.uid() = host_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "toolkit support self insert" on public.toolkit_support_items
    for insert with check (auth.uid() = host_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "toolkit support admin all" on public.toolkit_support_items
    for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- toolkit_support_reminders -- idempotency/cooldown tracking, same shape
-- and purpose as every other *_reminders table in this codebase (0064).
-- ---------------------------------------------------------------------------
create table if not exists public.toolkit_support_reminders (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.toolkit_support_items (id) on delete cascade,
  reminder_type   text not null check (reminder_type in (
                    'stale_item_reminder', 'pattern_detected_notification', 'policy_required_notification'
                  )),
  sent_at         timestamptz not null default now()
);

create index if not exists toolkit_support_reminders_item_idx
  on public.toolkit_support_reminders (item_id, reminder_type, sent_at desc);

alter table public.toolkit_support_reminders enable row level security;
do $$ begin
  create policy "toolkit support reminders admin all" on public.toolkit_support_reminders
    for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;
