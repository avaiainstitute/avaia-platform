-- AVAIA Organization Administrator V1.1 -- explicit Guide-to-organization
-- connection, independent of program history.
--
-- V1 (0047) originally defined "connected to an organization" as "has run
-- at least one youth_programs row there" -- a deliberate scope line, but
-- one that meant an Organization Administrator could never bring an
-- already-certified, already-Toolkit-authorized Guide into an
-- organization before that Guide had already run a program there. This
-- table closes that gap with the smallest safe addition: an explicit,
-- reversible connection record, written only by an Organization
-- Administrator of that same organization (through the service-role
-- admin client, matching 0047's whole posture), to an account that
-- already independently holds Toolkit platform authorization
-- (re-verified server-side at connect time -- see connectGuide() in
-- app/org-admin/[organizationId]/page.tsx).
--
-- Connection alone grants NOTHING. No RLS change here, same posture as
-- 0047: this table only makes a Guide id appear in
-- listGuidesConnectedToOrganization()'s result (lib/organization-admin.ts),
-- which the Organization Administrator's own roster UI reads to decide
-- who may be OFFERED as an assignment target. Actual Host/participant
-- access still arises only from guide_participants.guide_id, set only by
-- the existing, unchanged assignGuide action. Guide certification,
-- Toolkit platform authorization, and this organizational connection stay
-- three separate, independently-revocable facts -- one more independent
-- axis, none of them merged into another.
--
-- Unlike organization_admins' partial unique index (active-status-only),
-- this table uses a full unique(organization_id, guide_id) constraint so
-- an upsert can cleanly move a pair between 'connected' and
-- 'disconnected' and back (reconnect) without a second row -- a Guide
-- disconnected and later reconnected to the same organization keeps one
-- continuous history row, not a growing set of them.
create table public.organization_guides (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  guide_id            uuid not null references auth.users(id) on delete cascade,
  status              text not null default 'connected' check (status in ('connected', 'disconnected')),
  connected_by        uuid references auth.users(id) on delete set null,
  connected_at        timestamptz not null default now(),
  status_changed_by   uuid references auth.users(id) on delete set null,
  status_changed_at   timestamptz not null default now(),
  unique (organization_id, guide_id)
);

create index organization_guides_org_idx on public.organization_guides (organization_id);
create index organization_guides_guide_idx on public.organization_guides (guide_id);

alter table public.organization_guides enable row level security;

-- The Guide themselves may see which organizations they're connected to.
-- Grants no access to anything else -- this table never joins to any
-- Host-story data, it only records a connection's existence.
create policy "organization guides self read"
  on public.organization_guides for select
  using (auth.uid() = guide_id);

create policy "organization guides platform admin all"
  on public.organization_guides for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Deliberately no "organization admin write" RLS policy here, matching
-- 0047's own reasoning: an Organization Administrator's write actions
-- (connectGuide/disconnectGuide) go through the service-role admin
-- client from trusted server code that re-checks organization_admins
-- itself first, exactly like assignGuide/changeProgramStatus already do
-- for guide_participants/youth_programs. An Organization Administrator's
-- own ordinary Supabase session has zero special RLS access to this
-- table either.
