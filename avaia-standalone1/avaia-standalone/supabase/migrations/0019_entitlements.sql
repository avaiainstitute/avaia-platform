-- Membership entitlement foundation -- Phase 1 of the Universal Membership
-- architecture. Separates WHO currently has access (this table) from
-- profiles.membership_status, which becomes a frozen, unread legacy
-- column after this migration -- kept in place, not dropped, not
-- modified. isMember() now resolves access from here instead.
create table if not exists public.entitlements (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references auth.users (id) on delete cascade,
  status      text not null default 'active' check (status in ('active', 'revoked')),
  -- null = open-ended (an ongoing subscription, the only kind granted in
  -- this phase). Set only for a future fixed-term arrangement (e.g.
  -- Organization access -- not built yet). Checked live at query time,
  -- so no background expiry job is required for correctness.
  expires_at  timestamptz,
  -- Reporting/attribution only -- never used for authorization logic.
  -- 'individual' is the only source any code path grants in this phase;
  -- the others are named here so later phases don't need a schema change
  -- just to record a new funding arrangement.
  source      text not null check (source in
                ('individual', 'supported', 'family', 'gift', 'sponsored', 'organization')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists entitlements_host_active_idx
  on public.entitlements (host_id) where status = 'active';

alter table public.entitlements enable row level security;
-- A Host may read their own entitlement rows -- this is the Host's own
-- access/billing status, not private conversation content, and
-- isMember() itself queries through the caller's own per-request client,
-- so it needs this policy to see anything at all. Only the service-role
-- client (the Stripe webhook, and this migration's own backfill below)
-- ever writes to this table.
create policy "entitlements self read"
  on public.entitlements for select
  using (auth.uid() = host_id);

-- Non-destructive backfill: every Host currently marked 'member' gets one
-- active, open-ended Individual entitlement. profiles.membership_status
-- itself is left exactly as it is -- not read, not written, not dropped
-- -- by anything after this migration.
insert into public.entitlements (host_id, status, source)
select id, 'active', 'individual'
from public.profiles
where membership_status = 'member'
returning host_id, status, source;
