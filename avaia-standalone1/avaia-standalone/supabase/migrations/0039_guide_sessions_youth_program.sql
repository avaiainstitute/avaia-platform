-- AVAIA Youth Defying Grief -- Guide-facilitated program & delivery, Phase 1
-- (continued). guide_sessions.program's check constraint (0012_guide_
-- toolkit_expansion.sql) was deliberately left at ('general',
-- 'defying-grief') -- that migration's own comment says so explicitly:
-- "Guide-supported Youth is a later phase, and no guide_sessions row will
-- carry program='youth' until then." journeys.program and
-- conversations.program were both already widened for 'youth' in
-- 0017_youth_journey.sql; guide_sessions.program is the one place that
-- widening was never carried through, because nothing needed it until this
-- build. That "later phase" is now -- app/toolkit/youth-defying-grief/
-- page.tsx inserts a guide_sessions row with program: 'youth'.
--
-- The inline column check from 0012 has no explicit name, so Postgres
-- auto-named it guide_sessions_program_check (confirmed live via the
-- actual constraint-violation error) -- drop that by its real name, then
-- re-add it with 'youth' included, the same drop/re-add shape 0017 already
-- used for journeys/conversations.
alter table public.guide_sessions
  drop constraint if exists guide_sessions_program_check;
alter table public.guide_sessions
  add constraint guide_sessions_program_check
    check (program in ('general', 'defying-grief', 'youth'));
