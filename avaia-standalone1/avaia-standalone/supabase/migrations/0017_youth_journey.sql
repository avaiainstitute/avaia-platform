-- AVAIA Youth Journey — Phase 1: schema only.
--
-- Phase 1 is an internal, non-public build of the Youth conversational
-- path (IAP -> CAT -> InnerCompass) using the existing Journey engine,
-- validated under a controlled test account provisioned directly via SQL
-- -- not through any public route. No consent/assent, guardian, payment,
-- or Guide-support work is part of this pass; see the Youth Journey plan
-- for what's deferred and why.
--
-- 'youth' joins the existing program value set on journeys/conversations,
-- exactly the same mechanism defying-grief already uses (0003/0006) --
-- no new column shape, just one more allowed value. guide_sessions.program
-- (0012) is deliberately left untouched here: Guide-supported Youth is a
-- later phase, and no guide_sessions row will carry program='youth' until
-- then.
alter table public.journeys
  drop constraint if exists journeys_program_check;
alter table public.journeys
  add constraint journeys_program_check
    check (program in ('general', 'defying-grief', 'youth'));

alter table public.conversations
  drop constraint if exists conversations_program_check;
alter table public.conversations
  add constraint conversations_program_check
    check (program in ('general', 'defying-grief', 'youth'));

-- Developmental band -- the smallest signal that can select Youth's
-- starting conversational guidance (each Youth instruction document
-- already contains all three bands; this only says which one to start
-- from -- the Guide still adapts to the individual Host from there).
-- Deliberately not a date of birth: no legal/technical reason has been
-- identified yet that requires collecting more than this self-reported
-- band, and collecting less than necessary is the explicit preference
-- for this phase. Nullable -- every existing profile (every adult Host)
-- is unaffected and this column means nothing for them.
alter table public.profiles
  add column if not exists developmental_band text
    check (developmental_band in ('8-11', '12-14', '15-17'));
