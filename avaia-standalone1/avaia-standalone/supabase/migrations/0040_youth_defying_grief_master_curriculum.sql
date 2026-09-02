-- AVAIA Youth Defying Grief -- Master Curriculum (Part 3).
--
-- Adapts the adult "The Things We Lose After the Loss" Master Curriculum
-- (0033) for a young audience -- same eleven-module Awareness/
-- Understanding/Agency arc, same governing architecture (the Stone and
-- the Ripples, the Ten Secondary Losses, one Audacity in different
-- directions, the Audacity of Choice, "We don't move on, we move with"),
-- same institutional meaning throughout. What changes is expression, not
-- meaning: register, concreteness, and a per-module Developmental
-- adaptation field (8-11 / 12-14 / 15-17), the same three bands the
-- conversational engine already uses (0017_youth_journey.sql).
--
-- ARCHITECTURE: a SEPARATE experiences row, not new rows folded onto the
-- adult experience. The adult curriculum is written for an adult-led
-- room throughout; a genuinely adapted Youth version needs its own
-- register from the first sentence, not a band-note bolted onto adult
-- prose. Reuse is at the component and route layer instead: this row's
-- components include 'defying-grief', so it automatically renders
-- through the existing components/DefyingGriefCurriculum.tsx and the
-- existing print routes (app/toolkit/experiences/[experienceId]/print/
-- facilitator and /participant) with zero new UI code -- exactly the
-- "reuse before creating" instruction. The adult experience's own
-- "Youth adaptation" format_variant stub (0033) stays exactly as it is,
-- Safeguarded and draft -- it was always a pointer to a separate
-- architecture, not a placeholder this migration needs to fill in place.
--
-- STATUS: seeded as 'draft', deliberately not published. Guardian/
-- consent/privacy/safeguarding boundaries for Youth delivery are a real,
-- separate institutional decision this migration does not make (see the
-- boundary rows below, which name the open question rather than
-- resolving it). Publishing this experience is a decision for Dorian,
-- not an engineering default.
--
-- section_type reuses the exact enum 0033 already widened to 14 values
-- -- no schema change needed here. One small, shared code change
-- accompanies this migration: lib/experience-sections.ts's
-- MODULE_FIELD_PATTERN/MODULE_FIELD_DISPLAY_ORDER now also recognize a
-- "Developmental adaptation:" field label, so it renders as its own
-- clearly-labeled field in the Facilitator print packet and the live
-- curriculum view, not silently absorbed into an adjacent field.

insert into public.experiences (title, summary, status, components, conversation_stages)
values (
  $$The Things We Lose After the Loss — Youth$$,
  $$AVAIA's Defying Grief Master Curriculum, adapted for ages 8-17. The same eleven-module Awareness / Understanding / Agency arc as the adult Experience -- the Stone and the Ripples, the Ten Secondary Losses, one Audacity expressed in different directions, the Audacity of Choice -- spoken at a young person's own developmental register instead of an adult one. Not limited to death: divorce, moving, a friendship ending, a diagnosis, a family change, or anything else that disrupted a young person's life. Delivered by a certified Guide through the Youth Defying Grief Toolkit entry, with Youth IAP, CAT, and InnerCompass as the private, individual layer. We don't move on, we move with.$$,
  'draft',
  array['iap','cat','innercompass','secondary-loss','chemistry','defying-grief','youth-defying-grief']::text[],
  array['iap','cat','innercompass']::text[]
)
returning id, title;

-- ---------------------------------------------------------------------------
-- Foundation: orientation, governing_distinction, anchor, success_definition.
-- ---------------------------------------------------------------------------

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'orientation', 1,
  $$Orientation$$,
  $$This Experience exists to help a young person recognize what a loss or a disruption actually changed -- not to teach them a theory of grief, and not to decide for them what their experience means. It is not therapy, not a classroom lesson, and not a behavior-management tool. A Guide delivers it; AVAIA's Youth IAP, CAT, and InnerCompass give each participant a private, individual place to go deeper on their own terms, at whatever pace fits them. Ages 8-17. Nothing here requires a young person to have already lost someone to death -- divorce, a move, a friendship ending, an illness, a diagnosis, or any other real disruption belongs here just as fully.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'governing_distinction', 1,
  $$Being seen, not being observed$$,
  $$A young person in this room has probably already been observed constantly -- by parents, teachers, coaches, counselors, doctors, other kids. Being watched is not the same as being understood. This Experience's whole purpose is the second thing. It never requires a participant to already call their own experience "grief," "loss," or "trauma" before it makes room for it -- it works from whatever they actually bring, in whatever words they already have or don't have yet.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'anchor', 1,
  $$We don't move on. We move with.$$,
  $$The anchor line is identical to the adult Experience, spoken exactly as it is -- this is not something to simplify. A young person does not have to feel finished, resolved, or okay by the end of this room to have done it right. What they lost stays real. What changes is how much room it has to decide everything else.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'success_definition', 1,
  $$What success looks like$$,
  $$Success is not a young person announcing they feel better, forgiving someone, or declaring the loss resolved. It looks like a participant recognizing what changed, recognizing what they've been carrying, recognizing that something in them is still there, and leaving with one thing -- however small -- that feels like theirs to choose. A session can succeed without reaching Agency at all; recognizing something true is already enough.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

-- ---------------------------------------------------------------------------
-- Boundaries -- youth-specific. Names what this migration does NOT decide,
-- rather than inventing an answer.
-- ---------------------------------------------------------------------------

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'boundary', 1,
  $$Not a diagnosis, not a label$$,
  $$A participant does not need a diagnosis of ADHD, autism, dyslexia, anxiety, or anything else before a Guide accommodates how they communicate -- fragments, tangents, long silences, very short or very long answers, needing to move, returning to something from much earlier. Different does not mean deficient, and a young person struggling to say something does not by itself tell you what the struggle means. Never label a communication style, even privately.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'boundary', 2,
  $$Capacity and consent, every time$$,
  $$Any participant may step out, sit out, pass, or stop at any point without explanation, exactly as in the adult Experience. Nothing here is graded, and no activity is mandatory. A young person's "I don't want to talk about that" is a complete answer, not an opening to explore later in the same session.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'boundary', 3,
  $$Guardian, consent, and institutional delivery -- open, not answered here$$,
  $$This migration builds curriculum content and the individual Guide-facilitated delivery path. It does not decide, and does not invent, AVAIA's guardian-consent architecture, school or organization delivery terms, or a group/workshop format for minors -- those are separate institutional and, in places, legal decisions that belong to AVAIA's leadership, not to engineering defaults. The format_variant rows below reflect exactly that: only the already-built individual Guide-facilitated path is offered without qualification; any group or institutional format is explicitly marked as waiting on that separate decision.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'boundary', 4,
  $$Not therapy, not crisis care$$,
  $$This Experience is guided and virtue-centered, not therapy, counseling, or crisis intervention. If a genuine safety concern appears -- danger, abuse, self-harm, harm to others -- the Guide steps out of the curriculum entirely and follows AVAIA's youth safety guidance, the same standard every Youth IAP, CAT, and InnerCompass conversation already holds. A young person expressing sadness, anger, fear, or grief is not, on its own, a safety concern -- this Experience works directly with material like that by design.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

-- ---------------------------------------------------------------------------
-- Modules 1-11. Same movement sequence and institutional meaning as the
-- adult curriculum (0033); register, concreteness, and activities adapted
-- for ages 8-17, with a Developmental adaptation field per module.
-- ---------------------------------------------------------------------------

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 1,
  $$Module 1 — What Is Grief?$$,
  $$Movement: Awareness. Purpose: widen what counts as grief before asking anyone to do anything with it. Core idea: grief isn't only about someone dying -- it's what shows up whenever something real got disrupted. Facilitator teaching: a loss or disruption can be a person, a friendship, a family change like divorce or moving, a pet, health, safety, trust, a routine, a team, an expectation, or a future a participant thought they'd have -- offered only as examples, never a checklist. The participant decides what counts as theirs. Key distinction: what happened is not the same thing as everything that changed because of it -- that's where the next module goes. Shared-room experience: the Guide widens the room's idea of grief before asking for anything private. Private reflection: participants privately name, just to themselves, what disruption they're bringing in today -- nothing shared aloud, nothing required. Developmental adaptation: Ages 8-11 -- use one or two concrete, everyday examples (a move, a pet, parents splitting up) rather than a list; keep it short. Ages 12-14 -- naming several kinds of loss side by side usually helps normalize that theirs counts too. Ages 15-17 -- can hold the full range and often appreciate hearing that "smaller" losses (a friendship, a plan falling through) are not being minimized here. Transition: once grief means more than just death, the room is ready to ask what Defying Grief actually means.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 2,
  $$Module 2 — What Is Defying Grief?$$,
  $$Movement: Awareness. Purpose: say plainly what this room will and won't ask before any private work starts. Core idea: Defying Grief means the loss doesn't get to run the rest of your life -- it's not about getting over it, and nobody has to "move on." Key distinctions: this isn't forgetting, isn't pretending you're fine, isn't replacing what you lost, isn't being forced to feel better, isn't fixing grief like a problem, isn't going back to who you were before, and isn't a contest over whose loss is worse. Facilitator teaching: one honest way to say it -- you can respect what happened to you without letting it make every decision for you from now on. Shared-room experience: the Guide states once, clearly, what this room will and won't ask of anyone. Developmental adaptation: Ages 8-11 -- keep this very concrete: "This isn't about forgetting or pretending. It's about what happens next." Ages 12-14 -- naming what it's NOT often lands harder than what it IS at this age, since many have already absorbed pressure to "just get over it." Ages 15-17 -- can engage the full distinction directly, including the idea that respecting a loss and being run by it are different things. Transition: with Defying Grief defined, the room is ready to look at what actually happened -- the Stone.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 3,
  $$Module 3 — The Stone and the Ripples$$,
  $$Movement: Awareness. Purpose: teach the Stone-and-Ripples idea fully, and let each participant start their own Ripple Map. Core idea: the Stone is what actually happened -- the loss, the disruption, the moment things changed. The Ripples are everything that started changing outward from it. Activities: The Stone and the Water; What Else Changed?; Before / After / Now. Shared-room experience: the room learns the idea together using a shared, low-stakes example before turning it on anything private. Private reflection: a private moment to name the Stone they're bringing, without having to say it out loud, and the start of an individual Ripple Map -- the center and the first ring, what changed right away. Nobody else sees anyone's map. Optional AVAIA conversation: Youth IAP may open here or later, depending on the format. Guide boundaries: never rank whose stone is bigger; never assign a ripple to someone who hasn't found it themselves. Developmental adaptation: Ages 8-11 -- a literal stone dropped in water works well as a physical demonstration; keep the ripple map to two or three rings. Ages 12-14 -- can usually generate several ripples on their own once the metaphor clicks; let them lead the pace. Ages 15-17 -- may want to map ripples that reach into identity, relationships, or plans for the future; give the map more room. Transition: what changed is now visible -- next, what it quietly took alongside it.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 4,
  $$Module 4 — The Things We Lose After the Loss$$,
  $$Movement: Understanding. Purpose: introduce the Ten Secondary Losses through recognition, never a lecture. Core idea: the thing a participant thinks they're grieving might not be the only thing they've been carrying. Facilitator teaching: use the canonical AVAIA Secondary Loss framework exactly, offered as ten possible categories of what a loss can quietly take alongside the one already named -- meaning, reality, dreams or opportunities, self-trust, decision-making or boundaries, life vision, connection, control, identity, attachment or support. Key distinction: this is a way of noticing, not a worksheet to finish. Activities: The Invisible Backpack; continue the Ripple Map (second ring: Secondary Losses). Private reflection: losses may stack, overlap, or stay unclear -- blank space and "I don't know" are both fine, and nothing gets assigned to someone who hasn't recognized it themselves. Optional AVAIA conversation: Youth IAP or early CAT may continue privately here. Developmental adaptation: Ages 8-11 -- translate the categories into plain language ("did anything about feeling safe change? did you stop doing something you used to do?") rather than naming all ten formally. Ages 12-14 -- can usually recognize two or three that fit without help. Ages 15-17 -- can typically work with the ten categories directly, including more abstract ones like identity or life vision. Transition: once what was lost is named, the room asks what all of it has been asking the participant to carry.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 5,
  $$Module 5 — What Have I Been Carrying?$$,
  $$Movement: Understanding. Purpose: move from what changed to what the participant has actually been carrying because of it. Core idea: naming the weight -- which might include fear, guilt, responsibility, anger, a role they didn't ask for, something they never said, or something they wish someone had told them. Facilitator teaching: this is Table language -- what has taken a seat at this young person's table without necessarily being invited. Activities: continue The Invisible Backpack; The Empty Chair -- What's Missing?; continue the Ripple Map (third ring: what I've been carrying). Optional AVAIA conversation: Youth IAP is available here as a private, individual tool -- the shared curriculum continues either way. Private reflection: no disclosure required; the Empty Chair activity in particular stays entirely private unless a participant chooses otherwise. Developmental adaptation: Ages 8-11 -- keep this to one clear question at a time ("is there something you've been carrying around that's kind of heavy?") and use The Invisible Backpack as the primary activity rather than The Empty Chair, which can be too abstract at this age. Ages 12-14 -- both activities usually work; expect responsibility, loyalty, and fitting in to surface often. Ages 15-17 -- can hold more complexity, including carrying something on behalf of a parent or sibling. Transition: carrying this weight is itself a kind of power -- the room is ready to name the force behind it.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 6,
  $$Module 6 — What Is Audacity?$$,
  $$Movement: Understanding. Purpose: a real shared-room teaching module on Audacity, not something hidden inside a private conversation. Core idea: the Audacity of Grief and the Audacity of Happiness aren't two different forces -- they're the same force, pointed in different directions. Facilitator teaching: help participants recognize how powerful this force actually is -- it can move attention, friendships, behavior, energy, and what someone expects from the future. Examples like withdrawal, anger, acting out, shutting down, or numbness may be named carefully, for recognition only -- never to diagnose, never implying it applies to everyone in the room, and never to shame. Key distinction: recognizing the force is real comes before any question of which direction it's pointed -- don't jump straight to "so choose happiness"; that's a later module. Shared-room experience: the Guide names Audacity once, clearly, as a real and neutral force, then lets the room sit with recognizing it rather than resolving it. Optional AVAIA conversation: Youth CAT may open or continue here. Developmental adaptation: Ages 8-11 -- keep this concrete: "There's a strong part of us that grief grabs onto. That same strength can show up in other ways too." Skip the abstract framing. Ages 12-14 -- can usually connect this to relationships, identity, and what they've been doing with hard feelings. Ages 15-17 -- can typically engage the full idea directly, including how it's shown up in more than one direction for them already. Transition: recognizing the force raises a harder question -- where has it already been deciding things.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 7,
  $$Module 7 — What Has Grief Been Allowed to Decide?$$,
  $$Movement: Understanding. Purpose: help participants notice where grief, fear, or disruption may have quietly taken over parts of their life. Core idea: some of what feels fixed might actually be a decision grief has been making by default, not a fact about the world. Facilitator teaching: possible areas include who I think I am now, what friendships feel possible, who I trust, what I feel allowed to want, what I expect from the future, what I avoid, what I've stopped asking for, and what now just feels like "the way things are." Offered as possibilities, never as interrogation and never as blame -- this is never framed as something the participant let happen. Activity: What Has Grief Been Allowed to Decide? -- private, with blank space, "I don't know," and "nothing" all completely valid answers. Optional AVAIA conversation: Youth CAT is the natural home for this. Developmental adaptation: Ages 8-11 -- narrow this to one or two very concrete questions ("is there something you used to do that you don't do anymore because of what happened?"). Ages 12-14 -- friendships, how they see themselves, and what they expect from others tend to surface most. Ages 15-17 -- identity, trust, and expectations about the future are often where this lands hardest; give it real room. Transition: after looking honestly at what grief has influenced, the room asks what hasn't been touched at all.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 8,
  $$Module 8 — What Is Still Here?$$,
  $$Movement: Understanding. Purpose: ask a fundamentally different question after the honest look the room just took. Core idea: what's still here -- love, memory, a friendship, a value, a skill, courage, humor, persistence, a part of who they are, whatever a participant actually recognizes as still present. Activity: What Is Still Here? Facilitator teaching: the Chemistry of Virtue may help give language here -- never scored, never implying it makes up for what was lost. AVAIA never tells a participant who they are; they recognize what belongs. Key distinction: this isn't a silver-lining exercise -- what remains is real on its own, without needing to redeem the loss. Private reflection: no disclosure required; can be entirely private noticing. Developmental adaptation: Ages 8-11 -- concrete prompts work best ("what's something that's still true, even after everything changed?"). Ages 12-14 -- often notice relationships and personal qualities first. Ages 15-17 -- may notice more abstract things, like values or a sense of who they're becoming. Transition: once what remains is visible, the room can return to Audacity -- this time, toward choice.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 9,
  $$Module 9 — The Same Audacity$$,
  $$Movement: Agency. Purpose: return explicitly to Audacity now that the Stone, the Ripples, the Secondary Losses, what's been carried, where grief has had influence, and what remains have all been seen. Core idea: the same force that carried a participant's grief through their life isn't destroyed when they start choosing differently -- it's the same capacity for movement, still available to them. One Audacity, not a Grief Force fighting a Happiness Force. Facilitator teaching: this module is short and structural on purpose -- its whole job is to be the bridge, not to introduce new material. Shared-room experience: the Guide makes this connection explicitly and lets it land before moving on. Developmental adaptation: applies across all bands without much adjustment -- keep it brief at every age; this is a bridge, not a lesson. Transition: this is the bridge into Agency -- the Audacity of Choice.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 10,
  $$Module 10 — The Audacity of Choice$$,
  $$Movement: Agency. Purpose: teach the distinction between what a participant can't control and what they can choose. Core idea: understanding more doesn't create more obligation -- it creates more visibility to choose from. Facilitator teaching: also make room for what might need restoration, what might need to be grieved, what they want, what they don't want, what they're not ready to decide, what boundary they might need, and what they'd like to try. Key distinctions: wanting something doesn't mean it has to be realistic yet; the participant owns the decision, not the Guide, not the room, and not a parent inside this conversation. Optional AVAIA conversation: Youth InnerCompass is the individual Agency conversation inside this module. Guide boundaries: never prescribe forgiveness, reconciliation, a specific friendship decision, or independence versus staying close to family -- Agency means the participant can see more of the territory and choose how to move through it, not that AVAIA chooses for them. Developmental adaptation: Ages 8-11 -- keep choices small and concrete ("is there one thing you get to decide about this?"). Ages 12-14 -- often surfaces choices about friendships, how they respond to a family change, or what they tell people. Ages 15-17 -- may surface real independence questions (what belongs to me vs. my parents, what I'm ready to decide) -- hold this without letting an adult in the room become the decision-maker. Transition: the curriculum closes by naming what carries forward.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 11,
  $$Module 11 — We Don't Move On. We Move With.$$,
  $$Movement: Agency. Purpose: integration and continuity -- what a participant carries out of the room. Activities: The Next Ripple; completing the Ripple Map; the Take-Home Record. Facilitator teaching: no public declaration is required to close the Experience -- participants leave with a private record of what became visible, not a performance of being okay. Private reflection / take-home: the Stone, what changed, secondary losses recognized, what I've been carrying, what grief has influenced, what's still here, what I can't control, what I can choose, what I want to remember, and what I'm not finished with yet. Some fields may stay blank; nothing here is graded for completeness. Developmental adaptation: Ages 8-11 -- a shorter take-home with two or three fields is enough; a drawing or a few words both count as complete. Ages 12-14 -- most of the fields work as written; let them skip anything that doesn't fit. Ages 15-17 -- can usually complete the full record if they want to; never require it. Closing: We don't move on. We move with.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

-- ---------------------------------------------------------------------------
-- Activities -- youth-adapted, referenced by the modules above.
-- ---------------------------------------------------------------------------

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'activity', 1,
  $$The Stone and the Water$$,
  $$A literal or drawn demonstration: drop a stone into still water (or draw one) and watch the rings move outward. The stone is what happened. The rings are everything that changed because of it. Works across all three bands -- younger participants benefit from the physical, literal version; older participants can move straight to drawing or describing their own version.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'activity', 2,
  $$What Else Changed?$$,
  $$A simple, private brainstorm: starting from the one thing that happened, what else changed because of it -- even something that seems small or unrelated? No wrong answers; the point is noticing, not completeness.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'activity', 3,
  $$Before / After / Now$$,
  $$Three private prompts: what was true before this happened, what changed right away, and what's true now. Helps a participant see the shape of the change without having to explain or justify it to anyone.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'activity', 4,
  $$The Invisible Backpack$$,
  $$What has this participant been carrying that other people can't see just by looking at them? Can be answered in words, a list, or a drawing of a backpack with its contents named. Especially effective for ages 8-14, and still useful as a starting prompt at 15-17.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'activity', 5,
  $$The Empty Chair — What's Missing?$$,
  $$A private reflection on what -- or who -- feels missing since the disruption: a person, a routine, a version of a relationship, a sense of safety. Better suited to ages 12-17; for younger participants, The Invisible Backpack usually carries this same territory more concretely.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'activity', 6,
  $$What Has Grief Been Allowed to Decide?$$,
  $$A private set of questions about where the loss may have quietly taken over -- who I think I am, what I expect from friendships, what I've stopped asking for. Blank space, "I don't know," and "nothing" are all complete answers.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'activity', 7,
  $$What Is Still Here?$$,
  $$A private noticing exercise: what remains, unchanged or still true, after everything that happened. Can be a list, a drawing, or a single sentence -- there's no minimum.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'activity', 8,
  $$The Next Ripple$$,
  $$A closing reflection: if the participant makes one intentional choice now, what might it ripple out into later -- for them, and possibly for people around them? Optional and forward-looking, never a commitment they're held to.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

-- ---------------------------------------------------------------------------
-- Facilitator Delivery Guide -- embeds the governing "Guide Discipline"
-- posture explicitly, not just documented elsewhere.
-- ---------------------------------------------------------------------------

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'guide_preparation', 1,
  $$Youth Facilitator Delivery Guide$$,
  $$Guide discipline: leave every session knowing more about what deserves to be seen in this young person, not believing you know more about who they are. A referral or a completed module does not make a young person a problem to solve -- it makes them a person you can now understand a little more of. If you find yourself thinking "now I know what's wrong with this kid," stop and return to: "now I can see more of what this person has been carrying." Communication, not diagnosis: a participant does not need a diagnosis of ADHD, autism, dyslexia, anxiety, or anything else before you accommodate how they communicate -- fragments, tangents, silence, needing to move, very short or very long answers. Different is not deficient; a young person struggling to say something doesn't by itself tell you what the struggle means. What to preserve at every band: the shared/private split, that disclosure is never required, that Secondary Losses and Audacity are recognized rather than diagnosed, and that the participant -- not a parent, not the Guide -- owns their own private conversation and record. What to adapt: pacing, how concrete or abstract your language is, how much you rely on drawing or writing versus talking, and how long you spend on any one module. A younger participant often needs one idea at a time; an older one may want to move faster or go deeper than expected -- follow the actual person in front of you, not their age on paper. Presence of a parent or guardian: if a parent or guardian is present for any part of delivery, they observe the shared-room portions only -- they are never inside a participant's private reflection, private AVAIA conversation, or private written record, and they are never the one who decides what a participant's answers mean. Transition to independence: some participants, especially older ones, may be sitting inside a real tension about how much independence they're ready for, sometimes held alongside their own parent's fear of letting go. Don't resolve that tension for them, and don't let a parent become the decision-maker inside the participant's own conversation. Not-therapy boundary: if a genuine safety concern appears, step out of the curriculum entirely and follow AVAIA's youth safety guidance -- the same standard as any other AVAIA Youth conversation.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

-- ---------------------------------------------------------------------------
-- Participant Guide -- private, second-person, developmentally flexible.
-- ---------------------------------------------------------------------------

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'participant_guide', 1,
  $$Your Own Ripple$$,
  $$This page is yours. Nothing on it has to be shown to anyone -- not your Guide, not a parent, nobody. Write, draw, or say the answers however works best for you. THE STONE: What happened? You don't have to explain it perfectly, or at all if you don't want to. THE RIPPLES: What changed right away, once it happened? WHAT ELSE CHANGED: Has anything else quietly changed since then -- how you feel about trust, safety, friendships, or who you are? Name whatever fits; leave the rest blank. THE INVISIBLE BACKPACK: What have you been carrying because of this that other people might not be able to see? BEFORE / AFTER / NOW: What was true before? What changed? What's true now? WHAT HAS THIS BEEN ALLOWED TO DECIDE: Has this quietly had a say in who you think you are, what you expect from people, or what you feel allowed to want? "I don't know" and "nothing" both count as real answers. WHAT'S STILL HERE: What's still true, still yours, still standing, even after everything? YOUR OWN STRENGTH: Where has your own strength shown up in all of this -- even if it looked like anger, or pulling away, or just getting through the day? It still counts. WHAT I CAN'T CONTROL: Say it plainly. WHAT I CAN CHOOSE: Even something small. THE NEXT RIPPLE: If you make one choice now, what might it lead to later? Nothing on this page needs to be finished to count. We don't move on. We move with.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

-- ---------------------------------------------------------------------------
-- Take-Home Record.
-- ---------------------------------------------------------------------------

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'take_home', 1,
  $$Take-Home Record$$,
  $$THE STONE — What happened, in my own words. WHAT CHANGED FIRST — The changes I noticed right away. THE RIPPLES I CAN SEE NOW — Other changes that became visible to me. WHAT I'VE BEEN CARRYING — Fears, questions, roles, or expectations connected to it. WHAT THIS HAS BEEN ALLOWED TO DECIDE — Places I notice it may have had a quiet say -- who I am, what I trust, what I expect. WHAT'S STILL HERE — People, memories, strengths, or things that remain true. WHAT I CAN'T CONTROL — Things outside my ownership. WHAT I CAN CHOOSE — My next step, from where I actually stand now. WHAT I WANT TO REMEMBER — What I don't want this to let me forget. WHAT I'M NOT FINISHED WITH — A thread I might come back to later.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

-- ---------------------------------------------------------------------------
-- Format variants. Only the individual Guide-facilitated path (already
-- built and live via /toolkit/youth-defying-grief) is offered without
-- qualification. Any group/institutional format explicitly names the
-- separate decision it's waiting on, mirroring the adult curriculum's own
-- "Safeguarded" precedent for its Youth stub.
-- ---------------------------------------------------------------------------

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'format_variant', 1,
  $$Guide-facilitated individual session$$,
  $$Shared experience: one-on-one with a certified Guide, working through as many of Modules 1 through 11 as fit the participant's capacity and available time -- there is no fixed pacing; a single session may cover only Modules 1 through 3, with later modules picked up in a future session. Private AVAIA layer: Youth IAP, CAT, and InnerCompass, in the same order every Youth Journey already uses, opened at whatever point in the curriculum genuinely fits. Take-home: Your Own Ripple and the Take-Home Record, at whatever depth the participant completes. This is the only format currently built end-to-end -- started from the Guide Toolkit's Youth Defying Grief entry.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'format_variant', 2,
  $$Group workshop presentation (not yet delivery-ready)$$,
  $$Shared experience: Modules 1 through 6, presented to a group of young participants together, closing with a private individual reflection. Private AVAIA layer: individual Youth IAP available afterward, one-on-one. Take-home: Your Own Ripple. Not yet delivery-ready: a group format for minors raises guardian-consent, supervision, and group-safety questions this migration does not resolve -- see the "Guardian, consent, and institutional delivery" boundary above. This row exists to hold the shape of the format, not to authorize running it.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;
