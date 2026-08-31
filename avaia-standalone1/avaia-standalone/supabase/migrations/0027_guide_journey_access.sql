-- Host-owned Guided Journey access relationship (Phase E.2). Database
-- foundation only -- no application code, no read/write access to any
-- Journey/conversation/message/referral/Workbook data is granted by this
-- migration. Purely additive except one small, behavior-preserving
-- addition to journeys (a new unique constraint, no column/RLS change).
--
-- ============================================================================
-- IMPORTANT -- THIS IS THE RELATIONSHIP RECORD ONLY, NOT ACCESS ITSELF.
--
-- guide_journey_access answers: "has this Host explicitly, scopedly,
-- revocably invited this specific Guide to facilitate this specific
-- Journey?" It does NOT itself grant the Guide any ability to read or
-- write conversations, messages, referrals, or Workbook content -- no RLS
-- on journeys/conversations/messages/referrals/shared_access/profiles/
-- Library/Unsung Heroes is added, changed, or referenced by this
-- migration. That is deliberately later, separately-approved work (a
-- future phase, not E.2). The Journey remains Host-owned throughout: this
-- table records a facilitation invitation, never a transfer of ownership.
--
-- IMPORTANT -- HOST OWNERSHIP INTEGRITY IS ENFORCED BY FOREIGN KEY, NOT
-- APPLICATION TRUST.
--
-- host_id is never taken on faith. journeys gets a new composite unique
-- constraint (id, host_id) -- redundant with the existing primary key in
-- the sense that id alone is already unique, but it lets
-- guide_journey_access declare a composite foreign key
-- (journey_id, host_id) references journeys (id, host_id). That FK makes
-- it structurally impossible for a guide_journey_access row to name a
-- host_id other than the journey's real, current owner -- enforced by
-- Postgres itself, not by a trigger, and not bypassable by any future code
-- path that forgets to check. It also gives correct cascade-delete
-- behavior for free: deleting a journey, or (transitively, since
-- journeys.host_id already cascades from auth.users) deleting the Host's
-- account, cascades here too.
--
-- IMPORTANT -- CERTIFICATION, PLATFORM AUTHORIZATION, AND THIS TABLE
-- REMAIN THREE SEPARATE FACTS.
--
-- A Host may only create an ACTIVE guide_journey_access row for a Guide
-- who independently holds both an active guide_certifications standing
-- and an authorized guide_platform_authorizations row for the
-- 'guided_journey_facilitation' capability specifically -- Toolkit
-- authorization is not sufficient, per the approved Phase D/E.1
-- architecture. This is enforced in the Host INSERT policy's WITH CHECK
-- clause below, the same exists()-subquery pattern already used
-- throughout this schema (e.g. every "... admin all" policy) -- not a
-- trigger, since RLS already expresses this cleanly and consistently with
-- existing convention. Nothing in this migration touches
-- guide_certifications or guide_platform_authorizations themselves.
-- ============================================================================

alter table public.journeys
  add constraint journeys_id_host_id_unique unique (id, host_id);

create table if not exists public.guide_journey_access (
  id          uuid primary key default gen_random_uuid(),
  journey_id  uuid not null,
  host_id     uuid not null,
  guide_id    uuid not null references auth.users (id) on delete cascade,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  foreign key (journey_id, host_id) references public.journeys (id, host_id) on delete cascade
);

create index if not exists guide_journey_access_journey_idx on public.guide_journey_access (journey_id);
create index if not exists guide_journey_access_host_idx on public.guide_journey_access (host_id);
create index if not exists guide_journey_access_guide_idx on public.guide_journey_access (guide_id);

-- Prevents duplicate ACTIVE access for the same (journey, guide) pair --
-- the same partial-unique-index technique already used by
-- guide_candidates_one_open_per_host (0022) and
-- guide_platform_authorizations_one_active_idx (0025). A (journey, guide)
-- pair may still accumulate historical rows over time (granted, revoked,
-- granted again) -- this only blocks two simultaneously-active rows for
-- the same pair. Deliberately keyed on (journey_id, guide_id), not
-- journey_id alone, per the approved E.2 spec -- this does not by itself
-- decide whether a Journey may ever have more than one concurrently
-- active Guide; that question is not assumed or expanded here.
create unique index if not exists guide_journey_access_one_active_idx
  on public.guide_journey_access (journey_id, guide_id)
  where revoked_at is null;

-- Revocation must be explicit and durable: only revoked_at may change
-- after creation, and only from null to non-null -- never reversed, never
-- alongside a change to journey_id/host_id/guide_id/granted_at. RLS's
-- WITH CHECK alone cannot express an old-value-vs-new-value constraint,
-- so this narrow trigger is the smallest correct mechanism for exactly
-- that immutability rule -- it does not implement any broader status
-- machinery.
create or replace function public.guide_journey_access_prevent_mutation()
returns trigger language plpgsql as $$
begin
  if new.journey_id <> old.journey_id
     or new.host_id <> old.host_id
     or new.guide_id <> old.guide_id
     or new.granted_at <> old.granted_at then
    raise exception 'guide_journey_access: journey_id, host_id, guide_id, and granted_at are immutable after the row is created';
  end if;
  if old.revoked_at is not null and new.revoked_at is null then
    raise exception 'guide_journey_access: a revoked access row cannot be reactivated by clearing revoked_at';
  end if;
  return new;
end;
$$;

drop trigger if exists guide_journey_access_prevent_mutation_trigger on public.guide_journey_access;
create trigger guide_journey_access_prevent_mutation_trigger
  before update on public.guide_journey_access
  for each row execute function public.guide_journey_access_prevent_mutation();

alter table public.guide_journey_access enable row level security;

-- Host: sees access rows for Journeys they own. Sufficient on its own --
-- the composite foreign key above already guarantees host_id can only
-- ever be that journey's real owner, so this never needs to join back to
-- journeys itself.
create policy "guide journey access host select"
  on public.guide_journey_access for select
  using (auth.uid() = host_id);

-- Host: may create access only as themselves (never naming another Host's
-- account as host_id -- combined with the composite FK, this closes the
-- loophole completely: the row must both claim auth.uid() as host_id AND
-- have that host_id be journey_id's real owner), and only for a Guide who
-- is independently, currently eligible: an active certification standing
-- and an authorized guided_journey_facilitation platform authorization.
-- Toolkit authorization is deliberately not checked here -- it is not a
-- substitute for guided_journey_facilitation authorization.
create policy "guide journey access host insert"
  on public.guide_journey_access for insert
  with check (
    auth.uid() = host_id
    and exists (
      select 1 from public.guide_certifications gc
      where gc.host_id = guide_id and gc.standing = 'active'
    )
    and exists (
      select 1 from public.guide_platform_authorizations gpa
      where gpa.host_id = guide_id
        and gpa.capability = 'guided_journey_facilitation'
        and gpa.status = 'authorized'
    )
  );

-- Host: may revoke (never delete) their own currently-active row. The
-- trigger above independently guarantees only revoked_at changes, and
-- only from null to non-null; this policy additionally restricts WHICH
-- rows are touchable (only the Host's own, only while still active) and
-- requires the result to actually be revoked.
create policy "guide journey access host revoke"
  on public.guide_journey_access for update
  using (auth.uid() = host_id and revoked_at is null)
  with check (auth.uid() = host_id and revoked_at is not null);

-- Guide: sees only their own rows, active or historical/revoked -- read
-- only, never insert/update/delete. A Guide can never grant themselves
-- access or revoke a Host's grant.
create policy "guide journey access guide select"
  on public.guide_journey_access for select
  using (auth.uid() = guide_id);

-- Admin: the same institutional-management pattern already used
-- throughout this schema (guide_candidates, guide_certifications,
-- guide_candidate_evidence, guide_certification_decisions,
-- guide_platform_authorizations, ...). No new or broader access model.
create policy "guide journey access admin all"
  on public.guide_journey_access for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
