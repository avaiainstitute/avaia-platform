-- Round 4 (Automation Blueprint): Dorian's Command Center, AVAIA Watchers
-- + Testing/QC, Guide Certification Operations extension, and the
-- Opportunity Finder's one genuine gap (speaking/conference opportunities).
--
-- Same posture as migration 0072: every new table is RLS-enabled with ZERO
-- policies for any signed-in role (service-role/admin-route-only, matching
-- every pink_/avaia_ table since 0063), because none of this is ever meant
-- to be read directly by a Host, Guide, or participant -- only by an
-- admin-role-gated route using createAdminClient(), exactly like
-- app/admin/opportunities, app/admin/programs, and app/admin/content
-- already do. guide_candidates is the one exception below: it already has
-- its own "admin all" RLS policy from 0022, so the new columns there are
-- read/written through the signed-in admin's own RLS-bound client, not a
-- service-role client, matching every other column on that table.
--
-- Nothing here invents a certification rubric, a launch requirement, or an
-- AVAIA/Pink program that doesn't already exist. See each table's own
-- comment for what it deliberately does NOT do.

-- ---------------------------------------------------------------------------
-- founder_notes -- Dorian's own words, always preserved verbatim in `body`.
-- One shared table for four clearly-distinguished kinds of capture (the
-- Founder Idea Catcher, the Decision Keeper, Follow-up Memory, and
-- After-Meeting Capture), rather than four fragmented tables, because all
-- four are the same underlying act -- Dorian typing or dictating something
-- so it isn't lost -- and a shared table is what lets one admin page (not
-- four) and one Founder Digest section (not four) surface all of them.
-- `kind` is what keeps the four conceptually separate: an idea is never
-- treated as a decision, and neither is ever treated as an approved,
-- implemented change -- nothing reads this table to drive any automatic
-- build/publish/certification action anywhere in the app.
create table if not exists public.founder_notes (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('idea', 'decision', 'follow_up', 'meeting_note')),
  title        text not null,
  -- Dorian's own words. Always saved exactly as entered/dictated, even when
  -- the fields below were AI-assisted -- the raw statement is the record of
  -- truth, the structured fields are only a convenience on top of it.
  body         text not null,
  category     text check (category in (
                 'avaia', 'pink_shoelace', 'program', 'experience',
                 'website', 'future', 'follow_up', 'other'
               )),
  status       text not null default 'open' check (status in ('open', 'in_progress', 'done', 'archived')),
  person_name        text,
  organization_name  text,
  follow_up_date     date,
  -- What Dorian said he would do / promised, in his own words -- never a
  -- commitment inferred beyond what he actually entered.
  next_action        text,
  -- Only meaningful when kind = 'meeting_note' or 'follow_up', validated at
  -- the app layer against the same established Experience list Agent 8
  -- uses (lib/experiences-agent.ts) so this can never drift from or invent
  -- one; left as free text here rather than a second copy of that check
  -- constraint, exactly like avaia_experience_prospects.relevant_experience
  -- already does in 0072.
  related_experience text,
  -- Only meaningful when kind = 'decision'.
  decision_affected_area           text,
  decision_implementation_status   text check (decision_implementation_status in ('not_started', 'in_progress', 'done')),
  -- Reuse existing people/organizations instead of creating duplicates --
  -- optional links into the four Round 3 outbound-research/inbound tables.
  -- All nullable: most notes won't reference any of them.
  linked_partnership_prospect_id   uuid references public.pink_partnership_prospects (id) on delete set null,
  linked_donor_prospect_id         uuid references public.pink_donor_prospects (id) on delete set null,
  linked_program_prospect_id       uuid references public.avaia_experience_prospects (id) on delete set null,
  linked_experience_inquiry_id     uuid references public.avaia_experience_inquiries (id) on delete set null,
  -- 'typed' = Dorian entered structured fields himself. 'ai_assisted' = an
  -- AI extraction proposed the structured fields from raw text and Dorian
  -- reviewed/edited before saving -- never saved without that review step.
  source       text not null default 'typed' check (source in ('typed', 'ai_assisted')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists founder_notes_kind_idx on public.founder_notes (kind, created_at desc);
create index if not exists founder_notes_follow_up_idx on public.founder_notes (follow_up_date) where follow_up_date is not null;
create index if not exists founder_notes_status_idx on public.founder_notes (status);

alter table public.founder_notes enable row level security;
-- No policies -- service-role only, read/written exclusively through
-- app/admin/notes (admin-role checked before the admin client is ever
-- touched, same posture as app/admin/opportunities).

-- ---------------------------------------------------------------------------
-- avaia_speaking_opportunities -- Opportunity Finder's one genuine gap
-- versus the three Round 3 outbound-research verticals: those find
-- ORGANIZATIONS to potentially partner with; this finds actual events
-- (conferences, speaking slots, calls for proposals) where Dorian could
-- speak or present, for AVAIA and/or Pink Shoelace. Same shape and same
-- research engine (lib/research/prospect-research.ts, extended with a
-- fourth vertical) as pink_partnership_prospects/pink_donor_prospects/
-- avaia_experience_prospects, deliberately -- one engine, one dedup
-- strategy, one admin surface, not a fourth bespoke implementation.
create table if not exists public.avaia_speaking_opportunities (
  id                  uuid primary key default gen_random_uuid(),
  organization_name   text not null, -- the event/conference/publication name
  organization_type   text check (organization_type in (
                        'conference', 'workshop_series', 'podcast_media', 'community_event', 'other'
                       )),
  location             text,
  website               text,
  contact_name          text,
  contact_email         text,
  contact_phone         text,
  why_relevant          text not null,
  relevance             text not null default 'both' check (relevance in ('pink', 'avaia', 'both')),
  application_deadline  date,
  research_notes        text,
  status                text not null default 'new' check (status in (
                          'new', 'reviewing', 'contacted', 'in_conversation', 'active', 'not_a_fit', 'declined'
                         )),
  dorian_contacted      boolean not null default false,
  follow_up_notes       text,
  next_follow_up_at     timestamptz,
  discovered_via         text not null default 'outbound_research' check (discovered_via in ('outbound_research', 'manual')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index if not exists avaia_speaking_opportunities_website_uidx
  on public.avaia_speaking_opportunities (lower(website)) where website is not null and website <> '';
create unique index if not exists avaia_speaking_opportunities_org_uidx
  on public.avaia_speaking_opportunities (lower(organization_name)) where website is null or website = '';
create index if not exists avaia_speaking_opportunities_status_idx on public.avaia_speaking_opportunities (status);

alter table public.avaia_speaking_opportunities enable row level security;
-- No policies -- service-role only, same posture as the three sibling
-- prospect tables from 0072.

-- ---------------------------------------------------------------------------
-- system_check_results -- the shared record for the Website Watcher, Journey
-- Watcher, Shared Room Operations Watcher, Launch Readiness Watcher, and
-- Testing/QC, per Dorian's own instruction that these "connect... rather
-- than duplicating" each other. One engine (lib/ops/system-checks.ts) runs
-- a fixed list of named, read-only checks and writes one row per check per
-- run here; `category` is what tells the checks apart for reporting. This
-- table never stores private content -- every check reads only operational
-- metadata (HTTP status codes, row counts, timestamps, status columns) and
-- the Journey/Shared Room checks in particular never select conversation,
-- message, room_messages, room_workbook_items, or room_private_sessions
-- content, by construction in the application code, not just by convention.
create table if not exists public.system_check_results (
  id          uuid primary key default gen_random_uuid(),
  -- Groups every check from one run together so a run's overall status can
  -- be computed and compared to the previous run (Launch Readiness's own
  -- change-detection: STILL GOOD / SOMETHING BROKE / NEEDS ATTENTION).
  run_id      uuid not null,
  category    text not null check (category in ('website', 'quality', 'journey', 'shared_room', 'launch_readiness')),
  check_key   text not null,
  label       text not null,
  status      text not null check (status in ('pass', 'problem', 'needs_dorian')),
  detail      text,
  checked_at  timestamptz not null default now()
);

create index if not exists system_check_results_run_idx on public.system_check_results (run_id);
create index if not exists system_check_results_category_idx on public.system_check_results (category, checked_at desc);
create index if not exists system_check_results_key_idx on public.system_check_results (check_key, checked_at desc);

alter table public.system_check_results enable row level security;
-- No policies -- service-role only, read via app/admin/system-checks and
-- the Founder Digest, written only by lib/ops/system-checks.ts.

-- ---------------------------------------------------------------------------
-- Guide Certification Operations extension (Agent 7). PAYMENT = ENROLLMENT,
-- NOT CERTIFICATION remains exactly as enforced as it already was --
-- nothing here changes how a Guide gets certified (still only ever a
-- manual insert into guide_certifications by an admin, per 0022's own
-- comment). This adds one purely administrative fact: whether DORIAN
-- HIMSELF has marked a candidate ready for his own certification review.
-- The system never sets this -- there is no established competency rubric
-- in this schema for automation to evaluate against, and none is invented
-- here. This only lets Dorian's own "yes, I should look at this one" stop
-- living in his head and start living in the record, so
-- getGuideOperationsSnapshot() can surface it without repeatedly asking
-- him to re-inspect every open candidacy himself.
alter table public.guide_candidates
  add column if not exists ready_for_review boolean not null default false,
  add column if not exists ready_for_review_notes text,
  add column if not exists ready_for_review_marked_at timestamptz,
  add column if not exists ready_for_review_marked_by uuid references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Widen the AI-usage feature check constraint (same drop-and-re-add
-- pattern as 0045 and 0072) to add the one new AI feature this round
-- introduces: structured-field extraction from Dorian's own free-text
-- meeting/follow-up notes (lib/ops/founder-notes.ts). Never used for
-- outbound research (that stays "prospect_research", already added in
-- 0072) and never used to draft, decide, or publish anything on its own.
-- ---------------------------------------------------------------------------
alter table public.ai_usage_events drop constraint if exists ai_usage_events_feature_check;
alter table public.ai_usage_events add constraint ai_usage_events_feature_check check (feature in (
  'iap_conversation', 'cat_conversation', 'innercompass_conversation',
  'iap_referral', 'cat_referral', 'innercompass_referral',
  'cat_opening', 'innercompass_opening', 'iap_origin_opening',
  'unsung_heroes_recognition', 'unsung_heroes_conversation',
  'chemistry_virtue_formula', 'transcript_cleanup',
  'preparation_snapshot', 'preparation_chat',
  'room_conversation', 'room_referral', 'room_bring_forward_suggestion',
  'unsaid_conversation', 'prospect_research', 'founder_note_extraction'
));
