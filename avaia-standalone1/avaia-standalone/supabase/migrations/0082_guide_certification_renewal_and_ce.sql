-- Guide certification renewal cycle, Continuing Education (CE) tracking,
-- Active -> Inactive lifecycle, and reactivation architecture.
--
-- OWNER-LOCKED POLICY THIS IMPLEMENTS (decided 2026-10-02):
--   * Certification runs on an individual rolling 365-day cycle beginning
--     on the date the Guide becomes actively certified (NOT a calendar
--     year).
--   * To stay active for the next 365 days a Guide must: complete 24
--     approved CE credits in the current period, pay the $295 annual
--     renewal fee, remain in good standing, and satisfy any mandatory
--     coursework that applies in that cycle. Payment alone is not
--     renewal; CE alone is not renewal.
--   * A dedicated AVAIA Ethics CE course is required at least once every
--     two years. Total / approved / category / Ethics credits are tracked
--     separately.
--   * At the end of a period without renewal the certification is NOT
--     deleted: it becomes INACTIVE. History is preserved, Program
--     Authorization rows are untouched, and an inactive Guide cannot hold
--     the active Guide seat.
--   * An inactive certification may be reactivated for up to 60 months
--     after becoming inactive. At 60+ months it is RECERTIFICATION_
--     REQUIRED: payment, CE, or automation can never restore it directly;
--     it must go back through the human-governed certification process.
--   * Reactivation fee (LOCKED 2026-10-02): up to and including 24 months
--     inactive $295; more than 24 and less than 60 months inactive $395 total
--     ($295 + $100 extended-inactivity fee); 60+ months unavailable. Payment
--     alone never reactivates: CE, Ethics, good standing and a human
--     confirmation still govern. The amounts stay configurable below.
--
-- DELIBERATELY NOT DEFINED HERE (still owner/curriculum decisions):
--   * the exact CE makeup required for reactivation (no policy knob exists
--     for it on purpose: the reactivation action requires a human to attest
--     the applicable CE requirement and good standing were verified, and the
--     system only enforces what IS decided: the 60-month window, current
--     Ethics, and payment)
--   * the Ethics curriculum or its credit value (the 'ethics' category
--     carries no credit value; each approved Ethics record states its own)
--   * any additional mandatory CE category (guide_ce_categories.required_
--     credits_per_cycle is NULL for every seeded category)
--   * admission/screening criteria, background-check policy, dual-
--     relationship rules, mandatory-reporting rules, Guide-transition
--     policy, new certification curriculum
--
-- ADDITIVE ONLY: one constraint widened (standing gains 'inactive'), five
-- nullable columns added to guide_certifications, five new tables, two
-- triggers. No existing table's rows are removed or rewritten except the
-- one-time backfill of the new cycle columns for already-certified Guides.
-- Safe to re-run: every statement is idempotent.
--
-- Every existing access gate (lib/guide.ts, RLS in 0027/0028/0029) already
-- checks standing = 'active' EXACTLY, so a new 'inactive' value fails
-- closed everywhere with no gate rewritten. The one place that did not read
-- certification at all (Toolkit authorization, and the experience/class
-- read policies in 0031/0037) is tightened at the bottom of this file.

-- ---------------------------------------------------------------------------
-- 0. SAFETY STOP: existing Guides whose certification is already >365 days old
-- ---------------------------------------------------------------------------
-- The locked rule starts each Guide's cycle on their certification date. For
-- a Guide certified more than 365 days ago that would put the expiration in
-- the past, and the daily Guide Operations run would mark them INACTIVE the
-- first time it ran after this migration. That must be an explicit owner
-- decision, never a side effect: this migration will not silently
-- grandfather, reset, extend, or deactivate anyone. If any ACTIVE
-- certification that has not yet been given cycle dates is already past 365
-- days, the whole migration stops here (nothing is applied) and names them.
-- See supabase/preflight/0082_existing_certification_cycles.sql for the same
-- check as a read-only query. Re-running after the cycle columns exist is
-- unaffected (only rows still missing cycle dates are examined).
do $$
declare
  v_bad text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'guide_certifications' and column_name = 'cycle_ends_at'
  ) then
    execute $q$
      select string_agg(id::text || ' (host ' || host_id::text || ', certified ' || certified_at::date::text || ')', '; ')
      from public.guide_certifications
      where standing = 'active' and cycle_ends_at is null
        and certified_at + interval '365 days' < now()
    $q$ into v_bad;
  else
    select string_agg(id::text || ' (host ' || host_id::text || ', certified ' || certified_at::date::text || ')', '; ')
    into v_bad
    from public.guide_certifications
    where standing = 'active' and certified_at + interval '365 days' < now();
  end if;

  if v_bad is not null then
    raise exception
      'OWNER REVIEW REQUIRED before 0082 can be applied: these active certifications are already more than 365 days old and would become inactive immediately: %. Decide each one explicitly; nothing was changed.',
      v_bad;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Policy settings (configurable without redesign)
-- ---------------------------------------------------------------------------
create table if not exists public.guide_certification_policy (
  key         text primary key,
  int_value   integer,
  text_value  text,
  note        text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

alter table public.guide_certification_policy enable row level security;

drop policy if exists "guide certification policy read" on public.guide_certification_policy;
create policy "guide certification policy read"
  on public.guide_certification_policy for select
  using (auth.uid() is not null);

drop policy if exists "guide certification policy admin all" on public.guide_certification_policy;
create policy "guide certification policy admin all"
  on public.guide_certification_policy for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into public.guide_certification_policy (key, int_value, text_value, note) values
  ('cycle_days', 365, null,
   'LOCKED. Length of one individual certification period, in days.'),
  ('required_ce_credits', 24, null,
   'LOCKED. Approved CE credits required in each 365-day period.'),
  ('annual_renewal_fee_cents', 29500, null,
   'LOCKED. Annual active-certification renewal fee ($295), in cents.'),
  ('ethics_interval_months', 24, null,
   'LOCKED. A dedicated AVAIA Ethics CE course is required at least once in this many months.'),
  ('reactivation_window_months', 60, null,
   'LOCKED. Months after becoming inactive during which reactivation is possible. At or beyond this: RECERTIFICATION_REQUIRED.'),
  ('reactivation_base_fee_cents', 29500, null,
   'LOCKED. Reactivation fee up to and including the surcharge threshold: $295, in cents.'),
  ('reactivation_surcharge_after_months', 24, null,
   'LOCKED threshold: MORE than this many months inactive (and before the reactivation window closes) falls in the extended-inactivity band.'),
  ('reactivation_surcharge_cents', 10000, null,
   'LOCKED. Extended-inactivity fee added to the base fee in that band ($100), so the total is $395. In cents.'),
  ('renewal_reminder_days', null, '90,60,30,14,7',
   'LOCKED. Days before expiration at which renewal reminders go to the Guide.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. CE categories (supports mandatory coursework + Ethics distinction)
-- ---------------------------------------------------------------------------
create table if not exists public.guide_ce_categories (
  key                     text primary key,
  label                   text not null,
  is_ethics               boolean not null default false,
  -- NULL = no per-cycle minimum for this category. A non-null value makes
  -- renewal require at least this many approved credits in the category
  -- during the period. Every seeded category is NULL: no mandatory category
  -- has been decided yet, and none is invented here.
  required_credits_per_cycle numeric(6,2),
  active                  boolean not null default true,
  note                    text
);

alter table public.guide_ce_categories enable row level security;

drop policy if exists "guide ce categories read" on public.guide_ce_categories;
create policy "guide ce categories read"
  on public.guide_ce_categories for select
  using (auth.uid() is not null);

drop policy if exists "guide ce categories admin all" on public.guide_ce_categories;
create policy "guide ce categories admin all"
  on public.guide_ce_categories for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into public.guide_ce_categories (key, label, is_ethics, note) values
  ('general', 'General continuing education', false, null),
  ('ethics', 'AVAIA Ethics', true,
   'The dedicated Ethics CE course, required at least once every ethics_interval_months. Credit value per record is stated by the approver; no value is defined here.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 3. guide_certifications: Inactive standing + cycle columns
-- ---------------------------------------------------------------------------
alter table public.guide_certifications
  drop constraint if exists guide_certifications_standing_check;
alter table public.guide_certifications
  add constraint guide_certifications_standing_check
  check (standing in ('active', 'paused', 'revoked', 'inactive'));

alter table public.guide_certifications
  add column if not exists cycle_started_at timestamptz,
  add column if not exists cycle_ends_at timestamptz,
  add column if not exists inactive_since timestamptz,
  add column if not exists last_renewed_at timestamptz,
  add column if not exists recertification_required_at timestamptz;

comment on column public.guide_certifications.cycle_started_at is
  'Start of the Guide''s CURRENT 365-day period (individual rolling cycle, not a calendar year).';
comment on column public.guide_certifications.cycle_ends_at is
  'Expiration of the current period. Renewal requirements must be satisfied before this instant.';
comment on column public.guide_certifications.inactive_since is
  'When the certification became INACTIVE (the expiration instant it lapsed at). Drives the 60-month reactivation window.';
comment on column public.guide_certifications.last_renewed_at is
  'When the most recent renewal or reactivation was confirmed by a human. Fee payments dated after this belong to the NEXT renewal.';
comment on column public.guide_certifications.recertification_required_at is
  'First time the system observed this inactive certification at or beyond the reactivation window (RECERTIFICATION_REQUIRED). Informational; the state itself is derived from inactive_since.';

-- Backfill: every already-certified Guide starts their cycle on their
-- certification date (the locked rule), using the configured cycle length.
update public.guide_certifications
set cycle_started_at = certified_at
where cycle_started_at is null;

update public.guide_certifications
set cycle_ends_at = cycle_started_at
      + make_interval(days => coalesce(
          (select int_value from public.guide_certification_policy where key = 'cycle_days'), 365))
where cycle_ends_at is null;

-- An inactive certification must say when it became inactive; the
-- reactivation window cannot be computed otherwise.
alter table public.guide_certifications
  drop constraint if exists guide_certifications_inactive_requires_since;
alter table public.guide_certifications
  add constraint guide_certifications_inactive_requires_since
  check (standing <> 'inactive' or inactive_since is not null);

-- New certifications (grantGuideCertification inserts without cycle
-- columns) get their cycle from certified_at automatically.
create or replace function public.guide_certifications_set_cycle()
returns trigger
language plpgsql
as $$
declare
  v_days integer;
begin
  if new.cycle_started_at is null then
    new.cycle_started_at := new.certified_at;
  end if;
  if new.cycle_ends_at is null then
    select int_value into v_days from public.guide_certification_policy where key = 'cycle_days';
    new.cycle_ends_at := new.cycle_started_at + make_interval(days => coalesce(v_days, 365));
  end if;
  return new;
end;
$$;

drop trigger if exists guide_certifications_set_cycle on public.guide_certifications;
create trigger guide_certifications_set_cycle
  before insert on public.guide_certifications
  for each row execute function public.guide_certifications_set_cycle();

-- FIVE-YEAR RULE, enforced in the database so no payment, CE record,
-- automation, or application bug can restore a certification that has been
-- inactive for the full window. Reactivation of an inactive certification
-- is only possible while now() < inactive_since + the window. Beyond that
-- the person must be certified again through the human-governed process,
-- which creates a NEW guide_certifications row (an INSERT, not covered
-- here) rather than flipping this one back to active.
create or replace function public.guide_certifications_guard_reactivation()
returns trigger
language plpgsql
as $$
declare
  v_months      integer;
  v_window_open boolean;
  v_to_active   boolean;
begin
  -- Only rows that have ever been inactive carry inactive_since. (Going
  -- paused/revoked first and then active, or clearing inactive_since,
  -- would otherwise be a way around the window, so both are covered.)
  if old.inactive_since is not null then
    select int_value into v_months
    from public.guide_certification_policy
    where key = 'reactivation_window_months';
    v_months := coalesce(v_months, 60);
    v_window_open := now() < old.inactive_since + make_interval(months => v_months);
    v_to_active := new.standing = 'active' and old.standing <> 'active';

    if v_to_active and not v_window_open then
      raise exception
        'RECERTIFICATION_REQUIRED: this certification has been inactive for % months or more and cannot be restored to active standing directly. It must go through the human-governed AVAIA certification process again.',
        v_months;
    end if;

    if new.inactive_since is distinct from old.inactive_since
       and not (v_to_active and v_window_open) then
      raise exception
        'inactive_since can only be cleared by a reactivation inside the % month window.',
        v_months;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guide_certifications_guard_reactivation on public.guide_certifications;
create trigger guide_certifications_guard_reactivation
  before update on public.guide_certifications
  for each row execute function public.guide_certifications_guard_reactivation();

-- ---------------------------------------------------------------------------
-- 4. CE credit records
-- ---------------------------------------------------------------------------
-- One row per CE record. 'recorded' = entered, not yet counted; only
-- 'approved' credits count toward the 24. Approval is always a human act
-- (approved_by); nothing in the automation layer ever approves a credit.
-- program_authorization_key lets approved Program Authorization coursework
-- count as CE without a second certification system: the Guide must already
-- be certified (certification_id is required) and the key only tags WHICH
-- authorization's training the credit came from. This table does not grant
-- or establish any authorization.
create table if not exists public.guide_ce_credits (
  id                          uuid primary key default gen_random_uuid(),
  certification_id            uuid not null references public.guide_certifications (id) on delete cascade,
  host_id                     uuid not null references auth.users (id) on delete cascade,
  title                       text not null,
  provider                    text,
  category                    text not null default 'general' references public.guide_ce_categories (key),
  credits                     numeric(6,2) not null check (credits > 0),
  completed_on                date not null,
  status                      text not null default 'recorded'
                                check (status in ('recorded', 'approved', 'rejected')),
  program_authorization_key   text
                                check (program_authorization_key is null or program_authorization_key in (
                                  'defying-grief', 'unsung-heroes', 'view-from-above',
                                  'shared-room', 'youth'
                                )),
  notes                       text,
  recorded_by                 uuid references auth.users (id) on delete set null,
  approved_by                 uuid references auth.users (id) on delete set null,
  approved_at                 timestamptz,
  created_at                  timestamptz not null default now(),
  constraint guide_ce_credits_approved_has_time
    check (status <> 'approved' or approved_at is not null)
);

create index if not exists guide_ce_credits_cert_idx
  on public.guide_ce_credits (certification_id, completed_on);
create index if not exists guide_ce_credits_host_idx
  on public.guide_ce_credits (host_id);

alter table public.guide_ce_credits enable row level security;

drop policy if exists "guide ce credits self read" on public.guide_ce_credits;
create policy "guide ce credits self read"
  on public.guide_ce_credits for select
  using (auth.uid() = host_id);

drop policy if exists "guide ce credits admin all" on public.guide_ce_credits;
create policy "guide ce credits admin all"
  on public.guide_ce_credits for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- 5. Renewal / reactivation fee payments
-- ---------------------------------------------------------------------------
-- Deliberately NOT guide_certification_payments (0062): that table holds
-- the program ENROLLMENT payment, requires a Stripe checkout session id,
-- and is read by the pipeline watchers as "paid, awaiting a decision".
-- Mixing renewal fees in would corrupt that meaning. A payment is
-- "unapplied" while paid_at is later than the certification's
-- last_renewed_at (or certified_at when never renewed); a confirmed
-- renewal or reactivation moves last_renewed_at forward, which is what
-- consumes it. No consumed flag to keep in sync.
create table if not exists public.guide_certification_fee_payments (
  id                 uuid primary key default gen_random_uuid(),
  certification_id   uuid not null references public.guide_certifications (id) on delete cascade,
  host_id            uuid not null references auth.users (id) on delete cascade,
  fee_type           text not null check (fee_type in ('annual_renewal', 'reactivation')),
  amount_cents       integer not null check (amount_cents >= 0),
  -- Informational: the portion of amount_cents that was a reactivation
  -- surcharge, when one applied.
  surcharge_cents    integer not null default 0 check (surcharge_cents >= 0),
  paid_at            timestamptz not null default now(),
  -- Free text: a Stripe payment/invoice id, or 'manual' with a note.
  reference          text,
  recorded_by        uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index if not exists guide_certification_fee_payments_cert_idx
  on public.guide_certification_fee_payments (certification_id, paid_at);
create index if not exists guide_certification_fee_payments_host_idx
  on public.guide_certification_fee_payments (host_id);

alter table public.guide_certification_fee_payments enable row level security;

drop policy if exists "guide certification fee payments self read" on public.guide_certification_fee_payments;
create policy "guide certification fee payments self read"
  on public.guide_certification_fee_payments for select
  using (auth.uid() = host_id);

drop policy if exists "guide certification fee payments admin all" on public.guide_certification_fee_payments;
create policy "guide certification fee payments admin all"
  on public.guide_certification_fee_payments for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- 6. Renewal reminder log (idempotency: one reminder per band per period)
-- ---------------------------------------------------------------------------
create table if not exists public.guide_certification_renewal_reminders (
  id                 uuid primary key default gen_random_uuid(),
  certification_id   uuid not null references public.guide_certifications (id) on delete cascade,
  host_id            uuid not null references auth.users (id) on delete cascade,
  -- Which period this reminder was about (the cycle_ends_at at send time),
  -- so a renewal that moves the expiration starts a fresh set of reminders.
  cycle_ends_at      timestamptz not null,
  days_before        integer not null check (days_before > 0),
  sent_at            timestamptz not null default now(),
  unique (certification_id, cycle_ends_at, days_before)
);

alter table public.guide_certification_renewal_reminders enable row level security;

drop policy if exists "guide certification renewal reminders admin all" on public.guide_certification_renewal_reminders;
create policy "guide certification renewal reminders admin all"
  on public.guide_certification_renewal_reminders for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- 7. Enforcement: Toolkit-side reads now also require ACTIVE certification
-- ---------------------------------------------------------------------------
-- 0031/0037 gated Guide reads of experiences, sections, classes, and
-- experience_classes on a Toolkit authorization alone, never reading
-- certification. With certification able to go INACTIVE, an inactive Guide
-- would otherwise keep reading Guide-only curriculum straight through the
-- API. Same pattern 0029 already uses: authorization AND standing = 'active'.
-- The authorization rows themselves are never touched, so earned
-- authorization history stays attached to the Guide while inactive.
drop policy if exists "experiences guide read" on public.experiences;
create policy "experiences guide read"
  on public.experiences for select
  using (
    status = 'published'
    and exists (
      select 1 from public.guide_platform_authorizations gpa
      where gpa.host_id = auth.uid()
        and gpa.capability = 'toolkit'
        and gpa.status = 'authorized'
    )
    and exists (
      select 1 from public.guide_certifications gc
      where gc.host_id = auth.uid() and gc.standing = 'active'
    )
  );

drop policy if exists "experience sections guide read" on public.experience_sections;
create policy "experience sections guide read"
  on public.experience_sections for select
  using (
    status = 'published'
    and exists (
      select 1 from public.guide_platform_authorizations gpa
      where gpa.host_id = auth.uid()
        and gpa.capability = 'toolkit'
        and gpa.status = 'authorized'
    )
    and exists (
      select 1 from public.guide_certifications gc
      where gc.host_id = auth.uid() and gc.standing = 'active'
    )
    and exists (
      select 1 from public.experiences e
      where e.id = experience_sections.experience_id and e.status = 'published'
    )
  );

drop policy if exists "classes guide read" on public.classes;
create policy "classes guide read"
  on public.classes for select
  using (
    status = 'published'
    and exists (
      select 1 from public.guide_platform_authorizations gpa
      where gpa.host_id = auth.uid()
        and gpa.capability = 'toolkit'
        and gpa.status = 'authorized'
    )
    and exists (
      select 1 from public.guide_certifications gc
      where gc.host_id = auth.uid() and gc.standing = 'active'
    )
  );

drop policy if exists "experience classes guide read" on public.experience_classes;
create policy "experience classes guide read"
  on public.experience_classes for select
  using (
    exists (
      select 1 from public.guide_platform_authorizations gpa
      where gpa.host_id = auth.uid()
        and gpa.capability = 'toolkit'
        and gpa.status = 'authorized'
    )
    and exists (
      select 1 from public.guide_certifications gc
      where gc.host_id = auth.uid() and gc.standing = 'active'
    )
  );

-- Verification: every certified Guide should now carry a cycle, and the new
-- policy rows should be present. Read-only.
select
  (select count(*) from public.guide_certifications where cycle_ends_at is null) as certifications_missing_cycle,
  (select count(*) from public.guide_certification_policy) as policy_rows,
  (select count(*) from public.guide_ce_categories) as ce_categories;
