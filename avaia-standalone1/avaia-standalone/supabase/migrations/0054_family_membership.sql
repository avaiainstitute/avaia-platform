-- AVAIA Family Membership. Governing rule: "Family Membership is shared
-- payment/access -- not shared ownership of stories." Payment gives
-- access, not authority. Modeled directly on the two patterns already
-- proven in this schema: entitlements (0019) already anticipates a
-- 'family' source and is reused unchanged -- isMember() needs no code
-- change at all; and organization_admins (0047) is the precedent for
-- "one person administers a roster/billing relationship, but gets zero
-- new access to anyone's story content via RLS" -- self-read policies
-- only, all mutation through the service-role admin client from trusted
-- server code that re-verifies the caller itself. No table in this
-- migration grants any read access to conversations, messages,
-- referrals, journeys, recognitions, or virtue_signature_entries -- that
-- RLS is completely untouched. A Family member's private content stays
-- exactly as private from the Family purchaser as it already is from
-- every other Host on the platform.

-- ---------------------------------------------------------------------------
-- 1. family_memberships -- one row per purchased Family plan (the billing
--    relationship itself). owner_host_id is the purchaser. A person may
--    own at most one active Family plan at a time.
-- ---------------------------------------------------------------------------
create table public.family_memberships (
  id                          uuid primary key default gen_random_uuid(),
  owner_host_id               uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id          text,
  stripe_subscription_id      text,
  -- The Family base-plan subscription item (quantity always 1 -- the base
  -- $49/mo or $490/yr price covering the first 5 seats). Kept distinct
  -- from the extra-seat item below so the two can be billed/tracked
  -- independently on the same subscription.
  base_subscription_item_id   text,
  -- The additional-member line item ($7/mo or $70/yr each), created
  -- lazily the first time a 6th person is invited. quantity tracks how
  -- many extra seats are currently billed; null/0 until then.
  extra_seat_subscription_item_id  text,
  extra_seat_quantity         integer not null default 0,
  plan                        text not null check (plan in ('monthly', 'annual')),
  status                      text not null default 'active' check (status in ('active', 'canceled')),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create unique index family_memberships_one_active_owner_idx
  on public.family_memberships (owner_host_id)
  where status = 'active';

alter table public.family_memberships enable row level security;

-- The owner may read their own plan record (billing status, seat counts).
-- No policy grants anyone else read access -- a Family member reads their
-- OWN status through family_members below, never this table directly.
create policy "family_memberships owner read"
  on public.family_memberships for select
  using (auth.uid() = owner_host_id);

-- ---------------------------------------------------------------------------
-- 2. family_members -- the roster. One row per included person, including
--    the owner's own auto-created seat (is_owner = true), so entitlement
--    granting/revoking is uniform across every seat regardless of role.
-- ---------------------------------------------------------------------------
create table public.family_members (
  id                    uuid primary key default gen_random_uuid(),
  family_membership_id  uuid not null references public.family_memberships (id) on delete cascade,
  -- Null while an invite is outstanding; set the moment the invited person
  -- accepts. This IS the access boundary -- entitlements are only ever
  -- granted to a real host_id, never to an email address.
  host_id               uuid references auth.users (id) on delete cascade,
  invited_email         text not null,
  is_owner              boolean not null default false,
  -- True if this seat was added beyond the 5 included in the base price --
  -- decided once, at invite time, from how many seats were already
  -- occupied (active + invited). Determines whether removing this member
  -- later decrements extra-seat billing.
  is_extra_seat         boolean not null default false,
  status                text not null default 'invited' check (status in ('invited', 'active', 'removed')),
  invite_token          text unique,
  invited_by            uuid references auth.users (id) on delete set null,
  invited_at            timestamptz not null default now(),
  accepted_at           timestamptz,
  removed_at            timestamptz,
  removed_by            uuid references auth.users (id) on delete set null
);

-- One active/invited row per email per family -- no duplicate invites to
-- the same address while a prior invite/membership is still live.
create unique index family_members_one_live_email_idx
  on public.family_members (family_membership_id, lower(invited_email))
  where status in ('invited', 'active');

-- One active seat per host per family -- a person can't occupy two seats
-- on the same plan.
create unique index family_members_one_active_host_idx
  on public.family_members (family_membership_id, host_id)
  where status = 'active' and host_id is not null;

create index family_members_membership_idx on public.family_members (family_membership_id);
create index family_members_host_idx on public.family_members (host_id);
create index family_members_token_idx on public.family_members (invite_token) where invite_token is not null;

alter table public.family_members enable row level security;

-- The owner sees the full roster of their own plan.
create policy "family_members owner read"
  on public.family_members for select
  using (
    exists (
      select 1 from public.family_memberships fm
      where fm.id = family_members.family_membership_id
        and fm.owner_host_id = auth.uid()
    )
  );

-- A member sees only their OWN row -- e.g. for the Account page's "you're
-- part of X's Family Membership" line. They do not see who else is on the
-- plan through this policy -- roster visibility belongs to the owner only,
-- matching this feature's own "shared payment, not shared visibility"
-- posture. All writes (invite, accept, remove, leave) go through the
-- service-role admin client from lib/family-membership.ts, which
-- re-verifies the caller itself -- no insert/update/delete policy exists
-- here, same posture as organization_admins.
create policy "family_members self read"
  on public.family_members for select
  using (auth.uid() = host_id);

-- ---------------------------------------------------------------------------
-- 3. entitlements -- attribute a 'family'-sourced entitlement back to the
--    plan that granted it, so removing one member revokes only that
--    member's family-sourced row (never an Individual entitlement they
--    might separately hold, and never another member's row). 'family' is
--    already a valid source value as of 0019 -- no constraint change
--    needed.
-- ---------------------------------------------------------------------------
alter table public.entitlements
  add column if not exists family_membership_id uuid references public.family_memberships (id) on delete set null;

create index if not exists entitlements_family_membership_idx
  on public.entitlements (family_membership_id) where family_membership_id is not null;
