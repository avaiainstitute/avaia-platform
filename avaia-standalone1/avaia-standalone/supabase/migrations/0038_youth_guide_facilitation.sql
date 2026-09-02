-- AVAIA Youth Defying Grief -- Guide-facilitated program & delivery, Phase 1.
--
-- guide_participants.developmental_band -- the one missing piece of state.
-- A self-serve Youth Host's developmental band lives on profiles
-- (0017_youth_journey.sql), set by the Host themselves at /youth. A
-- Guide-facilitated Youth participant has no profile AVAIA controls (they
-- may not even have an AVAIA account -- see linked_host_id's own nullable,
-- optional shape), so the Guide sets the band on the participant record
-- itself when starting a session, the same way they already set name/email.
-- Nullable and additive: every existing participant reads null (correct --
-- they were never asked), and nothing about adult Guide-facilitated
-- sessions changes. Same three bands profiles.developmental_band already
-- constrains to (0017), so the two columns stay in lockstep without a
-- shared enum type.
alter table public.guide_participants
  add column if not exists developmental_band text
    check (developmental_band in ('8-11', '12-14', '15-17'));
