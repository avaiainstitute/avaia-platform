-- View From Above -- Guide delivery gap close. Found during this task's
-- own required verification step: the ten classes were readable as
-- Toolkit curriculum reference (ViewFromAboveClass.tsx), the same as
-- Defying Grief's Master Curriculum -- but unlike Defying Grief, there
-- was no Guide-facing "start a session" tool threading a specific class
-- into an actual private AVAIA conversation. A Guide could read the
-- shared teaching but had no way to open a real, class-anchored session
-- for a participant. This migration + the accompanying app code close
-- that gap the same way Defying Grief already closed it: widen the
-- existing program enum, reuse the existing IAP/CAT/InnerCompass tools
-- unchanged.

alter table public.guide_sessions
  drop constraint if exists guide_sessions_program_check;
alter table public.guide_sessions
  add constraint guide_sessions_program_check
    check (program in ('general', 'defying-grief', 'youth', 'view-from-above'));

-- Which of the ten classes this session is anchored to (a
-- lib/view-from-above.ts slug, e.g. 'control') -- display/continuity
-- only (Preparation, Guide's Record), never read by the engine itself.
-- Null for every program other than 'view-from-above'.
alter table public.guide_sessions
  add column if not exists class_context text;

alter table public.journeys
  drop constraint if exists journeys_program_check;
alter table public.journeys
  add constraint journeys_program_check
    check (program in ('general', 'defying-grief', 'youth', 'view-from-above'));

alter table public.conversations
  drop constraint if exists conversations_program_check;
alter table public.conversations
  add constraint conversations_program_check
    check (program in ('general', 'defying-grief', 'youth', 'view-from-above'));
