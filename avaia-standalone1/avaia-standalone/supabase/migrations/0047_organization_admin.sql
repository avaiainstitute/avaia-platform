-- AVAIA Organization Administrator V1. Governing principle: "The
-- Organization Administrator administers access, participation, people,
-- and programs -- but never administers the Host's story."
--
-- Audited first: organizations (0043) is a shared directory row with no
-- login and no membership concept; youth_programs/youth_program_
-- participants/guide_participants are all strictly single-Guide-owned via
-- RLS ("guide_id = auth.uid()"), already proven (live multi-Guide
-- isolation test, prior pass) to correctly isolate Guide-to-Guide even
-- under the same organization_id. Nothing about that isolation changes
-- here -- this migration adds two new, narrow, additive tables and
-- touches zero existing RLS policies.
--
-- Deliberately NOT new RLS on guide_participants/youth_programs/
-- guardian_consents granting Organization Administrators read access
-- through the ordinary RLS-scoped client. Every Org Admin page instead
-- reads through the service-role admin client from trusted server code
-- that re-checks organization_admins itself and explicitly limits which
-- columns/tables it touches (operational status only -- never messages,
-- conversations, referrals, recognitions, virtue_signature_entries, or
-- Preparation content) -- the same pattern already proven safe by
-- /admin/youth-data and /admin/reassign-participant. This means an
-- Organization Administrator's own ordinary Supabase session has exactly
-- zero special access to any Host-story table: a direct API/database
-- attempt against conversations/messages/referrals is blocked by the
-- SAME unmodified RLS that already blocks everyone else.
--
-- organizations itself is untouched -- still "never a login, never a
-- party with any content-access path." An Organization Administrator is
-- a genuinely new, separate identity: not a Guide, not a platform admin,
-- never granted either capability merely by holding this one.

-- ---------------------------------------------------------------------------
-- 1. organization_admins -- who administers which organization(s), and
--    whether that authorization is currently active. Same shape as the
--    already-proven guide_platform_authorizations (0025): row-per-grant,
--    two-value authorized/revoked status, granted_by/status_changed_by
--    for accountability, platform-admin-only write (organization
--    administration authority is granted by AVAIA, not self-service and
--    not Guide-granted, matching every other authorization table in this
--    schema). One person may hold active rows for more than one
--    organization; one organization may have more than one active admin
--    -- both are ordinary rows in this same table, no special-casing
--    needed.
-- ---------------------------------------------------------------------------
create table public.organization_admins (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  host_id             uuid not null references auth.users(id) on delete cascade,
  status              text not null default 'authorized' check (status in ('authorized', 'revoked')),
  granted_by          uuid references auth.users(id) on delete set null,
  granted_at          timestamptz not null default now(),
  status_changed_by   uuid references auth.users(id) on delete set null,
  status_changed_at   timestamptz not null default now(),
  notes               text
);

create unique index organization_admins_one_active_idx
  on public.organization_admins (organization_id, host_id)
  where status = 'authorized';

create index organization_admins_host_idx on public.organization_admins (host_id);
create index organization_admins_org_idx on public.organization_admins (organization_id);

alter table public.organization_admins enable row level security;

create policy "organization admins self read"
  on public.organization_admins for select
  using (auth.uid() = host_id);

create policy "organization admins platform admin all"
  on public.organization_admins for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- 2. organization_admin_actions -- audit trail for actions an Organization
--    Administrator takes that affect access or participation. Never
--    holds private conversation content -- "action" and "detail" are
--    short operational labels (e.g. "guide_reassigned",
--    "participant_removed"), not free-text capable of leaking Host
--    material. Written only from trusted server code (the service-role
--    client), same as the tables it describes -- no direct-insert client
--    policy.
-- ---------------------------------------------------------------------------
create table public.organization_admin_actions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  actor_id          uuid not null references auth.users(id),
  action            text not null,
  program_id        uuid references public.youth_programs(id) on delete set null,
  participant_id    uuid references public.guide_participants(id) on delete set null,
  guide_id          uuid references auth.users(id) on delete set null,
  detail            text,
  created_at        timestamptz not null default now()
);

create index organization_admin_actions_org_idx on public.organization_admin_actions (organization_id, created_at desc);

alter table public.organization_admin_actions enable row level security;

-- An authorized (currently active) admin of this organization may read
-- its own audit trail -- re-derived live from organization_admins each
-- read, not cached, so a revoked admin immediately loses this too.
create policy "organization admin actions org admin read"
  on public.organization_admin_actions for select
  using (
    exists (
      select 1 from public.organization_admins oa
      where oa.organization_id = organization_admin_actions.organization_id
        and oa.host_id = auth.uid()
        and oa.status = 'authorized'
    )
  );

create policy "organization admin actions platform admin all"
  on public.organization_admin_actions for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
