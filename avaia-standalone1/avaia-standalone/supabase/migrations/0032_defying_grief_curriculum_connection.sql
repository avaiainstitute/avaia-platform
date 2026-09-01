-- Defying Grief workshop curriculum connection pass.
--
-- The prior audit found the workshop architecture for "The Things We Lose
-- After the Loss" already substantial, but built around two governing
-- metaphors -- Ripple (in this Experience) and Audacity (in the live CAT/
-- InnerCompass conversations) -- that had never been connected into one
-- taught sequence, and with no shared-room Audacity teaching at all.
--
-- This migration is additive-only: two new sections (a shared-room
-- Audacity teaching that bridges explicitly back to the Ripple, and a new
-- private-reflection activity), plus light, targeted appends to two
-- existing movement rows, one existing activity row, and four of the
-- seven format_variant rows -- every append reuses only the governing
-- decision already established in DEFYING_GRIEF_CAT_AUDACITY /
-- DEFYING_GRIEF_INNERCOMPASS_CHOICE (lib/engine/prompts.ts), not new
-- material. No row is replaced; no activity, the Ten Secondary Losses
-- reference, the Take-Home Record, Presenter Freedom, the Shared-Room
-- Rule, or any format_variant's core shape is rewritten. Status stays
-- 'draft' on nothing here changes -- this migration doesn't touch
-- experiences.status at all.

-- ---------------------------------------------------------------------------
-- 1. New orientation row: the shared-room Audacity teaching, explicitly
--    bridging back to the Ripple orientation already in place (position 2).
-- ---------------------------------------------------------------------------
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'orientation', 3,
  $$Audacity — What Force Has Been Moving Through the Ripples?$$,
  $$The Ripple showed what changed. This is where the Experience asks a different question: what force has been moving through those changes? AVAIA calls that force Audacity -- the raw capacity a person has to keep insisting on their own aliveness in the face of loss. Audacity of Grief and Audacity of Happiness are not two different forces. They are the same Audacity, expressed in different directions. The difference is not which force is present -- it is the direction, intention, and use of the one force already there. Audacity may become visible through anger, bitterness, withdrawal, addiction, destructive behavior, shutting down, or other ways grief has gained force in a person's life. These are offered for recognition only -- never as a diagnosis, and never as an assumption about what any particular Host is carrying. The same Audacity can also become visible as courage, resilience, hope, laughter, or the willingness to keep participating in life. This is not positive thinking, and it does not mean grief has ended or disappeared. It means the same force present in the harder expressions is also available in the others -- and nothing here decides, for the Host, which direction it should go.$$,
  'draft'
from public.experiences e
where e.title = 'The Things We Lose After the Loss'
returning id, section_type, position, title;

-- ---------------------------------------------------------------------------
-- 2. New activity row: "What Has Grief Been Allowed to Decide?" -- private
--    reflection, positioned after the existing eight activities.
-- ---------------------------------------------------------------------------
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'activity', 9,
  $$What Has Grief Been Allowed to Decide?$$,
  $$A private reflection, not a public one. After naming what changed and what has been carried, participants consider whether grief has quietly been given a say in areas such as: identity, relationships, connection, trust, dreams, expectations, boundaries, decisions, control, the future, what someone believes is possible, or how someone sees themselves. This is not "What did grief ruin?" and it is never framed as something a Host allowed to happen. It is recognition, offered gently: some of what feels fixed may actually be a decision grief has been making by default. The Host determines whether any of this applies. Blank space is allowed. "I don't know" is allowed. "Nothing" is allowed. No presenter or Guide assigns an answer.$$,
  'draft'
from public.experiences e
where e.title = 'The Things We Lose After the Loss'
returning id, section_type, position, title;

-- ---------------------------------------------------------------------------
-- 3. Day Two (Understanding) -- append the Audacity introduction, in place,
--    right where the room is already moving from Ripple recognition toward
--    the private conversation layer. Full original text preserved verbatim;
--    only the two italicized-below clauses are new.
-- ---------------------------------------------------------------------------
update public.experience_sections es
set body = $$Movement: Understanding. What else changed when this changed? Introduce the ten Secondary Losses as recognition language, not a checklist. Ripple Map: participants privately mark only the areas that resonate; blank space is allowed. CAT time: follow connections without forcing the conversation through all ten losses. Small-group optional exercise: discuss the idea of ripple effects without requiring personal disclosure. Guide availability: Hosts can bring one chosen thread to a Certified Guide if they want human accompaniment. Restoration distinction: ask what has changed permanently, what may be rebuildable, and what is still unknown. Audacity introduction: once the ripples are visible, name the force that has been moving through them -- Audacity, the same capacity whether it has shown up as anger, withdrawal, or resilience; one force, not two, expressed in different directions. Evening integration: Which ripple surprised me? Which one finally gave language to something I have been living? What force do I recognize moving through what I've carried?$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id
  and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'movement'
  and es.position = 2
returning es.id, es.section_type, es.position, es.title;

-- ---------------------------------------------------------------------------
-- 4. Day Three (Agency) -- append "What Has Grief Been Allowed to Decide?"
--    and the Audacity of Choice connection, closing on the existing anchor.
-- ---------------------------------------------------------------------------
update public.experience_sections es
set body = $$Movement: Agency. What do I want to carry forward—and how? What has grief been allowed to decide: a private reflection on identity, relationships, connection, trust, dreams, expectations, boundaries, decisions, control, or the future -- recognition only, never blame, and blank space is always allowed. InnerCompass time: move from recognition toward choice without requiring resolution. The Restoration Map: what I want to protect, rebuild, practice, reconnect with, grieve, release from control, or leave open. Virtue connection: identify canonical virtues that may support participation without framing grief as a virtue deficit. The Audacity of Choice: the same Audacity recognized in Understanding is still available here, in whatever direction the Host chooses -- Defying Grief does not promise the territory changes, only that the Host chooses how to walk it with greater visibility. The Next Ripple: What might one intentional choice affect beyond the immediate decision? Return-home continuity: identify the moment most likely to make the old landscape feel overwhelming again. Closing experience: no public declaration required; participants leave with a private record of what became visible. We don't move on. We move with.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id
  and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'movement'
  and es.position = 3
returning es.id, es.section_type, es.position, es.title;

-- ---------------------------------------------------------------------------
-- 5. "What Is Still Here?" activity -- append the Chemistry of Virtue
--    recognition guardrail (never scored, never implied to compensate).
-- ---------------------------------------------------------------------------
update public.experience_sections es
set body = $$Recognition of what remains without using gratitude to cancel grief. Chemistry of Virtue may help name what's recognized -- qualities, relationships, values, capacities, love, or parts of the self still visible -- offered for recognition only, never scored, and never implied to compensate for what was lost.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id
  and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'activity'
  and es.title = $$What Is Still Here?$$
returning es.id, es.section_type, es.position, es.title;

-- ---------------------------------------------------------------------------
-- 6. Format variants -- Audacity named only where the format already
--    reaches Understanding or Agency. The 20-30 minute presentation, the
--    community/grief event, and the Youth adaptation are deliberately left
--    untouched: too short to add a new concept, recognition-only in scope,
--    and a separate, safeguarded architecture, respectively.
-- ---------------------------------------------------------------------------
update public.experience_sections es
set body = $$Shared experience: Ripple teaching + a brief Audacity introduction + private Ripple Map + one Agency exercise. Private AVAIA layer: Optional IAP or follow-up Journey. Take-home: Personal Ripple Map.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'format_variant' and es.title = $$60–90 minute workshop$$
returning es.id, es.title;

update public.experience_sections es
set body = $$Shared experience: Awareness + Secondary Loss recognition + Audacity introduction + restoration distinction. Private AVAIA layer: IAP encouraged; CAT can continue later. Take-home: Expanded map + continuity question.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'format_variant' and es.title = $$Half-day workshop$$
returning es.id, es.title;

update public.experience_sections es
set body = $$Shared experience: Awareness + Understanding (including the Ripple → Audacity bridge) with Agency closing. Private AVAIA layer: IAP → CAT; InnerCompass opening as appropriate. Take-home: Take-home record + first choice.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'format_variant' and es.title = $$2-day retreat$$
returning es.id, es.title;

update public.experience_sections es
set body = $$Shared experience: Full Ripple and Audacity arc with integration time. Private AVAIA layer: IAP → CAT → InnerCompass. Take-home: Complete take-home record + return-home plan.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'format_variant' and es.title = $$3-day retreat$$
returning es.id, es.title;
