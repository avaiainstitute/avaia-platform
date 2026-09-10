-- Site-wide em dash cleanup -- the one live database row still carrying an
-- em dash. This is the "Ten Secondary Losses" reference row for "The
-- Things We Lose After the Loss" (seeded in 0021, corrected for spelling in
-- 0030/0063, never touched by the 0033 module restructuring since that
-- migration only ever rewrote `movement` sections, not `reference` ones).
-- Its Control entry reads "...I cannot control--or begin trying harder to
-- control it?" with an unspaced em dash between "control" and "or". Exact
-- substring replace, scoped to this one row, no other wording touched.

update public.experience_sections es
set body = replace(body, $$control—or$$, $$control, or$$),
    updated_at = now()
from public.experiences e
where es.experience_id = e.id
  and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'reference'
  and es.position = 1
  and es.body like $$%control—or%$$
returning es.id, es.section_type, es.position, es.updated_at;
