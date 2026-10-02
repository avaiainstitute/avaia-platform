-- The Pink Shoelace Foundation Operations + Legacy Control Agent's data
-- layer. Purely additive: five new tables plus one additive column on the
-- already-live pink_partnerships table (0063).
--
-- AUDIT FINDING THIS MIGRATION IS SCOPED TO (see the final report for the
-- full audit): pink_contact_submissions, pink_participation_interest,
-- pink_partnerships, and pink_donor_sponsor_records already exist (0063)
-- and already have zero public RLS policies -- service-role only, no Pink
-- Shoelace login exists. There is no "Legacy" concept anywhere in this
-- schema before this migration, no Sponsored Access tracking, no campaign
-- review state, no commercial co-venture tracking, and no volunteer table.
-- There is also no payment workflow from the Foundation to AVAIA Institute
-- anywhere in the schema -- per the governing instruction's own conditional
-- ("if any such payment workflow exists"), nothing is added for that here.
--
-- GOVERNING POSTURE, enforced structurally, not just by convention: every
-- table below tracks and routes. None of them can represent the Foundation
-- itself approving a charitable expenditure, signing for Legacy, or
-- committing Legacy contractually -- there is no "approved_by_foundation"
-- state anywhere, only states that distinguish "ready for Legacy to look
-- at" from "Legacy responded" from "a human recorded Legacy's approval."
-- approved/final-approval fields are always a plain text/identity field a
-- human fills in after a real conversation with Legacy, never inferred
-- from submission or from any automated process.
--
-- RLS POSTURE: identical to 0063 -- RLS enabled, zero public policies.
-- Only the service-role client (server-side admin/cron code) can read or
-- write these tables. Nothing here is reachable from the browser, and
-- nothing here has a public insert policy -- every row is created
-- deliberately by an admin/agent action, never by an anonymous form poster
-- (the one exception, pink_volunteers, still has zero public policies; a
-- future public volunteer-interest form would POST through a server route
-- using the service-role client, exactly like pink_contact_submissions
-- does today -- see lib/pink/* for that pattern).

-- ---------------------------------------------------------------------------
-- pink_legacy_review_items -- the Legacy Review Queue (governing instruction
-- item 1). One row per item that requires Legacy Global Programs review,
-- authorization, payment, or signature before the Foundation proceeds.
-- item_type is deliberately a small fixed set matching the operational
-- areas this same migration adds tracking for, plus 'avaia_institute_payment'
-- and 'other' for anything that doesn't have its own table. Domain tables
-- below (sponsored access, campaign, commercial co-venture) each hold a
-- nullable legacy_review_item_id pointing back here, rather than this table
-- holding outbound references to every domain table -- avoids a circular
-- dependency and keeps this table meaningful even for an item_type with no
-- dedicated domain table yet (e.g. a one-off AVAIA Institute payment
-- request, or 'other').
--
-- state deliberately never includes anything resembling "foundation
-- approved" -- 'approved' here can only mean "a human recorded that Legacy
-- approved this," and final_approval_recorded_by/_at exist specifically so
-- that fact is always attributable to a real person's action, never to this
-- system inferring approval from a status change.
-- ---------------------------------------------------------------------------
create table if not exists public.pink_legacy_review_items (
  id                          uuid primary key default gen_random_uuid(),
  item_type                   text not null check (item_type in (
                                 'sponsored_access', 'avaia_institute_payment', 'partnership_agreement',
                                 'campaign', 'commercial_co_venture', 'other'
                               )),
  description                 text not null,
  foundation_owner            text,
  legacy_review_required      boolean not null default true,
  state                       text not null default 'draft' check (state in (
                                 'draft', 'ready_for_legacy', 'submitted_to_legacy', 'waiting_on_legacy',
                                 'changes_required', 'approved', 'closed'
                               )),
  submitted_at                timestamptz,
  requested_response_date     timestamptz,
  legacy_response             text,
  changes_required_notes      text,
  -- Populated only by a human recording a real fact ("Legacy approved this
  -- on a call on <date>, per Jane at Legacy"). Never set by this system
  -- inferring approval from a state transition.
  final_approval_recorded_by  text,
  final_approval_recorded_at  timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists pink_legacy_review_items_state_idx
  on public.pink_legacy_review_items (state);
create index if not exists pink_legacy_review_items_response_due_idx
  on public.pink_legacy_review_items (requested_response_date)
  where state in ('submitted_to_legacy', 'waiting_on_legacy');

alter table public.pink_legacy_review_items enable row level security;

-- ---------------------------------------------------------------------------
-- pink_sponsored_access_requests -- item 2. Administrative tracking only.
-- Hard rule enforced structurally: payment_status's only "money moved"
-- state is 'paid_by_legacy' -- there is no 'paid_by_foundation' state,
-- because Foundation automation never issues this payment directly to a
-- beneficiary. Legacy pays the provider/organization after its own review.
-- ---------------------------------------------------------------------------
create table if not exists public.pink_sponsored_access_requests (
  id                             uuid primary key default gen_random_uuid(),
  charitable_purpose             text not null,
  provider_organization          text not null,
  invoice_reference              text,
  w9_on_file                     boolean not null default false,
  payment_instructions_reference text,
  legacy_review_item_id          uuid references public.pink_legacy_review_items (id) on delete set null,
  payment_status                 text not null default 'not_submitted' check (payment_status in (
                                    'not_submitted', 'submitted_to_legacy', 'approved_by_legacy',
                                    'paid_by_legacy', 'declined_by_legacy'
                                  )),
  source_contact_id              uuid references public.pink_contact_submissions (id) on delete set null,
  notes                          text,
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now()
);

alter table public.pink_sponsored_access_requests enable row level security;

-- ---------------------------------------------------------------------------
-- pink_campaign_items -- item 5. Fundraising/public campaign language.
-- state is deliberately only two values so "submitted" can never be
-- confused with "approved" -- approved_for_publication is set only via
-- approved_by/approved_at, the same human-attributed-fact pattern as
-- final_approval_recorded_by above.
-- ---------------------------------------------------------------------------
create table if not exists public.pink_campaign_items (
  id                      uuid primary key default gen_random_uuid(),
  title                   text not null,
  content                 text not null,
  state                   text not null default 'draft' check (state in ('draft', 'approved_for_publication')),
  legacy_review_item_id   uuid references public.pink_legacy_review_items (id) on delete set null,
  approved_by             text,
  approved_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.pink_campaign_items enable row level security;

-- ---------------------------------------------------------------------------
-- pink_commercial_co_ventures -- item 7. Any proposed arrangement
-- advertising that a percentage, dollar amount, or other defined portion of
-- commercial sales benefits The Pink Shoelace Foundation. Every row is a
-- review trigger by construction -- there is no "approved" state on this
-- table itself; approval lives on the linked pink_legacy_review_items row,
-- recorded the same human-attributed way as everything else here.
-- ---------------------------------------------------------------------------
create table if not exists public.pink_commercial_co_ventures (
  id                      uuid primary key default gen_random_uuid(),
  proposed_partner        text not null,
  calculation_method      text,
  proposed_terms          text,
  advertising_language    text,
  agreement_reference     text,
  legacy_review_item_id   uuid references public.pink_legacy_review_items (id) on delete set null,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.pink_commercial_co_ventures enable row level security;

-- ---------------------------------------------------------------------------
-- pink_volunteers -- item 8 (Community Connection Volunteers). Minimal,
-- audited to not invent universal insurance/waiver/background-check
-- requirements -- safety_review_state is a visibility flag for a human/
-- Legacy judgment call, never a system-determined requirement.
-- ---------------------------------------------------------------------------
create table if not exists public.pink_volunteers (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  email                   text,
  assignment              text,
  onboarding_status       text not null default 'inquiry' check (onboarding_status in (
                            'inquiry', 'onboarding', 'active', 'inactive'
                          )),
  activity_notes          text,
  -- Never auto-determined. A human (or Legacy) decides whether a given
  -- assignment warrants additional safeguards; this field only records
  -- that a look is recommended, not that a requirement was triggered.
  safety_review_state     text not null default 'not_flagged' check (safety_review_state in (
                            'not_flagged', 'human_review_recommended', 'legacy_review_recommended'
                          )),
  legacy_review_item_id   uuid references public.pink_legacy_review_items (id) on delete set null,
  source_contact_id       uuid references public.pink_contact_submissions (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.pink_volunteers enable row level security;

-- ---------------------------------------------------------------------------
-- pink_foundation_reminders -- idempotency/cooldown tracking for this
-- agent's reminders, the exact same shape and purpose as
-- host_onboarding_reminders / guide_candidate_reminders (0064): one row per
-- reminder actually sent, so a daily cron never re-sends the same reminder
-- for the same item. entity_type + entity_id together identify which row
-- in which table the reminder was about.
-- ---------------------------------------------------------------------------
create table if not exists public.pink_foundation_reminders (
  id             uuid primary key default gen_random_uuid(),
  entity_type    text not null check (entity_type in (
                   'legacy_review_item', 'sponsored_access_request', 'partnership', 'campaign_item'
                 )),
  entity_id      uuid not null,
  reminder_type  text not null check (reminder_type in (
                   'legacy_review_reminder', 'incomplete_document_reminder',
                   'partnership_follow_up_reminder', 'overdue_legacy_response_flag'
                 )),
  sent_at        timestamptz not null default now()
);

create index if not exists pink_foundation_reminders_entity_idx
  on public.pink_foundation_reminders (entity_type, entity_id, reminder_type, sent_at desc);

alter table public.pink_foundation_reminders enable row level security;

-- ---------------------------------------------------------------------------
-- Additive column on the already-live pink_partnerships table (0063):
-- lets a partnership be linked to a Legacy Review Queue item once it
-- reaches commitment stage ("When an agreement reaches commitment stage,
-- route to Legacy" -- governing instruction item 4). Nullable, no default
-- change needed, every existing row stays valid.
-- ---------------------------------------------------------------------------
alter table public.pink_partnerships
  add column if not exists legacy_review_item_id uuid references public.pink_legacy_review_items (id) on delete set null;
