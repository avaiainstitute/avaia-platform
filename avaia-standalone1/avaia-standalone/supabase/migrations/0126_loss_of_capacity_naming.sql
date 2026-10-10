-- 0126: the Secondary Loss formerly named "Decision-Making / Boundaries" is named "Loss of Capacity".
--
-- Founder decision (hospice capability audit; taught in certification lesson 5.5, "Loss of Capacity"): the stored, human-readable name is the
-- full "Loss of Capacity" (never the bare "Capacity", which also names the capacity principle and a Chemistry element). The thread is unchanged:
-- same Grief Myth, same virtue family (Fortitude), same Life Lesson. The application treats "Loss of Capacity" as canonical and still ACCEPTS the
-- retired "Decision-Making / Boundaries" when reading stored data (lib/institution.ts, canonicalSecondaryLoss), so this migration tidies stored data
-- and is not a condition for anything to keep working. Re-running it is harmless.
--
-- Same discipline as 0063 (Life's Vision): exact matches only, every statement RETURNS the rows it touched, nothing is silent, and no historical
-- migration file is edited. Scope:
--   1. the View From Above class 5 Experience and Class: titles and summaries (linked by id, so no link breaks);
--   2. the other View From Above sections that name class 5 in their own text, and class 6's closing segment, which assumed the old concept;
--   3. the body of class 5 itself, rewritten to teach Loss of Capacity from lesson 5.5 (same section types, positions and titles; the Hike
--      Lesson, Anchor, Dorian's account and the Fortitude element list are Founder-authored and left exactly as they were);
--   4. the Defying Grief stored text that lists the old name (the pilot "Ten Secondary Losses" reference row and Module 4 of the adult and Youth
--      curricula);
--   5. stored referral categories (secondaryLossesIdentified / significantSecondaryLosses), both shapes, both spellings of the old name,
--      plus the bare "Capacity" that briefly existed in code;
--   6. Library entry tags (library_entries.secondary_losses), the same three spellings.

-- 1a. View From Above class 5, the Experience.
update public.experiences
set title = $$The Loss of Capacity$$,
    summary = $$Do I still feel able to carry what I once could? A class on a change in your felt sense of your own ability to carry, handle, or do what you once could, and the Fortitude to stay steady with it.$$,
    updated_at = now()
where title = $$The Loss of Decision-Making / Boundaries$$
returning id, title, status, updated_at;

-- 1b. View From Above class 5, the Class.
update public.classes
set title = $$The Loss of Capacity, View From Above$$,
    summary = $$Do I still feel able to carry what I once could? A change in felt capacity, and Fortitude.$$,
    updated_at = now()
where title = $$The Loss of Decision-Making / Boundaries, View From Above$$
returning id, title, status, updated_at;

-- 2a. Other View From Above sections that name class 5 in their own text.
update public.experience_sections es
set body = replace(es.body, $$The Loss of Decision-Making / Boundaries$$, $$The Loss of Capacity$$), updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.components @> array['view-from-above']
  and es.body like $$%The Loss of Decision-Making / Boundaries%$$
returning es.id, es.section_type, es.title, es.updated_at;

update public.experience_sections es
set title = replace(es.title, $$The Loss of Decision-Making / Boundaries$$, $$The Loss of Capacity$$), updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.components @> array['view-from-above']
  and es.title like $$%The Loss of Decision-Making / Boundaries%$$
returning es.id, es.section_type, es.title, es.updated_at;

-- 2b. Class 6's closing segment followed class 5 with the old idea ("once a person can choose safely inside boundaries").
update public.experience_sections es
set body = replace(es.body,
      $$once a person can choose safely inside boundaries, this class asks where those choices are actually leading, toward what kind of belonging.$$,
      $$once a person has named what they feel able to carry now, this class asks where that is actually leading, toward what kind of belonging.$$),
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.components @> array['view-from-above']
  and es.body like $$%once a person can choose safely inside boundaries, this class asks where those choices are actually leading%$$
returning es.id, es.section_type, es.title, es.updated_at;

-- 3. Class 5 body. Matched by experience, section type and position; titles are not touched.
update public.experience_sections es
set body = v.body, updated_at = now()
from public.experiences e,
(values
  ('orientation', 1, $$A class about the quiet change in your felt sense of your own ability to carry, handle, or do what you once could, and about the Fortitude it takes to stay steady with that change.$$),
  ('orientation', 2, $$This class helps someone notice a possible Loss of Capacity: grief about a change in their own felt capacity over time. It is a real loss worth staying curious about, not a verdict on who they are or on what they will always be able to do. Fortitude is carrying what can be carried, at a real pace, inside boundaries that protect it.$$),
  ('question', 1, $$Do I still feel able to carry what I once could, and what has changed?$$),
  ('reference', 1, $$Fortitude's canonical elements: Courage, Magnanimity, Steadfast, Resilience, Assertive, Confidence, Fearlessness, Independent, Bravery, Valor. Every person already carries this family, including when carrying feels harder than it used to. This class asks which elements have already helped someone keep going, not by restoring what was lost first; Steadfast, Resilience, and Courage often surface first.$$),
  ('reference', 2, $$Dorian's own account, told in full on the collection page, describes the fear and doubt present in even deciding to drive back up that canyon road, and the courage of going anyway, in the presence of that fear rather than after it disappeared. Beyond that recovered material, a presenter may use other real examples of carrying on through a changed capacity, such as returning to a demanding task after illness or a long loss, clearly marked as illustrative, separate from Dorian's own story.$$),
  ('movement', 1, $$Movement: Understanding into Agency. Purpose: help a person name, in their own words, a change in what they feel able to carry, handle, or do, and keep that felt change separate from any conclusion about their actual or permanent ability. Core idea: a felt loss of capacity is worth naming and staying curious about; it is not a diagnosis, and it is not the present-moment capacity reading taught in Module 4, which sits alongside it but is not the same thing. Facilitator teaching: Host language that may point toward this loss includes feeling unable to manage what used to be managed easily, feeling depleted in a way that feels different from ordinary tiredness, or grieving a version of oneself who could handle anything. Offer these as possibilities, never as a declaration. Key distinction: Fortitude here is not pushing through regardless of cost; it includes setting boundaries and giving oneself permission to go at a pace that can be carried. Shared-room experience: the presenter names, once, that anyone in the room may have felt this, and that naming what feels different stays private.$$),
  ('guide_preparation', 1, $$Open by describing Loss of Capacity as a change in a person's felt sense of their own ability to carry, handle, or do what they once could. Distinguish it from Module 4's present-moment capacity concept, which this loss sits alongside but is not identical to: this class concerns grief about a change over time, not a single session's reading. Recognition, not declaration: never tell a participant they have this loss. It can overlap with, or be masked by, other Secondary Losses, so hold every recognition as tentative. Never conclude that a change in felt capacity is a permanent change in actual ability; only that the person is naming a felt loss worth staying curious about. Do not treat hesitation, slowness, or limits as weakness.$$),
  ('participant_guide', 1, $$This page is yours. SOMETHING I USED TO CARRY EASILY: Name it, even loosely. WHAT FEELS DIFFERENT NOW: Heavier, slower, or more tiring than ordinary tiredness? A BOUNDARY OR PERMISSION THAT WOULD HELP: What limit, or what permission to go slower, would make this more bearable? WHAT I CAN STILL CARRY: Something real, sized to what feels possible right now.$$),
  ('activity', 1, $$Offer the Fortitude elements and ask which one has already helped the participant keep going through something hard, even at a smaller scale than before. Courage, Steadfast, and Resilience often surface here. None is required.$$),
  ('activity', 2, $$This week, name one thing you used to carry more easily, notice what feels different about carrying it now, and give yourself permission to set one limit or one slower pace around it.$$),
  ('conversation_window', 1, $$Individual Awareness Profile. Saying, in your own words, what feels harder to carry or handle than it used to.$$),
  ('conversation_window', 2, $$Conversations Across Time. Following how your sense of what you can carry has changed over time, and what has helped you before.$$),
  ('conversation_window', 3, $$InnerCompass. Choosing, within what you can carry now, what you actually want to do.$$),
  ('take_home', 1, $$SOMETHING I USED TO CARRY EASILY, WHAT FEELS DIFFERENT NOW, A BOUNDARY OR PERMISSION THAT WOULD HELP, WHAT I CAN STILL CARRY, ONE PRACTICE I WANT TO TRY THIS WEEK.$$),
  ('success_definition', 1, $$Not a promise that earlier capacity returns. What can become possible is naming the change plainly, carrying what can be carried with permission to go at a real pace, and setting limits that protect it.$$),
  ('boundary', 1, $$In a Shared Room, this class can be taught to the whole Table; naming what feels different stays private. Guide boundaries: never diagnose or declare that a participant has this loss; never conclude that a felt change is a permanent change in ability; never pressure a particular limit or pace onto anyone.$$),
  ('format_variant', 1, $$Self-directed: read the orientation and Virtue Family reference, complete the Personal Recognition page. Guide-facilitated: teach the felt-capacity distinction and offer the Fortitude recognition activity; no private conversation required.$$),
  ('format_variant', 3, $$Smaller tables discuss what it means to carry something at a different pace than before, using a shared hypothetical situation, before individual private reflection on a real one.$$),
  ('format_variant', 4, $$Youth-adapted language: "is there something that used to feel easy that feels harder now?" framed around age-appropriate situations (schoolwork, friendships, energy). Same guardian-consent and Youth-assent requirements as every other AVAIA Youth offering before any private conversation.$$),
  ('format_variant', 5, $$As a segment following The Loss of Self-Trust: once a person can act and follow through again, this class asks what they feel able to carry now and how to carry it at a real pace, with real limits.$$)
) as v(section_type, position, body)
where es.experience_id = e.id
  and e.title in ($$The Loss of Capacity$$, $$The Loss of Decision-Making / Boundaries$$)
  and es.section_type = v.section_type and es.position = v.position
returning es.id, es.section_type, es.position, es.title;

-- 4a. Defying Grief stored text: the pilot "The Ten Secondary Losses" reference row.
update public.experience_sections
set body = replace(body,
      $$Decision-Making / Boundaries — Did choices, limits, responsibility, or saying yes/no become harder?$$,
      $$Loss of Capacity — Did my sense of my own ability to carry, handle, or do what I once could change?$$),
    updated_at = now()
where body like $$%Decision-Making / Boundaries — Did choices, limits, responsibility, or saying yes/no become harder?%$$
returning id, section_type, title, updated_at;

-- 4b. Defying Grief Module 4 (adult and Youth) lists the ten categories by name.
update public.experience_sections
set body = replace(body, $$self-trust, decision-making or boundaries, life vision$$, $$self-trust, loss of capacity, life vision$$),
    updated_at = now()
where body like $$%self-trust, decision-making or boundaries, life vision%$$
returning id, section_type, title, updated_at;

-- 5a. Stored referrals, secondaryLossesIdentified (a plain string entry, or a {category, description} object entry).
update public.referrals
set content = jsonb_set(
  content,
  '{secondaryLossesIdentified}',
  (
    select jsonb_agg(
      case
        when jsonb_typeof(elem) = 'string' and lower(elem #>> '{}') in ('decision-making / boundaries', 'decision-making/boundaries', 'capacity')
          then to_jsonb($$Loss of Capacity$$::text)
        when jsonb_typeof(elem) = 'object' and lower(elem->>'category') in ('decision-making / boundaries', 'decision-making/boundaries', 'capacity')
          then elem || jsonb_build_object('category', $$Loss of Capacity$$)
        else elem
      end
    )
    from jsonb_array_elements(content->'secondaryLossesIdentified') elem
  )
)
where jsonb_typeof(content->'secondaryLossesIdentified') = 'array'
  and exists (
    select 1 from jsonb_array_elements(content->'secondaryLossesIdentified') e
    where (jsonb_typeof(e) = 'string' and lower(e #>> '{}') in ('decision-making / boundaries', 'decision-making/boundaries', 'capacity'))
       or (jsonb_typeof(e) = 'object' and lower(e->>'category') in ('decision-making / boundaries', 'decision-making/boundaries', 'capacity'))
  )
returning id, host_id, conversation_id;

-- 5b. Stored referrals, significantSecondaryLosses (same two shapes).
update public.referrals
set content = jsonb_set(
  content,
  '{significantSecondaryLosses}',
  (
    select jsonb_agg(
      case
        when jsonb_typeof(elem) = 'string' and lower(elem #>> '{}') in ('decision-making / boundaries', 'decision-making/boundaries', 'capacity')
          then to_jsonb($$Loss of Capacity$$::text)
        when jsonb_typeof(elem) = 'object' and lower(elem->>'category') in ('decision-making / boundaries', 'decision-making/boundaries', 'capacity')
          then elem || jsonb_build_object('category', $$Loss of Capacity$$)
        else elem
      end
    )
    from jsonb_array_elements(content->'significantSecondaryLosses') elem
  )
)
where jsonb_typeof(content->'significantSecondaryLosses') = 'array'
  and exists (
    select 1 from jsonb_array_elements(content->'significantSecondaryLosses') e
    where (jsonb_typeof(e) = 'string' and lower(e #>> '{}') in ('decision-making / boundaries', 'decision-making/boundaries', 'capacity'))
       or (jsonb_typeof(e) = 'object' and lower(e->>'category') in ('decision-making / boundaries', 'decision-making/boundaries', 'capacity'))
  )
returning id, host_id, conversation_id;

-- 6. Library entry tags.
update public.library_entries
set secondary_losses = array_replace(array_replace(array_replace(secondary_losses, $$Decision-Making / Boundaries$$, $$Loss of Capacity$$), $$Decision-Making/Boundaries$$, $$Loss of Capacity$$), $$Capacity$$, $$Loss of Capacity$$),
    updated_at = now()
where secondary_losses && array[$$Decision-Making / Boundaries$$, $$Decision-Making/Boundaries$$, $$Capacity$$]
returning id, title, secondary_losses;

-- Verification (read-only, self-labelling). Every _expect_0 should be 0 and every _expect_1 should be 1 after the migration has run.
select
  (select count(*) from public.experiences where title = $$The Loss of Decision-Making / Boundaries$$)                                       as experiences_with_old_title_expect_0,
  (select count(*) from public.classes where title = $$The Loss of Decision-Making / Boundaries, View From Above$$)                           as classes_with_old_title_expect_0,
  (select count(*) from public.experiences where title = $$The Loss of Capacity$$)                                                            as experiences_with_new_title_expect_1,
  (select count(*) from public.classes where title = $$The Loss of Capacity, View From Above$$)                                               as classes_with_new_title_expect_1,
  (select count(*) from public.experience_sections where body ilike $$%Decision-Making / Boundaries%$$ or body ilike $$%decision-making or boundaries%$$) as sections_with_old_name_expect_0,
  (select count(*) from public.experience_sections es join public.experiences e on e.id = es.experience_id
     where e.title = $$The Loss of Capacity$$ and es.section_type <> 'hike_lesson' and es.body ilike $$%fear, guilt, shame%$$)               as class5_old_concept_in_body_expect_0,
  (select count(*) from public.referrals r
     where exists (
       select 1 from jsonb_array_elements(case when jsonb_typeof(r.content->'secondaryLossesIdentified') = 'array' then r.content->'secondaryLossesIdentified' else '[]'::jsonb end) e
       where lower(case when jsonb_typeof(e) = 'object' then e->>'category' else e #>> '{}' end) in ('decision-making / boundaries', 'decision-making/boundaries', 'capacity'))
        or exists (
       select 1 from jsonb_array_elements(case when jsonb_typeof(r.content->'significantSecondaryLosses') = 'array' then r.content->'significantSecondaryLosses' else '[]'::jsonb end) e
       where lower(case when jsonb_typeof(e) = 'object' then e->>'category' else e #>> '{}' end) in ('decision-making / boundaries', 'decision-making/boundaries', 'capacity'))
  )                                                                                                                                             as referrals_with_old_or_bare_name_expect_0,
  (select count(*) from public.library_entries
     where secondary_losses && array[$$Decision-Making / Boundaries$$, $$Decision-Making/Boundaries$$, $$Capacity$$])                       as library_tags_with_old_or_bare_name_expect_0;
