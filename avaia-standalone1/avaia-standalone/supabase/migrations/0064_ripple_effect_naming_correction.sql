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
