-- Final Correction Directive -- items 2 and 5.
--
-- Corrective, not historical rewrite: migration 0030 changed the Secondary
-- Loss name "Life's Vision" to "Life Vision" to match lib/institution.ts's
-- SECONDARY_LOSSES array, which was, at the time, treated as the live
-- canonical source. A supplied source-reconciliation packet (the Defying
-- Grief book, which repeats "Loss of Life's Vision" throughout, and the
-- official "What Becomes Visible: Clarity and Agency" visual asset) has
-- since shown lib/institution.ts's "Life Vision" was itself the error --
-- Dorian's own material consistently spells this loss "Life's Vision",
-- exactly as lib/view-from-above.ts and lib/toolkit.ts (built later,
-- independently of lib/institution.ts) already had it. This migration does
-- not touch 0030 itself; it corrects the live data 0030 changed, in the
-- opposite direction, under the same exact-match discipline.
--
-- Scope, exact and fail-loud only:
-- 1. The one experience_sections "reference" row 0030 modified (reverses
--    it precisely).
-- 2. Live public.referrals.content secondary-loss category values
--    (secondaryLossesIdentified / significantSecondaryLosses) that may have
--    been generated with the old "Life Vision" spelling while it was
--    canonical -- both array shapes in current use (a plain string entry,
--    or a {category, description} object entry) are covered, so a real
--    Host's already-completed referral does not silently stop matching the
--    corrected canonical array (lib/institution.ts's SECONDARY_LOSSES;
--    lib/library-retrieval.ts and lib/engine/referral-provenance.ts both do
--    live case-insensitive exact-match against it).
-- 3. The Signature Question correction (directive item 5): "What else
--    changed when this changed?" was seeded in migration 0021 as the sole
--    'question' section (UI label "Signature Question," see
--    lib/experience-sections.ts's SECTION_TYPE_LABEL) for this Experience.
--    It has no source backing as a Signature Question -- Dorian's own book
--    instead repeats "Why did that hurt?" / "Why does it hurt?" once per
--    Secondary Loss chapter, and titles Chapter 3 "The 'Why Behind Our
--    Pain.'" "What else changed when this changed?" already exists in its
--    own right as this Experience's activity #2 (also seeded in 0021) -- a
--    Secondary-Loss / ripple-recognition question, which is where it
--    belongs. This statement only removes the old body's Signature
--    Question authority; it does not touch the activity row.
--
-- Every statement below returns the rows it touched -- never silent.

-- ---------------------------------------------------------------------------
-- 1. "The Ten Secondary Losses" reference row.
-- ---------------------------------------------------------------------------
update public.experience_sections es
set body = replace(body, $$Life Vision$$, $$Life's Vision$$),
    updated_at = now()
from public.experiences e
where es.experience_id = e.id
  and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'reference'
  and es.body like $$%Life Vision%$$
  and es.body not like $$%Life's Vision%$$
returning es.id, es.section_type, es.title, es.updated_at;

-- ---------------------------------------------------------------------------
-- 2a. Live referrals.content -- secondaryLossesIdentified.
-- ---------------------------------------------------------------------------
update public.referrals
set content = jsonb_set(
  content,
  '{secondaryLossesIdentified}',
  (
    select jsonb_agg(
      case
        when elem = to_jsonb($$Life Vision$$::text) then to_jsonb($$Life's Vision$$::text)
        when jsonb_typeof(elem) = 'object' and elem->>'category' = $$Life Vision$$
          then elem || jsonb_build_object('category', $$Life's Vision$$)
        else elem
      end
    )
    from jsonb_array_elements(content->'secondaryLossesIdentified') elem
  )
)
where jsonb_typeof(content->'secondaryLossesIdentified') = 'array'
  and exists (
    select 1 from jsonb_array_elements(content->'secondaryLossesIdentified') e
    where e = to_jsonb($$Life Vision$$::text)
       or (jsonb_typeof(e) = 'object' and e->>'category' = $$Life Vision$$)
  )
returning id, host_id, conversation_id;

-- ---------------------------------------------------------------------------
-- 2b. Live referrals.content -- significantSecondaryLosses (same two shapes).
-- ---------------------------------------------------------------------------
update public.referrals
set content = jsonb_set(
  content,
  '{significantSecondaryLosses}',
  (
    select jsonb_agg(
      case
        when elem = to_jsonb($$Life Vision$$::text) then to_jsonb($$Life's Vision$$::text)
        when jsonb_typeof(elem) = 'object' and elem->>'category' = $$Life Vision$$
          then elem || jsonb_build_object('category', $$Life's Vision$$)
        else elem
      end
    )
    from jsonb_array_elements(content->'significantSecondaryLosses') elem
  )
)
where jsonb_typeof(content->'significantSecondaryLosses') = 'array'
  and exists (
    select 1 from jsonb_array_elements(content->'significantSecondaryLosses') e
    where e = to_jsonb($$Life Vision$$::text)
       or (jsonb_typeof(e) = 'object' and e->>'category' = $$Life Vision$$)
  )
returning id, host_id, conversation_id;

-- ---------------------------------------------------------------------------
-- 3. Signature Question correction.
-- ---------------------------------------------------------------------------
update public.experience_sections es
set body = $$Why does it hurt?$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id
  and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'question'
  and es.position = 1
  and es.body = $$What else changed when this changed?$$
returning es.id, es.section_type, es.title, es.body, es.updated_at;
