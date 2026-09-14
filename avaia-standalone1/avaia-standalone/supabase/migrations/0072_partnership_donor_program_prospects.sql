-- Automation Blueprint, Round 3 (Dorian's four-area build: Pink
-- participation doorway, Agent 3/4 outbound research, Agents 8 & 9).
-- Purely additive: five new tables, one widened check constraint on the
-- already-live ai_usage_events table. No existing table is altered in a
-- way that changes its current behavior.
--
-- POSTURE: every new table below follows the exact precedent already set
-- by the pink_ tables in 0063/0071 -- RLS enabled, zero public or
-- authenticated policies. Nothing here is reachable from the browser or
-- from a signed-in Host/Guide session; only the service-role client
-- (server-side API routes, cron jobs, and admin pages that check
-- profiles.role = 'admin' in application code before ever touching the
-- service-role client -- see app/admin/opportunities, app/admin/programs,
-- app/admin/content) can read or write these tables. This is a narrow
-- addition to the existing posture, not a change to it.
--
-- WHAT THIS DOES NOT DO: no table here represents a payment, a donation,
-- a pricing tier, a package, or an offer. Outbound "prospect" tables are
-- research/tracking records only -- discovering that an organization may
-- be a good fit is not contacting them, and no automated outreach
-- mechanism exists anywhere in this migration or the code that uses it.
-- avaia_content_items has no foreign key into any private table (Host
-- conversations, Workbook, Unsung Heroes recognitions, Shared Room, youth
-- material) and cannot -- by construction, not just by policy -- become a
-- pipe for private participant content to leak into public communications
-- planning.

-- ---------------------------------------------------------------------
-- Agent 3 (Partnership) -- outbound research prospects
-- ---------------------------------------------------------------------
create table if not exists public.pink_partnership_prospects (
  id                  uuid primary key default gen_random_uuid(),
  organization_name   text not null,
  organization_type   text check (organization_type in (
                        'school', 'business', 'hospice', 'funeral_home',
                        'community_organization', 'youth_organization',
                        'conference', 'employer', 'other'
                      )),
  location            text,
  website             text,
  contact_name         text,
  contact_email        text,
  contact_phone        text,
  relevance            text not null default 'both' check (relevance in ('pink', 'avaia', 'both')),
  why_relevant         text,
  status               text not null default 'new' check (status in (
                         'new', 'reviewing', 'contacted', 'in_conversation',
                         'active', 'not_a_fit', 'declined'
                       )),
  dorian_contacted     boolean not null default false,
  next_follow_up_at    timestamptz,
  follow_up_notes      text,
  research_notes       text,
  discovered_via        text not null default 'outbound_research',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.pink_partnership_prospects enable row level security;

-- Dedup: a website is a more reliable identity than a name (two
-- organizations can share a common name; a website rarely repeats). When
-- no website is known yet, fall back to the organization name.
create unique index if not exists pink_partnership_prospects_website_unique
  on public.pink_partnership_prospects (lower(website))
  where website is not null and website <> '';

create unique index if not exists pink_partnership_prospects_name_unique
  on public.pink_partnership_prospects (lower(organization_name))
  where website is null or website = '';

create index if not exists pink_partnership_prospects_follow_up_idx
  on public.pink_partnership_prospects (next_follow_up_at);

create index if not exists pink_partnership_prospects_status_idx
  on public.pink_partnership_prospects (status);

-- ---------------------------------------------------------------------
-- Agent 4 (Donor & Sponsor) -- outbound research prospects
-- ---------------------------------------------------------------------
create table if not exists public.pink_donor_prospects (
  id                  uuid primary key default gen_random_uuid(),
  organization_name   text not null,
  organization_type   text check (organization_type in (
                        'individual', 'business', 'foundation', 'community_organization',
                        'employer', 'other'
                      )),
  location             text,
  website               text,
  contact_name          text,
  contact_email         text,
  contact_phone         text,
  why_relevant          text,
  status                text not null default 'new' check (status in (
                          'new', 'reviewing', 'contacted', 'in_conversation',
                          'active', 'not_a_fit', 'declined'
                        )),
  dorian_contacted      boolean not null default false,
  next_follow_up_at     timestamptz,
  follow_up_notes       text,
  research_notes        text,
  discovered_via        text not null default 'outbound_research',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.pink_donor_prospects enable row level security;

create unique index if not exists pink_donor_prospects_website_unique
  on public.pink_donor_prospects (lower(website))
  where website is not null and website <> '';

create unique index if not exists pink_donor_prospects_name_unique
  on public.pink_donor_prospects (lower(organization_name))
  where website is null or website = '';

create index if not exists pink_donor_prospects_follow_up_idx
  on public.pink_donor_prospects (next_follow_up_at);

create index if not exists pink_donor_prospects_status_idx
  on public.pink_donor_prospects (status);

-- ---------------------------------------------------------------------
-- Agent 8 (Programs & Experiences) -- inbound inquiries
--
-- experience_interest is constrained to AVAIA's own already-established,
-- named Programs and Experiences (lib/institution.ts's PROGRAMS list, plus
-- the named Experience pages that already exist in app/: Defying Grief,
-- Youth Defying Grief, Chemistry of Virtue, Unsung Heroes, The View From
-- Above). Nothing here invents a package, a price, or a registration
-- model -- this is an inquiry record only.
-- ---------------------------------------------------------------------
create table if not exists public.avaia_experience_inquiries (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  email                 text not null,
  phone                 text,
  organization_name     text,
  group_type            text check (group_type in (
                          'school', 'business', 'faith_community', 'community_organization',
                          'conference', 'other'
                        )),
  approx_group_size     text,
  location              text,
  experience_interest   text not null check (experience_interest in (
                          'defying_grief', 'youth_defying_grief', 'workshops_and_speaking',
                          'chemistry_of_virtue', 'unsung_heroes', 'view_from_above', 'other'
                        )),
  request_details       text,
  status                text not null default 'new' check (status in (
                          'new', 'acknowledged', 'in_progress', 'scheduled', 'completed', 'not_a_fit'
                        )),
  needs_dorian          boolean not null default true,
  follow_up_needed      boolean not null default true,
  source                text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.avaia_experience_inquiries enable row level security;

create index if not exists avaia_experience_inquiries_status_idx
  on public.avaia_experience_inquiries (status);

-- ---------------------------------------------------------------------
-- Agent 8 (Programs & Experiences) -- outbound research prospects
-- ---------------------------------------------------------------------
create table if not exists public.avaia_experience_prospects (
  id                    uuid primary key default gen_random_uuid(),
  organization_name     text not null,
  organization_type     text check (organization_type in (
                          'school', 'conference', 'business', 'faith_community',
                          'community_organization', 'other'
                        )),
  location               text,
  website                 text,
  contact_name            text,
  contact_email           text,
  contact_phone           text,
  relevant_experience     text check (relevant_experience in (
                            'defying_grief', 'youth_defying_grief', 'workshops_and_speaking',
                            'chemistry_of_virtue', 'unsung_heroes', 'view_from_above', 'other'
                          )),
  why_relevant             text,
  status                   text not null default 'new' check (status in (
                            'new', 'reviewing', 'contacted', 'in_conversation',
                            'active', 'not_a_fit', 'declined'
                          )),
  dorian_contacted         boolean not null default false,
  next_follow_up_at        timestamptz,
  follow_up_notes          text,
  research_notes           text,
  discovered_via           text not null default 'outbound_research',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.avaia_experience_prospects enable row level security;

create unique index if not exists avaia_experience_prospects_website_unique
  on public.avaia_experience_prospects (lower(website))
  where website is not null and website <> '';

create unique index if not exists avaia_experience_prospects_name_unique
  on public.avaia_experience_prospects (lower(organization_name))
  where website is null or website = '';

create index if not exists avaia_experience_prospects_follow_up_idx
  on public.avaia_experience_prospects (next_follow_up_at);

create index if not exists avaia_experience_prospects_status_idx
  on public.avaia_experience_prospects (status);

-- ---------------------------------------------------------------------
-- Agent 9 (Communications & Content) -- planning/tracking foundation only.
--
-- No automated content generation and no read access to any private
-- table exists in this round -- Dorian (or a later, explicitly-authorized
-- process) is the only source of rows here, from material he has already
-- decided is public/approved. source_reference is a plain free-text field
-- for Dorian to note where an idea came from (a published page, an
-- already-public post); it is not a foreign key, and it never can be one
-- into Host/Workbook/Unsung Heroes/Shared Room/youth data.
-- ---------------------------------------------------------------------
create table if not exists public.avaia_content_items (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  content_type        text not null default 'social_post' check (content_type in (
                        'social_post', 'announcement', 'pr_media', 'other'
                      )),
  platform            text check (platform in (
                        'instagram', 'facebook', 'linkedin', 'tiktok', 'website', 'email', 'press', 'other'
                      )),
  related_to          text check (related_to in (
                        'defying_grief', 'youth_defying_grief', 'workshops_and_speaking',
                        'chemistry_of_virtue', 'unsung_heroes', 'view_from_above',
                        'pink_shoelace_general', 'pink_participation', 'other'
                      )),
  summary             text not null,
  source_reference    text,
  status               text not null default 'idea' check (status in (
                        'idea', 'draft', 'approved', 'scheduled', 'published', 'archived'
                      )),
  scheduled_for        timestamptz,
  published_at         timestamptz,
  notes                text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.avaia_content_items enable row level security;

create index if not exists avaia_content_items_status_idx
  on public.avaia_content_items (status);

create index if not exists avaia_content_items_scheduled_idx
  on public.avaia_content_items (scheduled_for);

-- ---------------------------------------------------------------------
-- Widen ai_usage_events.feature (0018/0045 pattern) to allow the new
-- outbound-research LLM calls (Agents 3/4/8) to record their own token
-- usage the same way every other AI call in this app already does.
-- ---------------------------------------------------------------------
alter table public.ai_usage_events drop constraint if exists ai_usage_events_feature_check;
alter table public.ai_usage_events add constraint ai_usage_events_feature_check
  check (feature in (
    'iap_conversation', 'cat_conversation', 'innercompass_conversation',
    'iap_referral', 'cat_referral', 'innercompass_referral',
    'cat_opening', 'innercompass_opening', 'iap_origin_opening',
    'unsung_heroes_recognition', 'unsung_heroes_conversation',
    'chemistry_virtue_formula', 'transcript_cleanup',
    'preparation_snapshot', 'preparation_chat',
    'room_conversation', 'room_referral', 'room_bring_forward_suggestion',
    'unsaid_conversation', 'prospect_research'
  ));
