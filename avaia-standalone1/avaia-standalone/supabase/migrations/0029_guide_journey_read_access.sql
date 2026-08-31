-- Scoped Guide read access to Host-owned Journey content (Phase E.4).
-- Purely additive: four new SELECT-only RLS policies, zero changes to any
-- existing policy on any table. No application write path is added.
--
-- ============================================================================
-- IMPORTANT -- READ ONLY, AND ONLY WHEN ALL THREE CONDITIONS HOLD.
--
-- Every policy below requires all three, re-checked fresh on every query
-- (RLS has no cache -- the instant any one of these becomes false, the
-- next query from that Guide returns nothing):
--   1. an ACTIVE guide_journey_access row for this exact Journey
--      (guide_id = auth.uid(), revoked_at is null)
--   2. an ACTIVE guide_certifications standing for that Guide
--   3. an AUTHORIZED guide_platform_authorizations row for that Guide,
--      specifically capability = 'guided_journey_facilitation' -- Toolkit
--      authorization is never accepted as a substitute here.
-- guide_journey_access existing is never treated as sufficient by itself.
-- Certification alone is never sufficient. Guided Journey Facilitation
-- authorization alone is never sufficient. If a Host later revokes the
-- guide_journey_access row, OR the Guide's certification standing becomes
-- anything other than 'active', OR guided_journey_facilitation
-- authorization becomes anything other than 'authorized', every policy
-- below stops matching immediately -- access does not persist, is not
-- cached, and requires no cleanup. Restoring eligibility while the Host's
-- own invitation remains un-revoked restores access automatically, for
-- the same reason.
--
-- IMPORTANT -- JOURNEY-SCOPED, NEVER HOST-WIDE.
--
-- Each policy resolves the SPECIFIC granted journey_id all the way through
-- the real relationship (conversations.journey_id, then
-- referrals.conversation_id -> that conversation) -- never conversations.
-- host_id or messages.host_id alone, and never "any conversation this
-- Guide has ever touched." A conversation with journey_id is null (data
-- predating the journeys table) can never match any guide_journey_access
-- row and is therefore correctly unreadable by any Guide, with no special
-- case required.
--
-- IMPORTANT -- YOUTH IS EXCLUDED AT THE DATABASE LAYER, NOT ONLY THE UI.
--
-- Every policy below independently checks journeys.program <> 'youth'.
-- Even if a guide_journey_access row somehow existed for a Youth Journey
-- (the Host-facing invitation UI never creates one), these policies would
-- still refuse to expose it.
--
-- IMPORTANT -- EXISTING POLICIES ARE UNTOUCHED.
--
-- These are new, additive SELECT policies alongside the existing
-- "... are self-only" (Host, full CRUD on their own rows) and
-- "... shared read" (shared_access-based Workbook sharing) policies on
-- journeys/conversations/messages/referrals. Postgres OR's all matching
-- permissive policies together for SELECT -- nothing here narrows or
-- replaces what a Host or an existing Workbook-sharing recipient can
-- already do. No INSERT/UPDATE/DELETE policy is added for a Guide on any
-- of these four tables in this migration.
-- ============================================================================

create policy "journeys guide read"
  on public.journeys for select
  using (
    program <> 'youth'
    and exists (
      select 1 from public.guide_journey_access gja
      where gja.journey_id = journeys.id
        and gja.guide_id = auth.uid()
        and gja.revoked_at is null
    )
    and exists (
      select 1 from public.guide_certifications gc
      where gc.host_id = auth.uid() and gc.standing = 'active'
    )
    and exists (
      select 1 from public.guide_platform_authorizations gpa
      where gpa.host_id = auth.uid()
        and gpa.capability = 'guided_journey_facilitation'
        and gpa.status = 'authorized'
    )
  );

create policy "conversations guide read"
  on public.conversations for select
  using (
    conversations.journey_id is not null
    and exists (
      select 1 from public.journeys j
      join public.guide_journey_access gja on gja.journey_id = j.id
      where j.id = conversations.journey_id
        and j.program <> 'youth'
        and gja.guide_id = auth.uid()
        and gja.revoked_at is null
    )
    and exists (
      select 1 from public.guide_certifications gc
      where gc.host_id = auth.uid() and gc.standing = 'active'
    )
    and exists (
      select 1 from public.guide_platform_authorizations gpa
      where gpa.host_id = auth.uid()
        and gpa.capability = 'guided_journey_facilitation'
        and gpa.status = 'authorized'
    )
  );

create policy "messages guide read"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      join public.journeys j on j.id = c.journey_id
      join public.guide_journey_access gja on gja.journey_id = j.id
      where c.id = messages.conversation_id
        and c.journey_id is not null
        and j.program <> 'youth'
        and gja.guide_id = auth.uid()
        and gja.revoked_at is null
    )
    and exists (
      select 1 from public.guide_certifications gc
      where gc.host_id = auth.uid() and gc.standing = 'active'
    )
    and exists (
      select 1 from public.guide_platform_authorizations gpa
      where gpa.host_id = auth.uid()
        and gpa.capability = 'guided_journey_facilitation'
        and gpa.status = 'authorized'
    )
  );

create policy "referrals guide read"
  on public.referrals for select
  using (
    exists (
      select 1 from public.conversations c
      join public.journeys j on j.id = c.journey_id
      join public.guide_journey_access gja on gja.journey_id = j.id
      where c.id = referrals.conversation_id
        and c.journey_id is not null
        and j.program <> 'youth'
        and gja.guide_id = auth.uid()
        and gja.revoked_at is null
    )
    and exists (
      select 1 from public.guide_certifications gc
      where gc.host_id = auth.uid() and gc.standing = 'active'
    )
    and exists (
      select 1 from public.guide_platform_authorizations gpa
      where gpa.host_id = auth.uid()
        and gpa.capability = 'guided_journey_facilitation'
        and gpa.status = 'authorized'
    )
  );
