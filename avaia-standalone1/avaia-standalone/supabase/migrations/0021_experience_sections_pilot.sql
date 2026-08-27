-- AVAIA Guide Toolkit -- Experience Detail architecture, pilot slice.
--
-- Purely additive: one new table, no changes to experiences/classes/
-- experience_classes. Seeds exactly one Experience's detail content --
-- "The Things We Lose After the Loss" -- as the approved single pilot.
-- Every row below is a direct extraction from that Experience's own
-- blueprint; nothing borrowed from any other Experience, nothing
-- invented to achieve symmetry.
--
-- section_type vocabulary (13 values, one -- 'reference' -- added
-- during this pilot because the pilot's own "Ten Secondary Losses"
-- table demonstrated a real semantic need for it; no others added
-- speculatively):
--   orientation, governing_distinction, anchor, movement, question,
--   reference, activity, conversation_window, guide_preparation,
--   boundary, take_home, format_variant, success_definition
--
-- The pilot Experience and every section row stay status='draft'.
-- Ordinary Guide RLS ("... guide read") requires both the section's
-- own status AND its parent Experience's status to be 'published' --
-- belt-and-suspenders, so a section can never leak ahead of its
-- Experience. Admin access reuses the exact same admin-all RLS
-- pattern already used on experiences/classes/experience_classes --
-- no new permission system.

create table if not exists public.experience_sections (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences (id) on delete cascade,
  section_type  text not null check (section_type in (
                  'orientation','governing_distinction','anchor','movement','question',
                  'reference','activity','conversation_window','guide_preparation',
                  'boundary','take_home','format_variant','success_definition'
                )),
  position      integer not null default 0,
  title         text,
  body          text not null,
  status        text not null default 'draft' check (status in ('draft','published','archived')),
  editor_id     uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists experience_sections_experience_idx
  on public.experience_sections (experience_id, section_type, position);

alter table public.experience_sections enable row level security;

create policy "experience sections guide read"
  on public.experience_sections for select
  using (
    status = 'published'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'guide')
    and exists (select 1 from public.experiences e
                where e.id = experience_sections.experience_id and e.status = 'published')
  );

create policy "experience sections admin all"
  on public.experience_sections for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- Pilot content: 32 rows for "The Things We Lose After the Loss" only.
-- Resolved by title against the existing experiences row (migration 0020),
-- not a hardcoded id.
-- ---------------------------------------------------------------------------

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, v.section_type, v.position, v.title, v.body, 'draft'
from public.experiences e
cross join (values

  ('orientation', 1, 'The Experience',
   'People often know the event that changed their life. What can be harder to see is everything that changed because of it. The Things We Lose After the Loss is an AVAIA experience that creates room to recognize those ripples without deciding for the Host what their loss means. The original disruption may be death, divorce, estrangement, relocation, betrayal, disaster, financial collapse, a lost opportunity, a major transition, or another event. The experience does not require every participant to have the same kind of loss. It gives each person a private table for the loss they actually carry. Everyone may see where the stone hit. The Host may be living inside the ripples.'),

  ('orientation', 2, 'The Signature Metaphor — The Ripple',
   'A stone enters still water. The point of impact is visible immediately. Then rings travel outward. Some are close to the impact. Others reach places that seemed unrelated. The experience uses that image to distinguish the original loss from the secondary changes that can follow it. Sometimes we are trying to understand our lives by staring only at where the stone hit. AVAIA does not assign a ripple to a participant. The ten Secondary Losses provide language for recognition only when that language fits what the Host is already discovering.'),

  ('anchor', 1, 'Anchor',
   'We don''t move on, we move with.'),

  ('question', 1, 'Signature Question',
   'What else changed when this changed?'),

  ('reference', 1, 'The Ten Secondary Losses',
   'Meaning — Did what gave this part of life meaning change? Reality — Did my sense of what was true, stable, or dependable change? Dreams / Opportunities — Did futures, possibilities, plans, or opportunities disappear or change? Self-Trust — Did I begin questioning myself, my judgment, or what I thought I knew? Decision-Making / Boundaries — Did choices, limits, responsibility, or saying yes/no become harder? Life''s Vision — Did the life I thought I was building become difficult to picture? Connection — Did belonging, closeness, participation, or being understood change? Control — Did I become more aware of what I cannot control—or begin trying harder to control it? Identity — Did who I believed I was, or the role I occupied, change? Attachment / Support — Did the people, places, routines, or structures I relied on change? These are not diagnoses, stages, scores, or a checklist a participant must complete. A Host may recognize one, several, none, or something not yet named.'),

  ('governing_distinction', 1, 'The Governing Distinction',
   'The first loss is not always the only loss. Recognition does not mean multiplying pain or persuading someone that they are more wounded than they thought. It means allowing changes that are already present to become visible enough to understand. The experience does not rank losses. It does not tell someone how long grief should last. It does not require a person to ''move on.'' It does not treat every life change as damage. It does not assume restoration means returning to the life that existed before. It does not turn Secondary Losses into labels attached to the Host. We don''t move on, we move with.'),

  ('movement', 1, 'Day One — Where Did the Stone Hit?',
   'Movement: Awareness. What changed? Opening Ripple Experience: introduce the difference between the visible event and the life around it. Private Point-of-Impact reflection: participants name the disruption they want to bring, without being required to disclose it publicly. IAP time: protected conversation for the Host to say what happened and what feels important now. Before/After Map: not ''better or worse'' — simply what was true before, what is true now, and what feels different. Room teaching: loss can alter more than what was directly taken. Evening Head & Heart / Workbook reflection: What am I carrying that I have never considered part of this loss?'),

  ('movement', 2, 'Day Two — Follow the Ripples',
   'Movement: Understanding. What else changed when this changed? Introduce the ten Secondary Losses as recognition language, not a checklist. Ripple Map: participants privately mark only the areas that resonate; blank space is allowed. CAT time: follow connections without forcing the conversation through all ten losses. Small-group optional exercise: discuss the idea of ripple effects without requiring personal disclosure. Guide availability: Hosts can bring one chosen thread to a Certified Guide if they want human accompaniment. Restoration distinction: ask what has changed permanently, what may be rebuildable, and what is still unknown. Evening integration: Which ripple surprised me? Which one finally gave language to something I have been living?'),

  ('movement', 3, 'Day Three — What Moves With Me?',
   'Movement: Agency. What do I want to carry forward—and how? InnerCompass time: move from recognition toward choice without requiring resolution. The Restoration Map: what I want to protect, rebuild, practice, reconnect with, grieve, release from control, or leave open. Virtue connection: identify canonical virtues that may support participation without framing grief as a virtue deficit. The Next Ripple: What might one intentional choice affect beyond the immediate decision? Return-home continuity: identify the moment most likely to make the old landscape feel overwhelming again. Closing experience: no public declaration required; participants leave with a private record of what became visible.'),

  ('activity', 1, 'The Stone and the Water',
   'A physical or visual demonstration of one point of impact producing many ripples. Participants are never asked to equate the size of a ripple with the severity of a loss.'),

  ('activity', 2, 'What Else Changed?',
   'A shared example begins with an ordinary fictional disruption. The room identifies possible secondary changes to learn the distinction before applying it privately.'),

  ('activity', 3, 'The Invisible Backpack',
   'Participants consider what they have been carrying because of the loss that other people may not see.'),

  ('activity', 4, 'Before / After / Now',
   'Three-column reflection that separates memory of the past, consequences of the disruption, and present reality without demanding a positive ending.'),

  ('activity', 5, 'The Empty Chair — What Is Missing?',
   'An optional connection to The Empty Chair experience: what person, role, future, certainty, support, or part of self seems absent from the table?'),

  ('activity', 6, 'What Is Still Here?',
   'Recognition of what remains without using gratitude to cancel grief.'),

  ('activity', 7, 'The Next Ripple',
   'Participants identify one small act of Agency and consider what it could influence without requiring a guaranteed outcome.'),

  ('activity', 8, 'The Ripple Map',
   'The participant''s working page can be organized as concentric layers: CENTER — The Event: What happened or changed? RING 1 — Immediate Changes: What changed right away? RING 2 — Secondary Losses: What else changed in meaning, reality, dreams, trust, choices, vision, connection, control, identity, or support? RING 3 — What I Have Been Carrying: What emotions, responsibilities, questions, expectations, habits, or protections formed around these changes? RING 4 — What Is Still Alive: What relationships, virtues, hopes, memories, abilities, commitments, or possibilities remain? RING 5 — Agency: What can I participate in now, even if I cannot undo the point of impact? The map is not proof of damage. It is a way to see the landscape.'),

  ('conversation_window', 1, 'Awareness — IAP',
   'IAP — Individual Awareness Profile. Saying what happened, what matters, and what is present now in their own language.'),

  ('conversation_window', 2, 'Understanding — CAT',
   'CAT — Conversations Across Time. Following the landscape: what changed, what connects, what has been carried, and which ripples may now be visible.'),

  ('conversation_window', 3, 'Agency — InnerCompass',
   'InnerCompass. Discerning what can be chosen, restored, carried differently, grieved, protected, rebuilt, or allowed to remain unresolved.'),

  ('boundary', 1, 'The Shared-Room Rule',
   'One room. Many losses. Many Journeys. Every story stays with its owner. A participant never has to announce the loss they brought. Private AVAIA conversations do not become presenter material. Optional human support is available through appropriately prepared Certified Guides. The Host chooses what, if anything, crosses from the private table into a human conversation.'),

  ('boundary', 2, 'Protected Boundaries',
   'No diagnosis, therapy, or clinical claims. No forced disclosure or public grief performance. No ranking whose loss is ''worse.'' No promise that understanding the ripples removes grief. No requirement to forgive, reconcile, reconnect, move on, or find meaning. No presenter or Guide decides which Secondary Losses a Host has. No assumption that another person will participate in restoration. No virtue language used to judge how well someone is grieving. Youth versions require the separate AVAIA youth safeguards, privacy structure, and appropriately prepared Guides.'),

  ('guide_preparation', 1, 'Presenter Freedom',
   'The presenter receives the experience architecture, not a script. The presenter can bring personal voice while the AVAIA governing structure remains intact. Use appropriate personal stories without making the presenter''s grief the model everyone must follow. Use examples from death and non-death losses so the room does not become artificially narrow. Use humor only where it creates humanity without minimizing what people carry. Adapt language and examples to the audience. Allow silence and private reflection to do real work. Never turn the ten Secondary Losses into a lecture participants are expected to memorize.'),

  ('guide_preparation', 2, 'Certified Guide Preparation',
   'Understand the ten Secondary Losses as recognition architecture, not diagnostic categories. Practice asking open recognition questions without leading a Host toward a named loss. Know the distinction between witnessing grief and trying to resolve it. Protect privacy when shared-room material activates a private Journey. Recognize capacity and allow pauses, exits, or nonparticipation. Know when the experience has moved outside AVAIA''s role and appropriate outside support is needed. Use the Guide posture: protect the table, not the outcome.'),

  ('take_home', 1, 'The Take-Home Record',
   'THE POINT OF IMPACT — The loss or disruption I chose to bring. WHAT CHANGED FIRST — The immediate changes I recognized. THE RIPPLES I CAN SEE NOW — Secondary changes that became visible to me. WHAT I HAVE BEEN CARRYING — Responsibilities, questions, fears, hopes, roles, habits, or expectations connected to those changes. WHAT IS STILL HERE — People, memories, virtues, abilities, commitments, meaning, possibilities, or support that remain. WHAT MAY NEED RESTORATION — Areas I may want to rebuild, reconnect, practice, protect, or understand differently. WHAT MAY NEED TO BE GRIEVED — Things I cannot restore by effort or decision. WHAT I CANNOT CONTROL — Outcomes, other people''s participation, the past, timing, certainty, or other realities outside my ownership. WHAT I CAN CHOOSE — My next participation from the ground I can see now. WHEN THE RIPPLE RETURNS — How I want to respond when this loss becomes newly visible again.'),

  ('format_variant', 1, '20–30 minute presentation',
   'Shared experience: The Ripple metaphor + What Else Changed? Private AVAIA layer: Optional private reflection afterward. Take-home: One recognition question.'),

  ('format_variant', 2, '60–90 minute workshop',
   'Shared experience: Ripple teaching + private Ripple Map + one Agency exercise. Private AVAIA layer: Optional IAP or follow-up Journey. Take-home: Personal Ripple Map.'),

  ('format_variant', 3, 'Half-day workshop',
   'Shared experience: Awareness + Secondary Loss recognition + restoration distinction. Private AVAIA layer: IAP encouraged; CAT can continue later. Take-home: Expanded map + continuity question.'),

  ('format_variant', 4, '2-day retreat',
   'Shared experience: Awareness + Understanding with Agency closing. Private AVAIA layer: IAP → CAT; InnerCompass opening as appropriate. Take-home: Take-home record + first choice.'),

  ('format_variant', 5, '3-day retreat',
   'Shared experience: Full Ripple arc with integration time. Private AVAIA layer: IAP → CAT → InnerCompass. Take-home: Complete take-home record + return-home plan.'),

  ('format_variant', 6, 'Community / grief event',
   'Shared experience: Shared language for many kinds of loss. Private AVAIA layer: Private Journeys available without public disclosure. Take-home: Recognition + path to continue.'),

  ('format_variant', 7, 'Youth adaptation',
   'Shared experience: Developmentally appropriate ripple language and private processing. Private AVAIA layer: Youth IAP/CAT/InnerCompass with safeguards. Take-home: Age-appropriate recognition record.')

) as v(section_type, position, title, body)
where e.title = 'The Things We Lose After the Loss';
