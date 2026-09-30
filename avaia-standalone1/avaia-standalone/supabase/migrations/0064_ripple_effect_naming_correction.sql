-- NUMBERING NOTE (documentation only, no executable effect): two migrations
-- were independently given the prefix 0064 -- this file and
-- 0064_operational_reminder_tracking.sql. Both are already applied in
-- production. Neither is renamed here: this repo has no Supabase-CLI-tracked
-- migration history (no supabase/config.toml, no CLI migration table in
-- use, migrations are applied by hand in the SQL Editor), so a rename
-- carries no known functional risk, but nothing confirms the live project
-- has never used CLI tracking either, so renaming an already-applied file
-- is avoided rather than assumed safe. Filenames are left exactly as they
-- are; this note is the record of the collision. Numbers stay purely
-- git-history bookkeeping here, not a uniqueness guarantee, and
-- Postgres/Supabase applies files in filename-sort order regardless, so
-- the collision has no bearing on what was actually run or in what order.
--
-- Cleanup Pass directive -- item 2 (Defying Grief: The Ripple Effect).
--
-- Dorian's exact decision: the name is "The Ripple Effect." It is a useful
-- Defying Grief structure, but it is NOT the Signature Metaphor and never
-- has been -- the Experience's actual Anchor ("We don't move on, we move
-- with," seeded alongside this same row in migration 0021) already holds
-- that role. This migration corrects only the mislabeling; it does not
-- touch the underlying "stone enters still water" teaching content, which
-- stays exactly as originally written.
--
-- Exact-match only, fail-loud, returns the row it touched.

update public.experience_sections es
set title = $$The Ripple Effect$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id
  and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'orientation'
  and es.position = 2
  and es.title = $$The Signature Metaphor, The Ripple$$
returning es.id, es.section_type, es.position, es.title, es.updated_at;
