-- AVAIA Youth Defying Grief -- Guardian Consent + Youth Privacy & Agency
-- (governing decision). Builds the one piece of institutional record-keeping
-- that decision requires and nothing this codebase already had: a real,
-- auditable guardian consent event, kept structurally separate from content
-- access. Governing model: "The guardian gives permission for
-- participation. The Youth Host retains ownership of their story and
-- agency over what they choose to share." This table only ever records
-- the first sentence -- it has no relationship whatsoever to RLS on
-- conversations, messages, referrals, or recognitions, which already
-- belong solely to the Host (or the Guide's own guide_sessions ownership)
-- and are entirely untouched by this migration.
--
-- Two delivery contexts produce a consent record:
-- 1. Self-serve: a minor Host, at /welcome, now supplies real guardian
--    contact info alongside the existing self-attestation checkbox
--    (previously the checkbox alone set profiles.minor_with_guardian with
--    no record of who the guardian actually is). youth_host_id is set.
-- 2. Guide-facilitated (individual or group/workshop): the Guide records
--    consent when starting a session, the same place they already set a
--    developmental band. guide_participant_id is set.
--
-- Exactly one of the two is ever set -- a consent record always belongs
-- to exactly one subject, never both, never neither.
create table public.guardian_consents (
  id                       uuid primary key default gen_random_uuid(),
  youth_host_id            uuid references public.profiles(id) on delete cascade,
  guide_participant_id     uuid references public.guide_participants(id) on delete cascade,
  scope                    text not null check (scope in ('individual', 'group_workshop', 'school_organization')),
  guardian_name            text not null,
  guardian_email           text not null,
  relationship             text,
  sponsoring_organization  text,
  -- A snapshot of exactly what the guardian was shown, not a reference to
  -- whatever the current copy happens to say -- so a later wording change
  -- can never silently rewrite what a past guardian actually consented to.
  disclosure_text          text not null,
  recorded_by              uuid references auth.users(id),
  consented_at             timestamptz not null default now(),
  status                   text not null default 'active' check (status in ('active', 'revoked')),
  revoked_at               timestamptz,
  created_at               timestamptz not null default now(),
  constraint guardian_consents_exactly_one_subject check (
    (youth_host_id is not null and guide_participant_id is null) or
    (youth_host_id is null and guide_participant_id is not null)
  )
);

create index guardian_consents_youth_host_idx on public.guardian_consents (youth_host_id);
create index guardian_consents_guide_participant_idx on public.guardian_consents (guide_participant_id);

alter table public.guardian_consents enable row level security;

-- A self-serve Youth Host can read their own consent record -- never
-- another Host's, never a Guide-facilitated participant's.
create policy "guardian consents own read"
  on public.guardian_consents for select
  using (youth_host_id = auth.uid());

-- A self-serve Host records their own guardian's consent at /welcome, the
-- same request that already sets profiles.minor_with_guardian.
create policy "guardian consents own insert"
  on public.guardian_consents for insert
  with check (youth_host_id = auth.uid() and recorded_by = auth.uid());

-- A self-serve Host may later revoke -- e.g. turning 18, or their guardian
-- withdrawing permission -- but never rewrite who the guardian was or what
-- was disclosed. Application code only ever sends {status, revoked_at}
-- from the revoke action; RLS itself only guards which rows, not which
-- columns, matching the same trust boundary every other owner-write policy
-- in this schema already relies on.
create policy "guardian consents own revoke"
  on public.guardian_consents for update
  using (youth_host_id = auth.uid())
  with check (youth_host_id = auth.uid());

-- A Guide reads and records consent only for their own participants --
-- never another Guide's, and never a self-serve Host's own record (that
-- row has no guide_participant_id for any Guide to match against).
create policy "guardian consents guide read"
  on public.guardian_consents for select
  using (
    guide_participant_id in (select id from public.guide_participants where guide_id = auth.uid())
  );

create policy "guardian consents guide insert"
  on public.guardian_consents for insert
  with check (
    recorded_by = auth.uid()
    and guide_participant_id in (select id from public.guide_participants where guide_id = auth.uid())
  );

create policy "guardian consents guide revoke"
  on public.guardian_consents for update
  using (guide_participant_id in (select id from public.guide_participants where guide_id = auth.uid()))
  with check (guide_participant_id in (select id from public.guide_participants where guide_id = auth.uid()));

create policy "guardian consents admin all"
  on public.guardian_consents for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
