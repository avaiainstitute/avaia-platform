-- The Pink Shoelace Foundation's own database: initial schema.
--
-- Loaded into the Foundation's own Supabase project (not AVAIA's), 2026-10-05. It is the
-- Foundation's records only: the existing pink_* tables exactly as they run today (migrations
-- 0063, 0071, 0072, 0106 and 0119 of the AVAIA repository), plus the small supporting tables the
-- Foundation's admin and daily summary need (notes, content plans, job runs, health results,
-- email failures). Nothing here refers to any AVAIA table, person, Journey, Workbook, Guide or member.
--
-- Differences from the AVAIA-hosted copies, all deliberate:
--   * `relevance` can only be 'pink'. The 'avaia' / 'both' values existed because one search covered
--     both organizations; that research is stopped and AVAIA business development does not belong here.
--   * founder_notes loses its links into AVAIA's tables; content_items replaces the AVAIA-named
--     `avaia_content_items` and allows only Foundation topics.
--   * cron_runs accepts only the Foundation's own jobs.
--   * Every table has row-level security ON and NO policies: only the service-role key (held only
--     by the Foundation's own server) can read or write. Nothing is reachable from a browser.
--
-- Safe to run more than once.

-- Legacy Global Programs review tracking (built 2026-10-02; provenance: a build instruction, not a
-- Founder specification. Kept as-is, empty, and not designed further here.)
create table if not exists public.pink_legacy_review_items (
  id                          uuid primary key default gen_random_uuid(),
  item_type                   text not null check (item_type in (
                                 'sponsored_access', 'avaia_institute_payment', 'partnership_agreement',
                                 'campaign', 'commercial_co_venture', 'other')),
  description                 text not null,
  foundation_owner            text,
  legacy_review_required      boolean not null default true,
  state                       text not null default 'draft' check (state in (
                                 'draft', 'ready_for_legacy', 'submitted_to_legacy', 'waiting_on_legacy',
                                 'changes_required', 'approved', 'closed')),
  submitted_at                timestamptz,
  requested_response_date     timestamptz,
  legacy_response             text,
  changes_required_notes      text,
  final_approval_recorded_by  text,
  final_approval_recorded_at  timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists pink_legacy_review_items_state_idx on public.pink_legacy_review_items (state);

create table if not exists public.pink_contact_submissions (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  email             text not null,
  message           text not null,
  category          text not null default 'general' check (category in (
                      'general', 'partnership', 'media_press', 'volunteer_or_donate', 'other')),
  status            text not null default 'new' check (status in ('new', 'acknowledged', 'in_progress', 'resolved')),
  needs_dorian      boolean not null default false,
  follow_up_needed  boolean not null default false,
  source            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  acknowledged_at   timestamptz
);
create index if not exists pink_contact_submissions_status_idx on public.pink_contact_submissions (status, created_at);
create index if not exists pink_contact_submissions_email_idx on public.pink_contact_submissions (email, created_at);

create table if not exists public.pink_participation_interest (
  id                uuid primary key default gen_random_uuid(),
  interest_type     text not null check (interest_type in (
                      'wear_shoelace', 'walk_alongside', 'honor_someone', 'foundation_participation', 'other')),
  name              text not null,
  email             text not null,
  note              text,
  honoree_name      text,
  status            text not null default 'new' check (status in ('new', 'acknowledged', 'in_progress', 'resolved')),
  needs_dorian      boolean not null default false,
  follow_up_needed  boolean not null default false,
  source            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  acknowledged_at   timestamptz
);
create index if not exists pink_participation_interest_status_idx on public.pink_participation_interest (status, created_at);
create index if not exists pink_participation_interest_email_idx on public.pink_participation_interest (email, created_at);

create table if not exists public.pink_partnerships (
  id                    uuid primary key default gen_random_uuid(),
  organization_name     text not null,
  organization_type     text check (organization_type in (
                          'school', 'business', 'hospital', 'grief_organization',
                          'community_organization', 'sports_organization', 'event', 'other')),
  contact_name          text,
  contact_email         text,
  contact_phone         text,
  relevance             text not null default 'pink' check (relevance in ('pink')),
  how_found             text,
  stage                 text not null default 'inquiry' check (stage in (
                          'inquiry', 'in_conversation', 'active', 'paused', 'closed')),
  last_contact_at       timestamptz,
  next_follow_up_at     timestamptz,
  notes                 text,
  dorian_action_needed  boolean not null default false,
  source_contact_id     uuid references public.pink_contact_submissions (id) on delete set null,
  legacy_review_item_id uuid references public.pink_legacy_review_items (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists pink_partnerships_follow_up_idx on public.pink_partnerships (next_follow_up_at);
create unique index if not exists pink_partnerships_source_contact_unique
  on public.pink_partnerships (source_contact_id) where source_contact_id is not null;

create table if not exists public.pink_donor_sponsor_records (
  id                    uuid primary key default gen_random_uuid(),
  donor_name            text not null,
  donor_type            text check (donor_type in ('individual', 'business_sponsor', 'organization', 'other')),
  contact_email         text,
  status                text not null default 'interest_only' check (status in (
                          'interest_only', 'pledged', 'active', 'lapsed')),
  notes                 text,
  source_contact_id     uuid references public.pink_contact_submissions (id) on delete set null,
  dorian_action_needed  boolean not null default false,
  next_follow_up_at     timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists pink_donor_sponsor_records_follow_up_idx on public.pink_donor_sponsor_records (next_follow_up_at);
create unique index if not exists pink_donor_sponsor_records_source_contact_unique
  on public.pink_donor_sponsor_records (source_contact_id) where source_contact_id is not null;

-- AI-found research output. The earlier output stays in the old project and in the archive; this
-- new project starts empty on purpose (nothing here was verified by a person).
create table if not exists public.pink_partnership_prospects (
  id                  uuid primary key default gen_random_uuid(),
  organization_name   text not null,
  organization_type   text check (organization_type in (
                        'school', 'business', 'hospice', 'funeral_home', 'community_organization',
                        'youth_organization', 'conference', 'employer', 'other')),
  location            text,
  website             text,
  contact_name        text,
  contact_email       text,
  contact_phone       text,
  relevance           text not null default 'pink' check (relevance in ('pink')),
  why_relevant        text,
  status              text not null default 'new' check (status in (
                        'new', 'reviewing', 'contacted', 'in_conversation', 'active', 'not_a_fit', 'declined')),
  dorian_contacted    boolean not null default false,
  next_follow_up_at   timestamptz,
  follow_up_notes     text,
  research_notes      text,
  discovered_via      text not null default 'outbound_research',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists pink_partnership_prospects_website_unique
  on public.pink_partnership_prospects (lower(website)) where website is not null and website <> '';
create unique index if not exists pink_partnership_prospects_name_unique
  on public.pink_partnership_prospects (lower(organization_name)) where website is null or website = '';
create index if not exists pink_partnership_prospects_follow_up_idx on public.pink_partnership_prospects (next_follow_up_at);
create index if not exists pink_partnership_prospects_status_idx on public.pink_partnership_prospects (status);

create table if not exists public.pink_donor_prospects (
  id                  uuid primary key default gen_random_uuid(),
  organization_name   text not null,
  organization_type   text check (organization_type in (
                        'individual', 'business', 'foundation', 'community_organization', 'employer', 'other')),
  location            text,
  website             text,
  contact_name        text,
  contact_email       text,
  contact_phone       text,
  why_relevant        text,
  status              text not null default 'new' check (status in (
                        'new', 'reviewing', 'contacted', 'in_conversation', 'active', 'not_a_fit', 'declined')),
  dorian_contacted    boolean not null default false,
  next_follow_up_at   timestamptz,
  follow_up_notes     text,
  research_notes      text,
  discovered_via      text not null default 'outbound_research',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists pink_donor_prospects_website_unique
  on public.pink_donor_prospects (lower(website)) where website is not null and website <> '';
create unique index if not exists pink_donor_prospects_name_unique
  on public.pink_donor_prospects (lower(organization_name)) where website is null or website = '';
create index if not exists pink_donor_prospects_follow_up_idx on public.pink_donor_prospects (next_follow_up_at);
create index if not exists pink_donor_prospects_status_idx on public.pink_donor_prospects (status);

create table if not exists public.pink_sponsored_access_requests (
  id                              uuid primary key default gen_random_uuid(),
  charitable_purpose              text not null,
  provider_organization           text not null,
  invoice_reference               text,
  w9_on_file                      boolean not null default false,
  payment_instructions_reference  text,
  legacy_review_item_id           uuid references public.pink_legacy_review_items (id) on delete set null,
  payment_status                  text not null default 'not_submitted' check (payment_status in (
                                    'not_submitted', 'submitted_to_legacy', 'approved_by_legacy',
                                    'paid_by_legacy', 'declined_by_legacy')),
  source_contact_id               uuid references public.pink_contact_submissions (id) on delete set null,
  notes                           text,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create table if not exists public.pink_campaign_items (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null,
  content                text not null,
  state                  text not null default 'draft' check (state in ('draft', 'approved_for_publication')),
  legacy_review_item_id  uuid references public.pink_legacy_review_items (id) on delete set null,
  approved_by            text,
  approved_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.pink_commercial_co_ventures (
  id                     uuid primary key default gen_random_uuid(),
  proposed_partner       text not null,
  calculation_method     text,
  proposed_terms         text,
  advertising_language   text,
  agreement_reference    text,
  legacy_review_item_id  uuid references public.pink_legacy_review_items (id) on delete set null,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.pink_volunteers (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  email                  text,
  assignment             text,
  onboarding_status      text not null default 'inquiry' check (onboarding_status in (
                           'inquiry', 'onboarding', 'active', 'inactive')),
  activity_notes         text,
  safety_review_state    text not null default 'not_flagged' check (safety_review_state in (
                           'not_flagged', 'human_review_recommended', 'legacy_review_recommended')),
  legacy_review_item_id  uuid references public.pink_legacy_review_items (id) on delete set null,
  source_contact_id      uuid references public.pink_contact_submissions (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.pink_foundation_reminders (
  id             uuid primary key default gen_random_uuid(),
  entity_type    text not null check (entity_type in (
                   'legacy_review_item', 'sponsored_access_request', 'partnership', 'campaign_item')),
  entity_id      uuid not null,
  reminder_type  text not null check (reminder_type in (
                   'legacy_review_reminder', 'incomplete_document_reminder',
                   'partnership_follow_up_reminder', 'overdue_legacy_response_flag')),
  sent_at        timestamptz not null default now()
);
create index if not exists pink_foundation_reminders_entity_idx
  on public.pink_foundation_reminders (entity_type, entity_id, reminder_type, sent_at desc);

-- Supporting tables for the Foundation's admin (the Foundation's own copies; AVAIA's are not touched).
create table if not exists public.founder_notes (
  id                              uuid primary key default gen_random_uuid(),
  kind                            text not null check (kind in ('idea', 'decision', 'follow_up', 'meeting_note')),
  title                           text not null,
  body                            text not null,
  category                        text check (category in ('pink_shoelace', 'follow_up', 'future', 'other')),
  status                          text not null default 'open' check (status in ('open', 'in_progress', 'done', 'archived')),
  person_name                     text,
  organization_name               text,
  follow_up_date                  date,
  next_action                     text,
  related_experience              text,
  decision_affected_area          text,
  decision_implementation_status  text check (decision_implementation_status in ('not_started', 'in_progress', 'done')),
  linked_partnership_prospect_id  uuid references public.pink_partnership_prospects (id) on delete set null,
  linked_donor_prospect_id        uuid references public.pink_donor_prospects (id) on delete set null,
  linked_content_item_id          uuid,
  source                          text not null default 'typed' check (source in ('typed', 'ai_assisted')),
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);
create index if not exists founder_notes_kind_idx on public.founder_notes (kind, created_at desc);
create index if not exists founder_notes_follow_up_idx on public.founder_notes (follow_up_date) where follow_up_date is not null;
create index if not exists founder_notes_status_idx on public.founder_notes (status);

create table if not exists public.content_items (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  content_type      text not null default 'social_post' check (content_type in (
                      'social_post', 'announcement', 'pr_media', 'other')),
  platform          text check (platform in (
                      'instagram', 'facebook', 'linkedin', 'tiktok', 'website', 'email', 'press', 'other')),
  related_to        text check (related_to in ('pink_shoelace_general', 'pink_participation', 'other')),
  summary           text not null,
  source_reference  text,
  status            text not null default 'idea' check (status in (
                      'idea', 'draft', 'approved', 'scheduled', 'published', 'archived')),
  scheduled_for     timestamptz,
  published_at      timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists content_items_status_idx on public.content_items (status);
create index if not exists content_items_scheduled_idx on public.content_items (scheduled_for);

create table if not exists public.cron_runs (
  id           uuid primary key default gen_random_uuid(),
  cron_name    text not null check (cron_name in ('pink-daily-summary', 'system-checks')),
  started_at   timestamptz not null,
  finished_at  timestamptz not null default now(),
  status       text not null check (status in ('success', 'partial', 'error')),
  detail       jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists cron_runs_name_started_idx on public.cron_runs (cron_name, started_at desc);

create table if not exists public.system_check_results (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null,
  category    text not null check (category in ('website', 'quality')),
  check_key   text not null,
  label       text not null,
  status      text not null check (status in ('pass', 'problem', 'needs_dorian')),
  detail      text,
  checked_at  timestamptz not null default now()
);
create index if not exists system_check_results_run_idx on public.system_check_results (run_id);
create index if not exists system_check_results_key_idx on public.system_check_results (check_key, checked_at desc);

create table if not exists public.email_send_failures (
  id          uuid primary key default gen_random_uuid(),
  context     text,
  error       text not null,
  created_at  timestamptz not null default now()
);
create index if not exists email_send_failures_created_idx on public.email_send_failures (created_at desc);

-- Who may use the Foundation's admin. Separate from, and unrelated to, any AVAIA account.
create table if not exists public.pink_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Lock every table: row-level security on, no policies (server-side service key only).
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
      and tablename in (
        'pink_legacy_review_items', 'pink_contact_submissions', 'pink_participation_interest', 'pink_partnerships',
        'pink_donor_sponsor_records', 'pink_partnership_prospects', 'pink_donor_prospects',
        'pink_sponsored_access_requests', 'pink_campaign_items', 'pink_commercial_co_ventures', 'pink_volunteers',
        'pink_foundation_reminders', 'founder_notes', 'content_items', 'cron_runs', 'system_check_results',
        'email_send_failures', 'pink_admins')
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Verification (read-only).
select
  (select count(*) from pg_tables where schemaname = 'public') as tables,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity) as tables_with_rls,
  (select count(*) from pg_policies where schemaname = 'public') as policies_must_be_zero;
