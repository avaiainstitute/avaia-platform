-- AVAIA Guide Toolkit -- corrections and parent metadata for the pilot
-- Experience ("The Things We Lose After the Loss", migration 0021).
-- No new content invented: the Secondary Loss spelling fix aligns with
-- the canonical SECONDARY_LOSSES source (lib/institution.ts), and the
-- parent Experience metadata below is composed only from what the
-- pilot's own 32 sections already establish. Status stays 'draft' --
-- not touched here, not published, not exposed in the Guide Toolkit.

-- 1. Canonical Secondary Loss naming. lib/institution.ts's SECONDARY_LOSSES
-- -- the live, canonical source used everywhere else in the app (the
-- public /secondary-loss page, referral generation, Library filtering) --
-- spells this loss "Life Vision," not "Life's Vision." Scoped to the one
-- row and the one substring; no other Secondary Loss name or definition
-- in this Experience is touched.
update public.experience_sections es
set body = replace(body, $$Life's Vision$$, $$Life Vision$$),
    updated_at = now()
from public.experiences e
where es.experience_id = e.id
  and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'reference'
  and es.body like $$%Life's Vision%$$
returning es.id, es.section_type, es.title, es.updated_at;

-- 2. Parent Experience metadata. summary/components/conversation_stages
-- were empty (migration 0020 seeded title + status only). Every phrase
-- below is drawn directly from the pilot's own orientation, movement,
-- reference, and conversation_window sections -- not new material.
update public.experiences
set
  summary = $$An AVAIA Experience that creates room to recognize the ripples of a loss without deciding for the Host what their loss means -- not limited to death, but also divorce, estrangement, relocation, betrayal, disaster, financial collapse, a lost opportunity, or major transition. Moves through Awareness, Understanding, and Agency using the Ripple metaphor, the Ten Secondary Losses, and IAP, CAT, and InnerCompass. We don't move on, we move with.$$,
  components = array['iap', 'cat', 'innercompass', 'secondary-loss', 'chemistry', 'defying-grief', 'youth-group'],
  conversation_stages = array['iap', 'cat', 'innercompass'],
  updated_at = now()
where title = 'The Things We Lose After the Loss'
returning id, title, status, summary, components, conversation_stages, updated_at;
