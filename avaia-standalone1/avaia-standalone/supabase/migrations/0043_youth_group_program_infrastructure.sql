-- AVAIA Youth Defying Grief -- Group + School/Organization Delivery
-- Completion Build. Real first-class program/group infrastructure,
-- stronger guardian-consent verification, and safeguarding
-- infrastructure. Inspected first: Classes and Experiences (lib/
-- experiences.ts, migrations 0020/0031/0033/0036/0040) are curriculum
-- CONTENT containers, not delivery-instance/roster entities -- there is
-- nothing there to reuse for "a specific Guide's scheduled program with a
-- registered roster," so this migration adds that as new, narrow,
-- additive tables rather than duplicating anything. guide_participants
-- (0012) remains the one participant-identity table -- reused here via a
-- join table, not duplicated.
--
-- COPPA (researched via ftc.gov/business-guidance/resources/complying-
-- coppa-frequently-asked-questions, FAQ I.4, 2026-09-02): the Rule
-- recognizes several verifiable-parental-consent methods for data
-- disclosed to third parties (signed form, payment-card verification,
-- trained-staff phone/video call, government-ID check, knowledge-based
-- questions, facial-recognition match), and a lighter "email plus"
-- pathway specifically for internal-use-only data (no third-party
-- disclosure) -- the closer fit for AVAIA, since Youth conversation
-- content is never disclosed to guardians, schools, or sponsors. This
-- migration adds the infrastructure for a guardian-initiated consent
-- action (a unique link only the guardian can complete) as a real step
-- toward that lighter pathway -- explicitly not a claim of full "email
-- plus" (which typically expects a second confirming step over a
-- different channel) or of full COPPA compliance; see the final report
-- for what still requires legal confirmation.

-- ---------------------------------------------------------------------------
-- 1. organizations -- a school, community organization, or program sponsor.
--    Identity and a designated contact only -- never a login, never a
--    party with any content-access path. Created by whichever Guide or
--    admin first registers it.
-- ---------------------------------------------------------------------------
create table public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  org_type            text not null default 'other' check (org_type in ('school', 'community_org', 'other')),
  contact_name        text,
  contact_email       text,
  notes               text,
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- Any authorized Guide may read the organization directory -- it's
-- operational/administrative data (a school's name and contact), never
-- Youth content, so there's no reason to scope it per-Guide the way
-- guide_participants is. Only the creator or an admin may modify it.
create policy "organizations guide read"
  on public.organizations for select
  using (
    exists (
      select 1 from public.guide_platform_authorizations a
      where a.host_id = auth.uid() and a.capability = 'toolkit' and a.status = 'authorized'
    )
  );

create policy "organizations creator write"
  on public.organizations for all
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "organizations admin all"
  on public.organizations for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- 2. youth_programs -- a first-class group/workshop/school program a Guide
--    creates and runs. The delivery instance/roster container Classes and
--    Experiences have no equivalent of. delivery_format is a plain text
--    label matching one of the Youth Master Curriculum's format_variant
--    titles (0040/0042) rather than a foreign key -- format_variant rows
--    are content, addressed by title in the UI already (see
--    DefyingGriefCurriculum.tsx), not a table this needs a hard
--    dependency on.
-- ---------------------------------------------------------------------------
create table public.youth_programs (
  id                    uuid primary key default gen_random_uuid(),
  guide_id              uuid not null references auth.users(id),
  name                  text not null,
  delivery_context       text not null check (delivery_context in ('group_workshop', 'school_organization')),
  organization_id       uuid references public.organizations(id) on delete set null,
  delivery_format       text,
  starts_at             timestamptz,
  session_notes         text,
  status                text not null default 'planning' check (status in ('planning', 'active', 'complete', 'archived')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index youth_programs_guide_idx on public.youth_programs (guide_id);
create index youth_programs_organization_idx on public.youth_programs (organization_id);

alter table public.youth_programs enable row level security;

create policy "youth programs guide own"
  on public.youth_programs for all
  using (guide_id = auth.uid())
  with check (guide_id = auth.uid());

create policy "youth programs admin all"
  on public.youth_programs for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- 3. youth_program_participants -- join table. Reuses guide_participants
--    for the actual person; this table only records that a given
--    participant is registered in a given program, and whether that
--    registration is active or was removed as an erroneous entry.
--    Guardian-consent and Youth-assent status are NOT duplicated here --
--    they're read live from guardian_consents (below), so there is one
--    source of truth for "cleared to participate," never two records
--    that could drift.
-- ---------------------------------------------------------------------------
create table public.youth_program_participants (
  id                    uuid primary key default gen_random_uuid(),
  program_id            uuid not null references public.youth_programs(id) on delete cascade,
  participant_id        uuid not null references public.guide_participants(id) on delete cascade,
  registration_status   text not null default 'registered' check (registration_status in ('registered', 'removed')),
  added_at              timestamptz not null default now(),
  unique (program_id, participant_id)
);

create index youth_program_participants_program_idx on public.youth_program_participants (program_id);
create index youth_program_participants_participant_idx on public.youth_program_participants (participant_id);

alter table public.youth_program_participants enable row level security;

create policy "youth program participants guide own"
  on public.youth_program_participants for all
  using (program_id in (select id from public.youth_programs where guide_id = auth.uid()))
  with check (program_id in (select id from public.youth_programs where guide_id = auth.uid()));

create policy "youth program participants admin all"
  on public.youth_program_participants for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- 4. guardian_consents: stronger verification pathway. The existing
--    'active'/'revoked' statuses and RLS policies (0041) are untouched --
--    this only widens what's possible, it narrows nothing already built.
--    'pending' is a real, enforced state: a participant with only a
--    'pending' consent row is NOT cleared to participate (enforced in
--    application code at session-start, not just in a status label).
-- ---------------------------------------------------------------------------
alter table public.guardian_consents drop constraint if exists guardian_consents_status_check;
alter table public.guardian_consents add constraint guardian_consents_status_check
  check (status in ('pending', 'active', 'revoked'));

alter table public.guardian_consents
  add column if not exists verification_method text not null default 'guide_or_self_attested'
    check (verification_method in ('guide_or_self_attested', 'guardian_link_confirmed'));
alter table public.guardian_consents
  add column if not exists consent_token text unique;
alter table public.guardian_consents
  add column if not exists token_created_at timestamptz;
alter table public.guardian_consents
  add column if not exists confirmed_at timestamptz;
alter table public.guardian_consents
  add column if not exists confirmed_ip text;
-- Youth assent (the Youth Host's own understanding, distinct from
-- guardian consent -- see lib/youth-assent-text.ts) was previously only
-- a checkbox gating the insert, never persisted as its own fact. Recorded
-- here since it belongs to the same registration event as guardian
-- consent, not as a separate table -- one row per registration answers
-- both "did the guardian consent" and "was the Youth Host's own
-- understanding delivered."
alter table public.guardian_consents
  add column if not exists assent_confirmed_at timestamptz;

create index if not exists guardian_consents_token_idx on public.guardian_consents (consent_token);

-- The guardian-facing consent link (/consent/[token]) has no authenticated
-- session -- a guardian never has an AVAIA account. It reads and confirms
-- a pending row via a narrow SECURITY DEFINER function instead of a
-- direct table grant, so an anonymous visitor can complete exactly one
-- action (confirm a specific pending token) and nothing else -- never
-- list other rows, never read a different token's data, never touch an
-- already-active or revoked row.
create or replace function public.get_pending_consent_by_token(p_token text)
returns table (
  id uuid,
  guardian_name text,
  disclosure_text text,
  scope text,
  status text
)
language sql
security definer
set search_path = public
as $$
  select id, guardian_name, disclosure_text, scope, status
  from public.guardian_consents
  where consent_token = p_token and status = 'pending';
$$;

create or replace function public.confirm_pending_consent(p_token text, p_ip text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.guardian_consents
  set status = 'active',
      confirmed_at = now(),
      confirmed_ip = p_ip
  where consent_token = p_token and status = 'pending';
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.get_pending_consent_by_token(text) from public, anon, authenticated;
grant execute on function public.get_pending_consent_by_token(text) to anon, authenticated;
revoke all on function public.confirm_pending_consent(text, text) from public, anon, authenticated;
grant execute on function public.confirm_pending_consent(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. crisis_events: safeguarding infrastructure. The existing automated
--    keyword-backstop insert (lib detectCrisis, app/api/conversation/
--    route.ts) is completely untouched -- these columns are additive and
--    nullable, so every existing row and every existing insert stays
--    valid with no changes. What's new: a Guide can manually log a
--    safeguarding observation that never went through an AI conversation
--    at all (a real possibility in an in-person group/workshop room),
--    tied to the specific participant it concerns.
-- ---------------------------------------------------------------------------
alter table public.crisis_events
  add column if not exists guide_participant_id uuid references public.guide_participants(id) on delete set null;
alter table public.crisis_events
  add column if not exists flagged_by uuid references auth.users(id);
alter table public.crisis_events
  add column if not exists note text;
