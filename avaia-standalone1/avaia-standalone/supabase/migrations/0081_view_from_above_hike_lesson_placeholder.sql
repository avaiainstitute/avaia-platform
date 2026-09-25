-- View From Above, hike_lesson accuracy fix.
--
-- Migrations 0056 and 0057 seeded each of the ten classes' "The Hike
-- Lesson" section with a source note claiming that only the Prologue
-- and the opening of Chapter 1 of the memoir had been "recovered," and
-- that the rest existed only as untranscribed audio and video. That
-- claim was inaccurate: no such recordings are waiting to be
-- transcribed, and the ten hike-lesson narratives have not been written
-- yet. This replaces only the inaccurate source-note portion of each
-- class's hike_lesson section with an honest placeholder line, and
-- leaves the "Original recognition" and "Dorian's lesson" quotes that
-- follow it exactly as they were. It writes no hike-lesson content.
--
-- 0056/0057 are left as they were (they are already applied). The guard
-- on the existing text makes this safe to run more than once: a row
-- already starting with the placeholder is skipped.

update public.experience_sections s
set body = 'The Hike Lesson for this class has not been written yet. '
           || substring(s.body from position('Original recognition:' in s.body)),
    updated_at = now()
from public.experiences e
where s.experience_id = e.id
  and e.components @> array['view-from-above']
  and s.section_type = 'hike_lesson'
  and position('Original recognition:' in s.body) > 0
  and s.body not like 'The Hike Lesson for this class has not been written yet.%'
returning e.title, left(s.body, 90) as new_body_start;
