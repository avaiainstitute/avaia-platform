-- Defying Grief Master Curriculum.
--
-- The prior connection pass bridged Ripple and Audacity but left the
-- Experience still structured as three broad "Days," each folding several
-- distinct ideas into one movement -- not yet a teachable, module-by-module
-- curriculum a facilitator could actually open and run. This migration
-- restructures the movement layer into eleven named modules (the same
-- governing sequence approved for the program), adds a real Facilitator
-- Delivery Guide and a private Participant Guide, expands the Take-Home
-- Record with the three additional fields the modules now produce, and
-- remaps all seven format variants onto the new module numbers.
--
-- Every existing activity, the Ten Secondary Losses reference, the
-- Shared-Room Rule, Presenter Freedom, and the Ripple Map keep their
-- existing rows untouched -- this migration only touches `movement`,
-- `format_variant`, and `take_home` bodies (via UPDATE, reusing the same
-- three existing movement row ids rather than deleting them), and adds
-- two new section types of content. Status stays 'draft' throughout --
-- nothing here changes experiences.status.
--
-- One schema change: `section_type` gains a fourteenth value,
-- 'participant_guide', for the new private participant-facing sequence --
-- the same widen-the-enum idiom already used once before on this exact
-- column (see 0021's own header comment about adding 'reference'), and
-- elsewhere in this schema for guide_platform_authorizations.capability.

alter table public.experience_sections drop constraint if exists experience_sections_section_type_check;
alter table public.experience_sections add constraint experience_sections_section_type_check
  check (section_type in (
    'orientation','governing_distinction','anchor','movement','question',
    'reference','activity','conversation_window','guide_preparation',
    'boundary','take_home','format_variant','success_definition',
    'participant_guide'
  ));

-- ---------------------------------------------------------------------------
-- Modules 1-3: reuse the three existing movement rows (positions 1-3),
-- updated in place rather than replaced, so the row ids that already exist
-- in the Guide Toolkit continue to exist.
-- ---------------------------------------------------------------------------

update public.experience_sections es
set title = $$Module 1 — What Is Grief?$$,
    body = $$Movement: Awareness. Purpose: give participants a broader way to recognize grief before asking them to do anything with it. Core idea: grief is not limited to death — it is what shows up whenever something real was disrupted. Facilitator teaching: loss or disruption can involve a person, a relationship, health, identity, safety, trust, home, family, dreams, expectations, opportunity, belief, the future, control, belonging, or a version of life someone expected to have — offered as illustration only, never a checklist. The participant decides what belongs. Key distinction: the event or disruption itself is not the same thing as everything that changed because of it; that second category is where the next module begins. Shared-room experience: the presenter widens the room's definition of grief before any private work is asked of anyone. Private reflection: participants privately name, in their own words or simply to themselves, what disruption they are bringing into the room today — nothing shared aloud, nothing required. No activity or AVAIA conversation opens yet. Transition: once grief has been widened past death alone, the room is ready to ask what Defying Grief actually means.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'movement' and es.position = 1
returning es.id, es.title;

update public.experience_sections es
set title = $$Module 2 — What Is Defying Grief?$$,
    body = $$Movement: Awareness. Purpose: teach what Defying Grief is and is not before any private work begins. Core idea: Defying Grief means the loss does not get unquestioned authority over the rest of a life — it is not resolving grief, and it does not require moving on. Key distinctions: Defying Grief is not getting over it, not moving on, not forgetting, not pretending, not replacing what was lost, not becoming happy on command, not denying pain, not "fixing" grief, not returning to who someone was before, and not ranking one loss against another. Facilitator teaching: the program's own identity — Defying Grief: A Sacred Rebellion — names this directly; one way to say the distinction plainly is that a person can honor what happened without surrendering every future decision to it, though a presenter is free to use whatever established AVAIA language lands best for their room. Shared-room experience: the presenter states plainly, once, what this room will and will not ask of anyone. Private reflection: none required yet. Transition: with the meaning of Defying Grief established, the room is ready to look at what actually happened — the Stone.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'movement' and es.position = 2
returning es.id, es.title;

update public.experience_sections es
set title = $$Module 3 — The Stone and the Ripples$$,
    body = $$Movement: Awareness. Purpose: teach the Ripple/Stone architecture fully, and let each participant begin building their own map of it. Core idea: the Stone is the original event, disruption, loss, or point of impact; the Ripples are everything that began changing outward from it. Activities: The Stone and the Water; What Else Changed?; Before / After / Now. Shared-room experience: the room learns the metaphor together and practices it on a shared, low-stakes example before turning it on anything private. Private reflection: a private Point-of-Impact reflection — participants name the disruption they want to bring, without being required to disclose it publicly — and the beginning of an individual Ripple Map (the center and the first ring: what changed right away). This is individual work happening inside a shared room; no map is shown to anyone else. Optional AVAIA conversation: IAP may open here, or be held until later, depending on the format's length. Guide boundaries: no ranking whose stone was bigger; no assigning a ripple to a participant who hasn't found it themselves. Transition: what changed is now visible — the next module asks what it quietly took alongside it.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'movement' and es.position = 3
returning es.id, es.title;

-- ---------------------------------------------------------------------------
-- Modules 4-11: new movement rows, positions 4-11.
-- ---------------------------------------------------------------------------

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 4,
  $$Module 4 — The Things We Lose After the Loss$$,
  $$Movement: Understanding. Purpose: introduce the Ten Secondary Losses through recognition, not lecture. Core idea: the thing a person thought they were grieving may not be the only thing they have been carrying. Facilitator teaching: use the canonical AVAIA Secondary Loss framework exactly, offered as ten possible categories of what a loss can quietly take alongside the one already named — meaning, reality, dreams or opportunities, self-trust, decision-making or boundaries, life vision, connection, control, identity, attachment or support. Key distinction: this is recognition language, not a memorization exercise or a checklist to complete. Activities: The Invisible Backpack; continue the Ripple Map (the second ring: Secondary Losses). Private reflection: losses may stack, overlap, or remain unclear — blank space is allowed, "I don't know" is allowed, and nothing is assigned to a Host who hasn't recognized it themselves. Optional AVAIA conversation: IAP or early CAT time may continue privately here. Transition: once what was lost is named, the room is ready to ask what all of it has been asking the participant to carry.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 5,
  $$Module 5 — What Have I Been Carrying?$$,
  $$Movement: Understanding. Purpose: move from what changed to what the participant has actually been carrying because of it. Core idea: naming the weight — which may include expectations, fear, guilt, responsibility, identity, anger, an unfinished conversation, anticipated responses from others, roles, beliefs, boundaries, memories, loyalty, decisions, things never said, or things never received. Facilitator teaching: this is Table language — what has taken a seat at this person's table without necessarily being invited. Activities: continue The Invisible Backpack; The Empty Chair — What Is Missing?; continue the Ripple Map (the third ring: what I have been carrying). Optional AVAIA conversation: IAP is available here as a private, individualized tool — IAP is not the module, and the shared curriculum continues for every participant whether or not they choose to use it. Private reflection: no disclosure required; the Empty Chair activity in particular stays entirely private unless a participant chooses otherwise. Transition: carrying this weight is itself a kind of power — the room is ready to name the force behind it.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 6,
  $$Module 6 — What Is Audacity?$$,
  $$Movement: Understanding. Purpose: a real shared-room teaching module on Audacity — not something hidden inside a private conversation. Core idea: Audacity of Grief and Audacity of Happiness are not two forces. They are the same Audacity, expressed in different directions; the difference is direction, intention, and use, never which force is present. Facilitator teaching: help participants recognize how powerful grief actually is — it can move attention, identity, relationships, behavior, choices, belief, energy, and future expectations. Examples such as anger, bitterness, withdrawal, addiction, destructive behavior, numbness, or shutting down may be used carefully, for recognition only — never to diagnose, never implied to apply to everyone in the room, and never to shame. Key distinction: if this force is real enough to move a life in one direction, the existence of the force itself matters — that recognition comes before any question of direction. Do not move directly to "therefore choose happiness"; that decision belongs to a later module. Shared-room experience: the presenter names Audacity once, clearly, as a real and morally neutral force, then lets the room sit with recognizing it rather than resolving it. Optional AVAIA conversation: CAT may open or continue here. Transition: recognizing the force raises a harder question — where has it already been deciding things.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 7,
  $$Module 7 — What Has Grief Been Allowed to Decide?$$,
  $$Movement: Understanding. Purpose: help participants recognize where grief, disruption, fear, or expectation may have quietly gained authority over parts of their life. Core idea: some of what feels fixed may actually be a decision grief has been making by default, not a fact about the world. Facilitator teaching: possible areas to consider include who I am now, what relationships feel possible, who I trust, what I feel allowed to want, what future feels possible, what decisions I avoid, what I believe I have to carry, what I will never risk again, what I expect from others, what I have stopped asking for, what part of myself I have stopped including, what feels impossible now, and what has quietly become "just the way it is." Offered as possibilities, never as interrogation, and never as blame — this is not "what did grief ruin," and it is never framed as something a Host allowed to happen. Key distinction: separate what I actually know from what I merely expect, and both from what I have not yet actually discovered. Activity: What Has Grief Been Allowed to Decide? — private, with blank space, "I don't know," and "nothing" all explicitly valid answers. Optional AVAIA conversation: CAT is the natural home for this — CAT is not the curriculum, it is an individualized Understanding conversation inside it. Transition: after looking honestly at what grief has influenced, the room is ready to ask what has not been touched at all.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 8,
  $$Module 8 — What Is Still Here?$$,
  $$Movement: Understanding. Purpose: ask a fundamentally different question after the honest look the room has just taken. Core idea: what is still here — love, memory, relationship, meaning, values, capacities, courage, tenderness, persistence, wisdom, connection, integrity, other virtues, parts of identity, possibility, or choice, whatever a participant actually recognizes as still present. Activity: What Is Still Here? Facilitator teaching: Chemistry of Virtue may support recognition here — never scored, and never implied to compensate for what was lost. AVAIA does not say "this is who you are"; the participant recognizes what belongs. Key distinction: this is not a silver-lining exercise — recognition of what remains stands on its own, without needing to redeem the loss to be real. Private reflection: no disclosure required; this can be entirely private noticing. Transition: once what remains is visible, the room can return to Audacity — this time, toward choice.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 9,
  $$Module 9 — The Same Audacity$$,
  $$Movement: Agency. Purpose: return explicitly to Audacity now that the Stone, the Ripples, the Secondary Losses, what has been carried, where grief has exerted influence, and what remains have all been seen. Core idea: the Audacity that carried grief through a person's life is not destroyed when they begin choosing differently — it is the same capacity for movement, still available. There is one Audacity, not a Grief Force competing against a Happiness Force. Facilitator teaching: this module is short and structural on purpose — its whole job is to be the bridge, not to introduce new material. Shared-room experience: the presenter makes this connection explicitly and lets it land before moving on. Transition: this is the bridge into Agency — the Audacity of Choice.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 10,
  $$Module 10 — The Audacity of Choice$$,
  $$Movement: Agency. Purpose: teach the distinction between what a participant cannot control and what they can choose. Core idea: greater understanding does not create greater obligation — it creates greater visibility from which to choose. Facilitator teaching: also make room for what may need restoration, what may need to be grieved, what a person may carry differently, what may remain unresolved, what they want, what they do not want, what they are not ready to decide, what boundary they may need, and what possibility they want to explore. Key distinctions: wanting something does not require it to be feasible; the Host owns the decision, not the presenter, not the room. Optional AVAIA conversation: InnerCompass is the individualized Agency conversation inside this module. Guide boundaries: do not prescribe happiness, reconciliation, forgiveness, relationship continuation, or any specific action — Agency means the Host can see more of the territory and choose how to walk it, not that the territory itself changes. Transition: the curriculum closes by naming what carries forward.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss'
returning id, title;

insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'movement', 11,
  $$Module 11 — We Don't Move On. We Move With.$$,
  $$Movement: Agency. Purpose: integration and continuity — what a participant carries out of the room. Activities: The Next Ripple; completing the Ripple Map; the Take-Home Record; an evening or closing Head & Heart / Workbook reflection where the format allows it. Facilitator teaching: no public declaration is required to close the experience; participants leave with a private record of what became visible, not a performance of resolution. Private reflection / take-home: Point of Impact, What Changed, Secondary Losses Recognized, What I Have Been Carrying, What Grief Has Influenced, What Is Still Here, What May Need Restoration, What May Need to Be Grieved, What I Cannot Control, What I Can Choose, What I Want to Remember, What I Want to Explore Next, and When the Ripple Returns. Some fields may stay blank; nothing here is graded for completeness. Closing: We don't move on. We move with.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss'
returning id, title;

-- ---------------------------------------------------------------------------
-- Facilitator Delivery Guide -- a third, substantial guide_preparation row,
-- alongside the existing "Presenter Freedom" and "Certified Guide
-- Preparation" rows (both untouched).
-- ---------------------------------------------------------------------------
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'guide_preparation', 3,
  $$Facilitator Delivery Guide$$,
  $$Purpose of each module: every module exists to teach one recognizable idea and open one piece of private territory — never both a shared lecture and a forced disclosure. What must be preserved in every delivery: the shared/private split, the non-disclosure protection, the recognition-not-diagnosis posture toward Audacity and Secondary Losses, and the Host's ownership of every private conversation and record. What can be adapted: pacing, personal storytelling, which activities get full time versus a brief mention, and how much of each module's language is spoken versus handed out in writing. Suggested transitions: each module ends with its own transition line — use it, or use your own words for the same idea; the sequence matters more than the exact phrasing. Personal storytelling: a presenter's own story is welcome and often does real work, but should never become the model every participant is expected to match — mix death and non-death losses in examples so the room doesn't narrow around one kind of grief. Humor: can create real humanity when it comes from genuine warmth, not when it minimizes what someone is carrying — read the room before reaching for it. Inviting participation without requiring disclosure: ask questions the room can answer silently or in writing as easily as aloud; when you do open the floor, always offer a way to pass. Introducing private AVAIA conversation time: name it plainly as optional, individual, and private — nobody else in the room sees it, and finishing it is never required to stay in the room. What to do while participants are privately using AVAIA: hold the shared space quietly; don't hover, don't peek, don't require a report-back. Bringing the room back together: a simple verbal or visual signal is enough; don't ask what anyone worked on. Someone who chooses not to participate in an activity: that is a complete and acceptable choice — never single them out, never ask why. Protecting the Table: the presenter's job is the architecture and the room's safety, not any individual's outcome or decision. Capacity and pause protections: anyone may step out, sit out, or stop at any point without explanation. Not-therapy boundary: this experience is guided and virtue-centered, not therapy, counseling, or crisis care — if a genuine crisis appears, step out of the curriculum entirely and follow AVAIA's crisis guidance, the same as any other AVAIA conversation.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss'
returning id, title;

-- ---------------------------------------------------------------------------
-- Participant Guide -- new section_type, one private, second-person
-- sequence a participant can complete without showing it to anyone.
-- ---------------------------------------------------------------------------
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'participant_guide', 1,
  $$Your Own Ripple$$,
  $$This page is yours. Nothing on it has to be shown to anyone. THE STONE: In your own words, what happened? You don't have to explain it perfectly. THE RIPPLES: What changed right away, once it happened? SECONDARY LOSSES: Beyond the loss itself, has anything else quietly changed — meaning, trust, a sense of control, connection, a piece of your identity, or something else? Name whatever actually fits; leave the rest blank. THE INVISIBLE BACKPACK: What have you been carrying because of this, that other people might not see? BEFORE / AFTER / NOW: What was true before? What changed? What is true now? WHAT HAVE I BEEN CARRYING: Expectations, fear, guilt, responsibility, anger, an unfinished conversation, a role, a belief, a boundary, a memory, something never said — what belongs here for you? WHAT HAS GRIEF BEEN ALLOWED TO DECIDE: Has this loss quietly had a say in who you think you are now, what relationships feel possible, who you trust, what you feel allowed to want, or what future feels possible? "I don't know" and "nothing" are both real answers. WHAT IS STILL HERE: What remains — a quality, a relationship, a value, a capacity, love, a part of yourself you can still recognize? AUDACITY: Where has your own force shown up in all of this — as anger, as withdrawal, as persistence, as hope, as something else? It's the same force either way. WHAT I CANNOT CONTROL: Name it plainly. WHAT I CAN CHOOSE: Even something small. THE NEXT RIPPLE: What might one intentional choice affect, beyond the immediate decision? TAKE-HOME: Carry forward whatever from this page is actually true for you — nothing here required completion, and nothing here is finished just because the page is. We don't move on. We move with.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss'
returning id, title;

-- ---------------------------------------------------------------------------
-- Take-Home Record -- expanded with three new fields the modules now
-- produce (What Grief Has Influenced, What I Want to Remember, What I Want
-- to Explore Next). Every original field is preserved verbatim.
-- ---------------------------------------------------------------------------
update public.experience_sections es
set body = $$THE POINT OF IMPACT — The loss or disruption I chose to bring. WHAT CHANGED FIRST — The immediate changes I recognized. THE RIPPLES I CAN SEE NOW — Secondary changes that became visible to me. WHAT I HAVE BEEN CARRYING — Responsibilities, questions, fears, hopes, roles, habits, or expectations connected to those changes. WHAT GRIEF HAS INFLUENCED — Places I recognize this loss may have quietly had a say — identity, relationships, trust, what I want, or what I believe is possible. WHAT IS STILL HERE — People, memories, virtues, abilities, commitments, meaning, possibilities, or support that remain. WHAT MAY NEED RESTORATION — Areas I may want to rebuild, reconnect, practice, protect, or understand differently. WHAT MAY NEED TO BE GRIEVED — Things I cannot restore by effort or decision. WHAT I CANNOT CONTROL — Outcomes, other people's participation, the past, timing, certainty, or other realities outside my ownership. WHAT I CAN CHOOSE — My next participation from the ground I can see now. WHAT I WANT TO REMEMBER — What I don't want this experience to let me forget. WHAT I WANT TO EXPLORE NEXT — A thread I'm not finished with yet. WHEN THE RIPPLE RETURNS — How I want to respond when this loss becomes newly visible again.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'take_home'
returning es.id, es.title;

-- ---------------------------------------------------------------------------
-- Format variants -- remapped onto the eleven modules. The Youth adaptation
-- (a separate, safeguarded architecture) is deliberately left untouched.
-- ---------------------------------------------------------------------------
update public.experience_sections es
set body = $$Shared experience: Modules 2, 3, and 6 — What Is Defying Grief?, The Stone and the Ripples (introduced, not individually built), and What Is Audacity? — closing with a brief version of Module 10's core question, What Can I Choose? Private AVAIA layer: one brief private reflection only; no requirement to complete IAP, CAT, or InnerCompass in this format. Take-home: one recognition question.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'format_variant' and es.title = $$20–30 minute presentation$$
returning es.id, es.title;

update public.experience_sections es
set body = $$Shared experience: Modules 2 through 6, plus Module 8 (What Is Still Here?) and a shortened Module 10 (Agency). Private AVAIA layer: individual Ripple Map and Secondary Loss recognition throughout; optional IAP or a follow-up Journey afterward. Take-home: Personal Ripple Map.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'format_variant' and es.title = $$60–90 minute workshop$$
returning es.id, es.title;

update public.experience_sections es
set body = $$Shared experience: Modules 1 through 8, in full. Private AVAIA layer: IAP encouraged during the session; CAT can continue afterward. Take-home: expanded map plus a continuity question.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'format_variant' and es.title = $$Half-day workshop$$
returning es.id, es.title;

update public.experience_sections es
set body = $$Shared experience: Day One covers Modules 1 through 5 (Awareness); Day Two covers Modules 6 through 10, closing with Module 11 (Understanding through Agency). Private AVAIA layer: IAP → CAT across the two days; InnerCompass opening as appropriate. Take-home: Take-Home Record plus a first choice.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'format_variant' and es.title = $$2-day retreat$$
returning es.id, es.title;

update public.experience_sections es
set body = $$Shared experience: the full eleven-module arc — Day One: Modules 1 through 3 (Awareness); Day Two: Modules 4 through 9 (Understanding); Day Three: Modules 10 through 11 (Agency). Private AVAIA layer: IAP → CAT → InnerCompass, integrated naturally across the three days. Take-home: complete Take-Home Record plus a return-home plan.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'format_variant' and es.title = $$3-day retreat$$
returning es.id, es.title;

update public.experience_sections es
set body = $$Shared experience: Modules 1, 2, 3, and 4 — shared language for many kinds of loss, without requiring any private disclosure. Private AVAIA layer: private Journeys available afterward, without public disclosure. Take-home: recognition plus a path to continue.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'format_variant' and es.title = $$Community / grief event$$
returning es.id, es.title;
