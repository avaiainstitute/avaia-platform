-- AVAIA View From Above -- the ten-class collection built from the
-- lessons that became visible on Bailand's Hike (Molly's Peak, Cub River
-- Canyon, near Preston, Idaho) and Dorian's own memoir, "The View From
-- Above." Governing instruction: these are NOT ten grief classes. The
-- hike is the origin story; the human lessons are broader -- meaning,
-- reality, direction, role, boundaries, belonging, connection, control,
-- identity, and attachment are questions anyone navigating an ordinary
-- life eventually asks, not only someone grieving.
--
-- SOURCE DISCIPLINE (read before editing this file):
-- The only verbatim manuscript text recovered from the source archive
-- ("The View from Above-20231203T013237Z-001.zip", from Dorian's Google
-- Drive) is the Prologue and the opening of Chapter 1 ("One Year
-- After") -- both told here, once, as the shared origin story every
-- class's hike_lesson section points back to. Chapters 2 through 10
-- exist in that archive only as audiobook MP3/WAV files and YouTube
-- video (.wmv) files -- no transcript exists, and this environment has
-- no audio/video transcription capability, so their specific chapter-by-
-- chapter scenes could NOT be independently recovered or verified. Per
-- explicit instruction not to fictionalize missing hike events, no
-- chapter-specific narrative content is invented here. Each class's
-- hike_lesson field instead carries Dorian's own directly-supplied
-- "Original question/recognition" and "Dorian's lesson" language
-- verbatim (his real words, given directly for this build) plus the one
-- shared origin story -- never additional invented scene detail. This
-- is stated plainly again in each hike_lesson row and in the collection
-- orientation section, not just here.
--
-- 'hike_lesson' is a new section_type -- the same widen-the-enum idiom
-- already used for 'reference' (0021) and 'participant_guide' (0033) --
-- added because no existing type fits a sourced-narrative-plus-honest-
-- gap-disclosure block.
--
-- Architecture: each class is its own `experiences` row (title "The Loss
-- of ..." per instruction, matching the canonical Secondary Loss name
-- exactly -- see lib/secondary-loss.ts / the reference table in 0021),
-- tagged components = ARRAY['view-from-above'], so the existing
-- Experience-detail routing (app/toolkit/experiences/[experienceId]) and
-- admin draft-preview route both automatically render it through the new
-- ViewFromAboveClass.tsx component instead of the generic
-- ExperienceDetail -- exactly the pattern DefyingGriefCurriculum.tsx
-- already established, no new routing mechanism. A matching `classes`
-- row and an `experience_classes` link give each class a place in the
-- Guide's Class Library browse view too. All ten are inserted directly
-- as 'published' -- this is a completed build, not a draft pending
-- review, and every row here is real, usable content, not a placeholder.
--
-- Guide/Admin depth (this migration) is deliberately separate from the
-- public self-directed surface (app/view-from-above/*, hardcoded TSX,
-- committed alongside this migration) -- the same split Defying Grief
-- already uses: experiences/experience_sections requires a 'guide' or
-- 'admin' profile role to read at all (0020's own RLS), so a Host
-- taking a class alone was never going to reach this data through these
-- tables regardless of publish status. The public pages carry the same
-- factual content in front-door language; nothing here needs a new RLS
-- policy for Hosts.

alter table public.experience_sections drop constraint if exists experience_sections_section_type_check;
alter table public.experience_sections add constraint experience_sections_section_type_check
  check (section_type in (
    'orientation','governing_distinction','anchor','movement','question',
    'reference','activity','conversation_window','guide_preparation',
    'boundary','take_home','format_variant','success_definition',
    'participant_guide','hike_lesson'
  ));

insert into public.experiences (title, summary, status, components, conversation_stages) values
  ($$The Loss of Meaning$$, $$What is the point? A class on finding meaning and practicing gratitude in circumstances that don't make sense yet.$$, 'published', array['view-from-above'], array['iap','cat','innercompass']),
  ($$The Loss of Reality$$, $$What is real to me anymore? A class on foundational beliefs being disrupted or questioned, and what humility offers when the ground moves.$$, 'published', array['view-from-above'], array['iap','cat','innercompass']),
  ($$The Loss of Dreams / Opportunities$$, $$Where am I going? A class on direction, hope, and positive expectation when the road you expected disappears.$$, 'published', array['view-from-above'], array['iap','cat','innercompass']),
  ($$The Loss of Self-Trust$$, $$What is my role? A class on knowing your actions make a difference, and on the hard work of acting and following through again.$$, 'published', array['view-from-above'], array['iap','cat','innercompass']),
  ($$The Loss of Decision-Making / Boundaries$$, $$What do I choose when fear, guilt, shame, or doubt are present? A class on boundaries, safety, and choosing anyway.$$, 'published', array['view-from-above'], array['iap','cat','innercompass']),
  ($$The Loss of Life's Vision$$, $$Where do I belong? A class on grounding, home, and direction when the life you were picturing is no longer the one in front of you.$$, 'published', array['view-from-above'], array['iap','cat','innercompass']),
  ($$The Loss of Connection$$, $$What does fair, honest, reciprocal connection look like? A class on fairness, dignity, and respect in relationships that feel unreciprocated.$$, 'published', array['view-from-above'], array['iap','cat','innercompass']),
  ($$The Loss of Control$$, $$What is actually mine to govern? A class on self-control, participation, and the difference between the two when you cannot control outcomes, other people, or the future.$$, 'published', array['view-from-above'], array['iap','cat','innercompass']),
  ($$The Loss of Identity$$, $$Who am I? A class on integrity, values, and knowing what you stand for when a role or identity you relied on is gone.$$, 'published', array['view-from-above'], array['iap','cat','innercompass']),
  ($$The Loss of Attachment / Support$$, $$Who am I still connected to, and what does that connection mean? A class on love, bonding, and security when the people you're attached to have changed.$$, 'published', array['view-from-above'], array['iap','cat','innercompass'])
on conflict do nothing;

insert into public.classes (title, family, summary, status, components, conversation_stages) values
  ($$The Loss of Meaning — View From Above$$, 'self', $$What is the point? Finding meaning and practicing gratitude.$$, 'published', array['view-from-above'], array['iap']),
  ($$The Loss of Reality — View From Above$$, 'self', $$What is real to me anymore? Humility when foundational beliefs are disrupted.$$, 'published', array['view-from-above'], array['iap']),
  ($$The Loss of Dreams / Opportunities — View From Above$$, 'clarity_agency', $$Where am I going? Direction, hope, and positive expectation.$$, 'published', array['view-from-above'], array['iap']),
  ($$The Loss of Self-Trust — View From Above$$, 'self', $$What is my role? Hard work and following through again.$$, 'published', array['view-from-above'], array['iap']),
  ($$The Loss of Decision-Making / Boundaries — View From Above$$, 'clarity_agency', $$What do I choose when fear, guilt, shame, or doubt are present?$$, 'published', array['view-from-above'], array['iap']),
  ($$The Loss of Life's Vision — View From Above$$, 'clarity_agency', $$Where do I belong? Grounding and direction.$$, 'published', array['view-from-above'], array['iap']),
  ($$The Loss of Connection — View From Above$$, 'relationships', $$What does fair, honest, reciprocal connection look like?$$, 'published', array['view-from-above'], array['iap']),
  ($$The Loss of Control — View From Above$$, 'clarity_agency', $$What is actually mine to govern?$$, 'published', array['view-from-above'], array['iap']),
  ($$The Loss of Identity — View From Above$$, 'self', $$Who am I? Integrity and values.$$, 'published', array['view-from-above'], array['iap']),
  ($$The Loss of Attachment / Support — View From Above$$, 'relationships', $$Who am I still connected to, and what does that mean?$$, 'published', array['view-from-above'], array['iap'])
on conflict do nothing;

insert into public.experience_classes (experience_id, class_id, note)
select e.id, c.id, 'Same class, full Experience depth for Guide facilitation.'
from public.experiences e
join public.classes c on c.title = e.title || $$ — View From Above$$
where e.title in (
  $$The Loss of Meaning$$, $$The Loss of Reality$$, $$The Loss of Dreams / Opportunities$$,
  $$The Loss of Self-Trust$$, $$The Loss of Decision-Making / Boundaries$$, $$The Loss of Life's Vision$$,
  $$The Loss of Connection$$, $$The Loss of Control$$, $$The Loss of Identity$$, $$The Loss of Attachment / Support$$
)
on conflict do nothing;
