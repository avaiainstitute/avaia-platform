-- Youth Program identity, separate from developmental band. Found during
-- the Program/Toolkit architecture reconciliation: youthSystemPromptFor
-- (lib/engine/prompts.ts) unconditionally injected Defying Grief's own
-- Stone-and-Ripples/Audacity framing into every Youth conversation, because
-- it was written when Defying Grief was the only Youth Program. Now that
-- The View From Above also has a Youth entry point, the engine needs to
-- know which established Program a given "youth" conversation belongs to,
-- as information separate from developmental band (band: how to speak to
-- this age; youth_program: which curriculum's framing applies).
--
-- Deliberately additive, not a replacement for the existing `program`
-- column: `program` stays 'youth' everywhere it already is, unchanged, so
-- every existing consent/safety/deletion check that keys off
-- program = 'youth' is completely unaffected. `youth_program` is nullable
-- and meaningful only when program = 'youth'; null means "no established
-- Program identified" (a self-serve /youth Journey, or a historical row
-- predating this column), which the engine treats as Defying Grief's own
-- framing, exactly the behavior every existing Youth conversation already
-- had before this migration, see youthSystemPromptFor's own comment for
-- why that default was chosen (preserving existing behavior, not a new
-- decision).
alter table public.journeys
  add column if not exists youth_program text
    check (youth_program in ('defying-grief', 'view-from-above'));

alter table public.conversations
  add column if not exists youth_program text
    check (youth_program in ('defying-grief', 'view-from-above'));

alter table public.guide_sessions
  add column if not exists youth_program text
    check (youth_program in ('defying-grief', 'view-from-above'));
