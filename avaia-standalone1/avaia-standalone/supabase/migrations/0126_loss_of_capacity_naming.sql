-- 0126: the Secondary Loss formerly named "Decision-Making / Boundaries" is named "Capacity" ("Loss of Capacity").
--
-- Founder decision (recorded in the 2026-10-05 hospice capability audit and taught in certification lesson 5.5): the loss was renamed to
-- Loss of Capacity; the thread is unchanged (same Grief Myth, same virtue family, same life lesson). The application now treats "Capacity"
-- as the canonical name and still ACCEPTS the retired name when reading stored data (lib/institution.ts, canonicalSecondaryLoss), so applying this
-- migration is a tidy-up of stored data, not a condition for anything to keep working. It can be applied before or after the deploy, and
-- re-running it is harmless.
--
-- Same discipline as 0063 (Life's Vision): exact-match only, every statement RETURNS the rows it touched, nothing is silent, and no historical
-- migration file is edited. Scope:
--   1. the View From Above class 5 Experience and Class titles (rows are linked by id, so renaming the title does not break any link);
--   2. the phrase "The Loss of Decision-Making / Boundaries" where another View From Above section refers to that class by name;
--   3. stored referral categories (secondaryLossesIdentified / significantSecondaryLosses), both array shapes, both spellings of the old name;
--   4. Library entry tags (library_entries.secondary_losses), both spellings.
--
-- DELIBERATELY NOT CHANGED (Founder content decisions, listed in docs/CLOSURE_REPORT_2026-10-10.md): the one-line descriptive text that sits
-- beside the old name in the Defying Grief "Ten Secondary Losses" reference row and the body of View From Above class 5. Those describe the old
-- concept in words only the Founder can replace; renaming just the label there would mislabel it.

-- 1a. View From Above class 5, the Experience.
update public.experiences
set title = $$The Loss of Capacity$$, updated_at = now()
where title = $$The Loss of Decision-Making / Boundaries$$
returning id, title, status, updated_at;

-- 1b. View From Above class 5, the Class.
update public.classes
set title = $$The Loss of Capacity, View From Above$$, updated_at = now()
where title = $$The Loss of Decision-Making / Boundaries, View From Above$$
returning id, title, status, updated_at;

-- 2. Other View From Above sections that name class 5 in their own text.
update public.experience_sections es
set body = replace(es.body, $$The Loss of Decision-Making / Boundaries$$, $$The Loss of Capacity$$),
    updated_at = now()
from public.experiences e
where es.experience_id = e.id
  and e.components @> array['view-from-above']
  and es.body like $$%The Loss of Decision-Making / Boundaries%$$
returning es.id, es.section_type, es.title, es.updated_at;

update public.experience_sections es
set title = replace(es.title, $$The Loss of Decision-Making / Boundaries$$, $$The Loss of Capacity$$),
    updated_at = now()
from public.experiences e
where es.experience_id = e.id
  and e.components @> array['view-from-above']
  and es.title like $$%The Loss of Decision-Making / Boundaries%$$
returning es.id, es.section_type, es.title, es.updated_at;

-- 3a. Stored referrals, secondaryLossesIdentified (a plain string entry, or a {category, description} object entry).
update public.referrals
set content = jsonb_set(
  content,
  '{secondaryLossesIdentified}',
  (
    select jsonb_agg(
      case
        when jsonb_typeof(elem) = 'string' and lower(elem #>> '{}') in ('decision-making / boundaries', 'decision-making/boundaries')
          then to_jsonb($$Capacity$$::text)
        when jsonb_typeof(elem) = 'object' and lower(elem->>'category') in ('decision-making / boundaries', 'decision-making/boundaries')
          then elem || jsonb_build_object('category', $$Capacity$$)
        else elem
      end
    )
    from jsonb_array_elements(content->'secondaryLossesIdentified') elem
  )
)
where jsonb_typeof(content->'secondaryLossesIdentified') = 'array'
  and exists (
    select 1 from jsonb_array_elements(content->'secondaryLossesIdentified') e
    where (jsonb_typeof(e) = 'string' and lower(e #>> '{}') in ('decision-making / boundaries', 'decision-making/boundaries'))
       or (jsonb_typeof(e) = 'object' and lower(e->>'category') in ('decision-making / boundaries', 'decision-making/boundaries'))
  )
returning id, host_id, conversation_id;

-- 3b. Stored referrals, significantSecondaryLosses (same two shapes).
update public.referrals
set content = jsonb_set(
  content,
  '{significantSecondaryLosses}',
  (
    select jsonb_agg(
      case
        when jsonb_typeof(elem) = 'string' and lower(elem #>> '{}') in ('decision-making / boundaries', 'decision-making/boundaries')
          then to_jsonb($$Capacity$$::text)
        when jsonb_typeof(elem) = 'object' and lower(elem->>'category') in ('decision-making / boundaries', 'decision-making/boundaries')
          then elem || jsonb_build_object('category', $$Capacity$$)
        else elem
      end
    )
    from jsonb_array_elements(content->'significantSecondaryLosses') elem
  )
)
where jsonb_typeof(content->'significantSecondaryLosses') = 'array'
  and exists (
    select 1 from jsonb_array_elements(content->'significantSecondaryLosses') e
    where (jsonb_typeof(e) = 'string' and lower(e #>> '{}') in ('decision-making / boundaries', 'decision-making/boundaries'))
       or (jsonb_typeof(e) = 'object' and lower(e->>'category') in ('decision-making / boundaries', 'decision-making/boundaries'))
  )
returning id, host_id, conversation_id;

-- 4. Library entry tags.
update public.library_entries
set secondary_losses = array_replace(array_replace(secondary_losses, $$Decision-Making / Boundaries$$, $$Capacity$$), $$Decision-Making/Boundaries$$, $$Capacity$$),
    updated_at = now()
where $$Decision-Making / Boundaries$$ = any(secondary_losses) or $$Decision-Making/Boundaries$$ = any(secondary_losses)
returning id, title, secondary_losses;

-- Verification (read-only, self-labelling): everything the migration is responsible for. Every number should be 0 after it has run.
select
  (select count(*) from public.experiences where title = $$The Loss of Decision-Making / Boundaries$$)                                   as experiences_with_old_title_expect_0,
  (select count(*) from public.classes where title = $$The Loss of Decision-Making / Boundaries, View From Above$$)                       as classes_with_old_title_expect_0,
  (select count(*) from public.referrals r
     where r.content::text ilike $$%"category": "Decision-Making / Boundaries"%$$ or r.content::text ilike $$%"Decision-Making / Boundaries"%$$) as referrals_with_old_name_expect_0,
  (select count(*) from public.library_entries
     where $$Decision-Making / Boundaries$$ = any(secondary_losses) or $$Decision-Making/Boundaries$$ = any(secondary_losses))          as library_tags_with_old_name_expect_0;
