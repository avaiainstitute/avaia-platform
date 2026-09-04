-- AVAIA View From Above -- class content, classes 1-5 (of 10).
-- Continues 0055. See that migration's header for the full source-
-- discipline note; every hike_lesson row below repeats the essential
-- disclosure inline so it stands on its own if read in isolation.

-- ===========================================================================
-- CLASS 1 -- The Loss of Meaning (Virtue Family: Gratitude)
-- ===========================================================================
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, v.section_type, v.position, v.title, v.body, 'published'
from public.experiences e
cross join (values

  ('orientation', 1, $$What This Class Is$$,
   $$A class about the question that arrives first, and hardest, after anything real is disrupted: what is the point? Not answered for the participant -- opened, so they can find their own answer, or sit honestly with not yet having one.$$),

  ('orientation', 2, $$What This Class Teaches$$,
   $$This class helps someone learn that meaning is not something you either have or don't have -- it's something you can actively look for, name, and practice gratitude toward, even inside circumstances that don't make sense yet.$$),

  ('hike_lesson', 1, $$The Hike Lesson$$,
   $$Source note, stated plainly: the only verbatim material recovered from Dorian's memoir "The View From Above" is its Prologue and the opening of Chapter 1 -- both are told once, in full, on the View From Above collection page, as the shared origin story behind all ten classes. This class's own chapter-level scene could not be independently recovered; the archive holds it only as an unreteanscribed audiobook chapter and video, with no transcript and no transcription capability available here. What follows is Dorian's own directly-supplied recognition and lesson for this class, given in his own words, not further invented narrative. Original recognition: "What is the point?" Dorian's lesson: "I need to find meaning in life and be able to be grateful in all situations."$$),

  ('question', 1, $$The Human Question$$,
   $$What is the point?$$),

  ('anchor', 1, $$Anchor$$,
   $$I need to find meaning in life and be able to be grateful in all situations.$$),

  ('reference', 1, $$The Virtue Family — Gratitude$$,
   $$Gratitude's canonical elements: Appreciation, Gratefulness, Thankfulness. Every person already carries the full Chemistry of Virtue, including Gratitude -- this class does not teach someone to acquire it. It asks what Gratitude can help a person notice right now, which elements already feel awake, and which might need waking up. Gratitude is not the absence of loss and not a replacement for it -- it is a way of staying in relationship with what is still real and still here, alongside what isn't.$$),

  ('reference', 2, $$Stories & Examples$$,
   $$Dorian's own hike is the origin of this entire collection, told in full on the collection page -- a father returning, one year later, to the mountain his son never came down from, and finding he could still feel gratitude for a text message that arrived just before everything changed: "Talk about a view." Beyond that verbatim material, a Guide or presenter may illustrate this class with other real examples of finding meaning inside disruption -- a career ending without warning, a diagnosis, a move no one chose -- but should say plainly when an example is illustrative rather than part of Dorian's own recovered story, so the two are never blurred together.$$),

  ('movement', 1, $$What This Class Does$$,
   $$Movement: Awareness. Purpose: give a person room to sit honestly with "what is the point," without rushing them toward an answer. Core idea: meaning is not discovered once and settled -- it is a practice a person returns to, especially when circumstances stop making sense. Facilitator teaching: distinguish between meaning that already existed and was disrupted, and meaning that gets built afterward, sometimes out of the disruption itself -- both are real, and a person may be in either place, or between them. Key distinction: gratitude in this class is never used to minimize what was lost ("at least...") -- it sits alongside the loss, not instead of it. Shared-room experience: the presenter opens with the question "what is the point?" as a real, unresolved question the room is allowed to hold together, not a rhetorical one with an implied answer. Activities: Where I Find Meaning Now; A Gratitude That Doesn't Erase Anything. Private reflection: participants privately name one thing that still feels meaningful to them right now, however small -- nothing shared aloud, nothing required. Optional AVAIA conversation: IAP is available here as a private, individual space to say more. Transition: once meaning has been named honestly, the room is ready to ask what actually feels real right now -- which the next class in the collection takes up directly.$$),

  ('guide_preparation', 1, $$Shared Teaching$$,
   $$Open by naming the question plainly: "What is the point?" is not a question this class answers for anyone -- it's a question worth being honest about, together, before trying to resolve it. Teach the distinction between meaning found and meaning built: some meaning was already present before a disruption and simply needs to be re-recognized; some meaning genuinely didn't exist before and gets built afterward, often slowly, out of choices a person makes about how to carry what happened. Neither is more legitimate than the other. When teaching Gratitude, be explicit that this is not "positive thinking" or a demand to feel thankful for the loss itself -- it is the practice of staying able to notice what is still real and still good, even in the same breath as naming what isn't. Watch for a room that wants to rush to resolution ("everything happens for a reason") -- gently slow that down; premature meaning-making can foreclose a person's own honest search. Give real space for "I don't know what the point is right now" as a complete, acceptable answer.$$),

  ('participant_guide', 1, $$Personal Recognition$$,
   $$This page is yours. Nothing on it has to be shown to anyone. WHAT IS THE POINT, FOR ME, RIGHT NOW: Not the point of everything -- just the point of continuing to show up today. WHAT STILL FEELS MEANINGFUL: Name one thing, however small, that still matters to you. WHAT I AM GRATEFUL FOR, WITHOUT PRETENDING: Something real, that doesn't require you to minimize anything else. WHERE MEANING WAS DISRUPTED: What used to feel meaningful that doesn't anymore, or feels harder to access. WHAT I MIGHT BE BUILDING: Is there any meaning that's forming now that wasn't there before? "Not yet" is a real answer.$$),

  ('activity', 1, $$Chemistry Recognition Activity$$,
   $$Participants are offered the three canonical Gratitude elements -- Appreciation, Gratefulness, Thankfulness -- not as a test, but as three different doors into the same room. Ask: which of these feels most awake in you right now? Which feels furthest away? There is no required answer, and a participant may recognize none of them yet -- that is real data, not a failure to complete the activity.$$),

  ('activity', 2, $$Practice — Waking This Up in Ordinary Life$$,
   $$A simple, repeatable practice: once a day, name one specific thing that is still real and still good, out loud or in writing, without adding "but" to the end of the sentence. Not a gratitude list for its own sake -- a practice of letting one true, good thing stand on its own, unqualified, even on a day when much else is also true and hard.$$),

  ('conversation_window', 1, $$Awareness — IAP$$,
   $$Individual Awareness Profile. Saying, in your own words, what feels disrupted right now and what -- if anything -- still feels meaningful.$$),

  ('conversation_window', 2, $$Understanding — CAT$$,
   $$Conversations Across Time. Following where meaning has changed, what it's connected to, and where Gratitude already shows up in your own life without you calling it that.$$),

  ('conversation_window', 3, $$Agency — InnerCompass$$,
   $$InnerCompass. What you want to actively practice, notice, or build going forward -- not a resolution, a direction.$$),

  ('take_home', 1, $$Take-Home$$,
   $$WHAT IS THE POINT, FOR ME, TODAY — WHAT STILL FEELS MEANINGFUL — WHAT I AM GRATEFUL FOR, WITHOUT PRETENDING — WHERE MEANING WAS DISRUPTED — WHAT I MIGHT BE BUILDING — ONE PRACTICE I WANT TO TRY THIS WEEK.$$),

  ('success_definition', 1, $$What Becomes Possible$$,
   $$Not a promise that meaning arrives on schedule, or that gratitude fixes what was lost. What can become possible is a person recognizing that they are allowed to look for meaning actively, rather than waiting for it to appear -- and that gratitude and grief, or gratitude and confusion, may become possible to hold in the same hand at the same time.$$),

  ('boundary', 1, $$Shared Room Version & Guide Boundaries$$,
   $$In a Shared Room, this class can be taught to the whole Table at once -- the shared teaching and activities are safe for a group, since nothing requires disclosure. Any participant may step into private processing at any point, exactly as Shared Room's own architecture already allows, and nothing returns to the Room unless they choose to bring it forward. Guide boundaries: never tell a participant what their meaning should be; never imply that a lack of found meaning is a failure of effort or virtue; never use another participant's story as the model everyone in the room should match.$$),

  ('format_variant', 1, $$Short Class (20–30 minutes)$$,
   $$Self-directed: read What This Class Is, the Human Question, and the Virtue Family reference; complete the Personal Recognition page alone. Guide-facilitated: the presenter teaches the Human Question and the meaning-found/meaning-built distinction, then offers the Gratitude Recognition activity; no private AVAIA conversation required in this format.$$),

  ('format_variant', 2, $$Full Class (60–90 minutes)$$,
   $$Self-directed: complete the short-class content, then open a private AVAIA conversation (IAP) to go further. Guide-facilitated: full Shared Teaching, both activities, and time for participants to optionally begin a private AVAIA conversation during the session.$$),

  ('format_variant', 3, $$Workshop / Breakout$$,
   $$For a larger group split into smaller tables: each table discusses the Human Question using only the shared, non-disclosing framing (the meaning-found/meaning-built distinction), then reconvenes; private reflection and any AVAIA conversation stay individual, not table-shared.$$),

  ('format_variant', 4, $$School / Youth Lesson$$,
   $$Youth-adapted language: "What is the point?" becomes an accessible, age-appropriate opening (e.g. "what still matters to you, even on a hard day?"). Requires the same guardian-consent and Youth-assent architecture as every other AVAIA Youth offering before any private conversation opens; the shared teaching itself carries no additional safeguard requirement beyond ordinary classroom consent, since it asks for no disclosure.$$),

  ('format_variant', 5, $$Experience / Retreat Segment$$,
   $$As one segment inside a longer AVAIA Experience or retreat: this class's Human Question and Gratitude teaching can open a day, giving the room a shared orientation before deeper, more individual work begins later in the same Experience.$$)

) as v(section_type, position, title, body)
where e.title = $$The Loss of Meaning$$;

-- ===========================================================================
-- CLASS 2 -- The Loss of Reality (Virtue Family: Humility)
-- ===========================================================================
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, v.section_type, v.position, v.title, v.body, 'published'
from public.experiences e
cross join (values

  ('orientation', 1, $$What This Class Is$$,
   $$A class about the disorientation that follows when something you were sure of turns out not to hold -- when foundational beliefs get questioned or disrupted, and you're no longer certain what's real.$$),

  ('orientation', 2, $$What This Class Teaches$$,
   $$This class helps someone learn that not knowing what's real anymore is not a personal failure of understanding -- it is a real, survivable stage that Humility can move through, without requiring premature certainty in either direction.$$),

  ('hike_lesson', 1, $$The Hike Lesson$$,
   $$Source note, stated plainly: only the Prologue and the opening of Chapter 1 of "The View From Above" were recovered as verbatim text -- told in full on the collection page. This class's own chapter-level scene exists in the source archive only as unreteanscribed audio and video; it could not be independently recovered or verified, and nothing further is invented here. What follows is Dorian's own directly-supplied recognition and lesson for this class. Original recognition: "What is real to me anymore? So many things do not make sense. Foundational beliefs can be questioned or disrupted." Dorian's lesson: the willingness to let that disruption be real, without forcing false certainty back into place too soon.$$),

  ('question', 1, $$The Human Question$$,
   $$What is real to me anymore?$$),

  ('anchor', 1, $$Anchor$$,
   $$So many things do not make sense. Foundational beliefs can be questioned or disrupted.$$),

  ('reference', 1, $$The Virtue Family — Humility$$,
   $$Humility's canonical elements: Modesty, Unpretentious, Meekness, Sincerity. Every person already carries Humility, whether or not it feels awake right now. This class asks what Humility can help a person notice: the willingness to say "I don't know what's real anymore" out loud, without treating that honesty as weakness. Humility here is not about smallness -- it's about sincerity in the face of genuine uncertainty.$$),

  ('reference', 2, $$Stories & Examples$$,
   $$Dorian's own account -- told in full on the collection page -- describes driving the same road a year after his son's death and finding that ordinary, once-certain things (a familiar road, a fishing memory, a sound overhead) had stopped meaning what they used to mean; reality itself had to be relearned in pieces. Beyond that recovered material, a presenter may use other real examples of foundational disruption -- a divorce, a faith crisis, a diagnosis that upends a life plan -- clearly marked as illustrative, not as further detail from Dorian's own story.$$),

  ('movement', 1, $$What This Class Does$$,
   $$Movement: Awareness. Purpose: normalize the disorientation of not knowing what's real anymore, rather than rushing a person back to certainty. Core idea: some beliefs that felt foundational may need to be genuinely re-examined, not just reasserted more firmly. Facilitator teaching: distinguish between beliefs that turn out to still be true once re-examined honestly, and beliefs that genuinely need to change -- both outcomes are legitimate, and the class does not decide in advance which a participant will find. Key distinction: humility toward uncertainty is not the same as abandoning every belief wholesale; it is the willingness to actually look. Shared-room experience: the presenter names, once, that "I don't know what's real anymore" is a legitimate and common place to be after disruption, not a sign something has gone wrong. Activities: What I Was Sure Of; Re-Examining Without Collapsing. Private reflection: participants privately name one thing they used to be certain of that now feels uncertain -- no disclosure required. Optional AVAIA conversation: IAP is available for going further privately. Transition: once "what's real" has been sat with honestly, the room is ready to ask where it might still be going -- direction, not certainty, is the next class's question.$$),

  ('guide_preparation', 1, $$Shared Teaching$$,
   $$Open by naming that disruption doesn't just take things -- it can take certainty itself, about things that had nothing directly to do with the disruption. Teach the difference between re-examining a belief and abandoning it reflexively: humility means being willing to actually look again, not being obligated to conclude the old belief was wrong. Watch for two opposite over-corrections in a room: forcing old certainty back into place too quickly (denial of the disruption), or concluding nothing can be trusted at all (a different kind of premature certainty). Humility sits in the harder, honest middle: "I'm not sure yet, and I'm willing to find out." Never use this class to challenge a participant's specific beliefs (religious, political, or otherwise) -- the content is about the PROCESS of re-examining, never about which conclusions someone should reach.$$),

  ('participant_guide', 1, $$Personal Recognition$$,
   $$This page is yours. WHAT I WAS SURE OF, BEFORE: Name something -- about the world, about people, about yourself -- that felt solid before. WHAT FEELS UNCERTAIN NOW: What's changed about how sure you feel? WHAT STILL HOLDS: Is there anything that, even after re-examining it, still feels true? WHAT I'M WILLING TO LOOK AT AGAIN: Naming willingness, not conclusions. WHERE I NEED TO NOT RUSH: What might you be tempted to force back into certainty too quickly?$$),

  ('activity', 1, $$Chemistry Recognition Activity$$,
   $$Offer the four canonical Humility elements -- Modesty, Unpretentious, Meekness, Sincerity -- and ask which one already shows up when a participant says "I don't know" out loud. Sincerity often surfaces first in this class; that's real data, not a required outcome.$$),

  ('activity', 2, $$Practice — Waking This Up in Ordinary Life$$,
   $$Once this week, when uncertain about something, say "I don't know yet" out loud instead of defaulting to a quick, confident answer -- and notice what happens in the conversation and in yourself when you do.$$),

  ('conversation_window', 1, $$Awareness — IAP$$,
   $$Individual Awareness Profile. Saying what no longer feels certain, in your own words, without needing to resolve it yet.$$),

  ('conversation_window', 2, $$Understanding — CAT$$,
   $$Conversations Across Time. Following which beliefs are being genuinely re-examined versus which ones are being defended out of habit.$$),

  ('conversation_window', 3, $$Agency — InnerCompass$$,
   $$InnerCompass. What you want to do with what you're discovering -- not forcing a conclusion, choosing how to keep looking.$$),

  ('take_home', 1, $$Take-Home$$,
   $$WHAT I WAS SURE OF, BEFORE — WHAT FEELS UNCERTAIN NOW — WHAT STILL HOLDS — WHAT I'M WILLING TO LOOK AT AGAIN — WHERE I NEED TO NOT RUSH — ONE PRACTICE I WANT TO TRY THIS WEEK.$$),

  ('success_definition', 1, $$What Becomes Possible$$,
   $$Not a promise that certainty returns, or that every disrupted belief gets resolved. What can become possible is a person recognizing that not knowing what's real yet is a real, humble, survivable place to stand -- and that re-examining a belief honestly is not the same as losing it.$$),

  ('boundary', 1, $$Shared Room Version & Guide Boundaries$$,
   $$In a Shared Room, this class can be taught to the whole Table -- the shared teaching does not require anyone to name which specific belief is in question. Guide boundaries: never suggest which conclusion a participant should reach about a disrupted belief; never treat a participant's specific faith, politics, or worldview as the subject of the class itself; protect the process of honest re-examination, not any particular outcome of it.$$),

  ('format_variant', 1, $$Short Class (20–30 minutes)$$,
   $$Self-directed: read the orientation and Virtue Family reference, complete the Personal Recognition page. Guide-facilitated: teach the re-examine-vs-abandon distinction and offer the Humility recognition activity; no private conversation required.$$),

  ('format_variant', 2, $$Full Class (60–90 minutes)$$,
   $$Self-directed: complete the short-class content, then open a private AVAIA conversation. Guide-facilitated: full Shared Teaching plus both activities, with time for an optional private conversation during the session.$$),

  ('format_variant', 3, $$Workshop / Breakout$$,
   $$Smaller tables discuss the shared framing (re-examining vs. abandoning) using a neutral, hypothetical example before any private reflection; nothing personal is required at the table.$$),

  ('format_variant', 4, $$School / Youth Lesson$$,
   $$Youth-adapted language: "what used to make sense that doesn't right now?" — framed around ordinary adolescent disruption (a friendship, a family change), not adult worldview crisis. Same guardian-consent and Youth-assent requirements as every other AVAIA Youth offering before any private conversation.$$),

  ('format_variant', 5, $$Experience / Retreat Segment$$,
   $$As a segment inside a longer Experience: this class can follow The Loss of Meaning, moving the room from "what's the point" toward "what's actually still true" -- the natural next step in the mountain framing.$$)

) as v(section_type, position, title, body)
where e.title = $$The Loss of Reality$$;

-- ===========================================================================
-- CLASS 3 -- The Loss of Dreams / Opportunities (Virtue Family: Positive Attitude)
-- ===========================================================================
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, v.section_type, v.position, v.title, v.body, 'published'
from public.experiences e
cross join (values

  ('orientation', 1, $$What This Class Is$$,
   $$A class about the moment a future you were counting on disappears, changes, or becomes unrecognizable -- and the real work of finding direction again.$$),

  ('orientation', 2, $$What This Class Teaches$$,
   $$This class helps someone learn that losing a specific dream or opportunity is not the same as losing the capacity for direction itself -- Positive Attitude is a practice of hope and expectation that can be rebuilt even when the original plan is gone.$$),

  ('hike_lesson', 1, $$The Hike Lesson$$,
   $$Source note, stated plainly: only the Prologue and the opening of Chapter 1 of "The View From Above" were recovered as verbatim text, told in full on the collection page. This class's chapter-level content exists in the source archive only as unreteanscribed audio and video and could not be independently recovered; nothing further is invented here. What follows is Dorian's own directly-supplied recognition and lesson. Original recognition: "Where am I going?" Dorian's lesson: "I need direction, hope, and positive expectations."$$),

  ('question', 1, $$The Human Question$$,
   $$Where am I going?$$),

  ('anchor', 1, $$Anchor$$,
   $$I need direction, hope, and positive expectations.$$),

  ('reference', 1, $$The Virtue Family — Positive Attitude$$,
   $$Positive Attitude's canonical elements include Joy, Reverence, Cheerfulness, Faith, Beauty, Happiness, Adaptability, Humor, Optimism, Flexibility, Hope, and Zeal. Every person already carries this family. This class asks which elements can help someone notice a new direction becoming visible -- Hope and Adaptability often surface first when an old plan is gone -- without implying a person must feel cheerful about what was lost in order to move.$$),

  ('reference', 2, $$Stories & Examples$$,
   $$Dorian's own account -- told in full on the collection page -- describes deciding, a year after everything changed, to hike the same trail all the way to the top for the first time, a new direction chosen deliberately rather than one that was simply given to him. Beyond that recovered material, a presenter may use other real examples of a disrupted future -- a career path that closes, an opportunity that falls through, a plan that becomes impossible -- clearly marked as illustrative, separate from Dorian's own story.$$),

  ('movement', 1, $$What This Class Does$$,
   $$Movement: Understanding. Purpose: help a person distinguish between the specific dream that was lost and their own underlying capacity for direction, which is not the same thing. Core idea: hope and positive expectation are practices, not permanent traits some people have and others don't -- they can be exercised again after being disrupted. Facilitator teaching: separate "what I wanted to happen" from "what I'm now free or required to consider" -- loss of one specific future does not mean the absence of any future. Key distinction: positive attitude in this class is never a demand to feel good about the loss itself; it's a practice aimed at what comes next, alongside honest grief for what didn't happen. Shared-room experience: the presenter names, once, that finding a new direction after a lost one is real work, not something that should feel automatic or fast. Activities: The Dream That Changed; One New Direction. Private reflection: participants privately name one dream or opportunity that changed, without disclosure required. Optional AVAIA conversation: CAT is available to follow this further privately. Transition: once a new direction starts to feel possible, the room is ready to ask what role the participant actually plays in getting there -- the next class's question.$$),

  ('guide_preparation', 1, $$Shared Teaching$$,
   $$Open by distinguishing the lost dream from the person's underlying capacity for hope and direction -- the first can be real and permanent; the second is not destroyed by it. Teach Positive Attitude as an active practice: choosing to look for what's still possible, without minimizing what specifically didn't happen. Watch for a room that wants to immediately replace the lost dream with a forced substitute ("everything happens for a reason, so now you'll..."); slow that down. Genuine new direction usually takes real time and often looks different from what was lost, not like a replacement of equal size. Make explicit room for a participant who genuinely doesn't yet have a new direction -- "I don't know where I'm going yet" is a complete, valid place to be in this class.$$),

  ('participant_guide', 1, $$Personal Recognition$$,
   $$This page is yours. THE DREAM OR OPPORTUNITY THAT CHANGED: Name it plainly, in your own words. WHAT I ACTUALLY WANTED FROM IT: Underneath the specific plan, what was the deeper hope? WHERE I FEEL DIRECTIONLESS: Where does "where am I going?" feel most unanswered right now? ONE POSSIBILITY, EVEN SMALL: Something that feels even slightly like a direction, however uncertain. WHAT HOPE WOULD LOOK LIKE RIGHT NOW: Not certainty -- just what hope, practiced, would actually look like today.$$),

  ('activity', 1, $$Chemistry Recognition Activity$$,
   $$Offer the Positive Attitude elements and ask which ones already show up, even faintly, when the participant thinks about tomorrow -- Hope, Adaptability, Optimism, and Flexibility often surface here. None is required; naming "none of these feel awake yet" is real and useful data.$$),

  ('activity', 2, $$Practice — Waking This Up in Ordinary Life$$,
   $$Once this week, name one small, real possibility out loud -- not a plan, just a direction worth being curious about -- and take one small, concrete step toward finding out more about it.$$),

  ('conversation_window', 1, $$Awareness — IAP$$,
   $$Individual Awareness Profile. Saying what dream or opportunity changed, and what that's actually meant for you.$$),

  ('conversation_window', 2, $$Understanding — CAT$$,
   $$Conversations Across Time. Following what you actually wanted underneath the specific plan, and where new direction might already be quietly forming.$$),

  ('conversation_window', 3, $$Agency — InnerCompass$$,
   $$InnerCompass. Choosing a next, real step toward a direction you're willing to explore.$$),

  ('take_home', 1, $$Take-Home$$,
   $$THE DREAM OR OPPORTUNITY THAT CHANGED — WHAT I ACTUALLY WANTED FROM IT — WHERE I FEEL DIRECTIONLESS — ONE POSSIBILITY, EVEN SMALL — WHAT HOPE WOULD LOOK LIKE RIGHT NOW — ONE PRACTICE I WANT TO TRY THIS WEEK.$$),

  ('success_definition', 1, $$What Becomes Possible$$,
   $$Not a promise that a new dream arrives quickly, or that it replaces what was lost. What can become possible is recognizing that direction and hope are practices a person can exercise again, even before a new destination is clear.$$),

  ('boundary', 1, $$Shared Room Version & Guide Boundaries$$,
   $$In a Shared Room, this class can be taught to the whole Table -- naming a lost dream stays optional, and the shared teaching itself requires no disclosure. Guide boundaries: never suggest what a participant's new direction should be; never treat someone's lack of a new direction yet as a failure; never compare one person's timeline for finding hope against another's.$$),

  ('format_variant', 1, $$Short Class (20–30 minutes)$$,
   $$Self-directed: read the orientation and Virtue Family reference, complete the Personal Recognition page. Guide-facilitated: teach the lost-dream/underlying-capacity distinction and offer the Positive Attitude recognition activity; no private conversation required.$$),

  ('format_variant', 2, $$Full Class (60–90 minutes)$$,
   $$Self-directed: complete the short-class content, then open a private AVAIA conversation. Guide-facilitated: full Shared Teaching and both activities, with time for an optional private conversation during the session.$$),

  ('format_variant', 3, $$Workshop / Breakout$$,
   $$Smaller tables brainstorm what "practicing hope" can look like in the abstract, using a shared hypothetical example, before individual private reflection.$$),

  ('format_variant', 4, $$School / Youth Lesson$$,
   $$Youth-adapted language: "where do I see myself going?" framed around age-appropriate disruption (a team not made, a school change, a friendship shift). Same guardian-consent and Youth-assent requirements as every other AVAIA Youth offering before any private conversation.$$),

  ('format_variant', 5, $$Experience / Retreat Segment$$,
   $$As a segment following The Loss of Reality: once what's real has been sat with honestly, this class turns the room toward what's still possible from here -- direction after disorientation.$$)

) as v(section_type, position, title, body)
where e.title = $$The Loss of Dreams / Opportunities$$;

-- ===========================================================================
-- CLASS 4 -- The Loss of Self-Trust (Virtue Family: Hard Work)
-- ===========================================================================
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, v.section_type, v.position, v.title, v.body, 'published'
from public.experiences e
cross join (values

  ('orientation', 1, $$What This Class Is$$,
   $$A class about the quiet question that follows disruption: what is my role now? And about rebuilding trust in your own ability to act, follow through, and make a real difference.$$),

  ('orientation', 2, $$What This Class Teaches$$,
   $$This class helps someone learn that self-trust, once shaken, can be rebuilt the same way it's usually built in the first place -- through small, real, followed-through actions, which is exactly what Hard Work as a virtue is made of.$$),

  ('hike_lesson', 1, $$The Hike Lesson$$,
   $$Source note, stated plainly: only the Prologue and the opening of Chapter 1 of "The View From Above" were recovered as verbatim text, told in full on the collection page. This class's chapter-level content exists in the archive only as unreteanscribed audio and video and could not be independently recovered; nothing further is invented here. What follows is Dorian's own directly-supplied recognition and lesson. Original recognition: "What is my role?" Dorian's lesson: "I need to know that what I am doing makes a difference to me and others, and that I can act, work, and follow through."$$),

  ('question', 1, $$The Human Question$$,
   $$What is my role?$$),

  ('anchor', 1, $$Anchor$$,
   $$I need to know that what I am doing makes a difference to me and others, and that I can act, work, and follow through.$$),

  ('reference', 1, $$The Virtue Family — Hard Work$$,
   $$Hard Work's canonical elements include Community, Persistence, Perseverance, Determination, Diligence, Thrift, Discipline, Time, Passion, Endurance, Tenacity, Ambition, Dedication, and Self-reliance. Every person already carries this family. This class asks which elements can help someone notice their own capacity to act and follow through again -- Persistence and Perseverance often surface first after self-trust has been shaken, without implying anyone must "just work harder" to feel better.$$),

  ('reference', 2, $$Stories & Examples$$,
   $$Dorian's own account -- told in full on the collection page -- describes the discipline of actually driving back up the canyon, a year later, to finish the hike he'd only partly managed once before; showing up and following through, even when the outcome was uncertain, was itself the act of rebuilding trust in his own capacity. Beyond that recovered material, a presenter may use other real examples of rebuilding self-trust after it's shaken -- returning to work after a setback, trying again after a failed attempt at something -- clearly marked as illustrative, separate from Dorian's own story.$$),

  ('movement', 1, $$What This Class Does$$,
   $$Movement: Understanding. Purpose: help a person see that self-trust is rebuilt through small, real, completed actions, not through a single act of willpower or a feeling that arrives first. Core idea: "what is my role" is answered by what a person actually does, one real action at a time, not by settling the question abstractly first. Facilitator teaching: distinguish between a role that was lost (a job, a relationship role, a responsibility) and the participant's underlying capacity to have A role, to act and follow through -- the second survives the first. Key distinction: this is not about working harder to prove worth; it's about small, followed-through actions that rebuild evidence a person can trust themselves. Shared-room experience: the presenter names, once, that self-trust returns through repetition, not through a single decision to trust yourself again. Activities: One Thing I Followed Through On; What Makes a Difference. Private reflection: participants privately name one small action they completed recently, without disclosure required. Optional AVAIA conversation: CAT or InnerCompass is available to follow this further privately. Transition: once a person can act and follow through again, the room is ready to ask what it takes to do that safely -- boundaries and decision-making, the next class's question.$$),

  ('guide_preparation', 1, $$Shared Teaching$$,
   $$Open by naming that a shaken sense of role or purpose after disruption is common, not a sign of weak character. Teach that self-trust is built the same way skill is built -- through small, real, completed actions, repeated -- not restored instantly by a single insight or decision. Watch for a room that wants to leap to a large, ambitious "role" right away (a new career, a grand purpose) as a way to avoid the smaller, harder work of trusting yourself with ordinary follow-through first; gently redirect toward the small and concrete. Distinguish "what is my role" (identity-level) from "what is my next action" (agency-level) -- this class works mostly at the second level, on purpose, since it rebuilds the first.$$),

  ('participant_guide', 1, $$Personal Recognition$$,
   $$This page is yours. WHERE I FEEL UNSURE OF MY ROLE: Name where "what is my role now?" feels most unanswered. ONE THING I FOLLOWED THROUGH ON RECENTLY: However small -- name it plainly. WHAT THAT ACTUALLY PROVED: What does that completed action actually tell you about your own capacity? WHO OR WHAT I MAKE A DIFFERENCE TO: Even one person, one place, one small thing. ONE NEXT ACTION: Small enough to actually follow through on.$$),

  ('activity', 1, $$Chemistry Recognition Activity$$,
   $$Offer the Hard Work elements and ask which one already shows up when the participant thinks of something they followed through on recently -- Persistence, Diligence, and Self-reliance often surface here. None is required; noticing which ones feel dormant is equally useful.$$),

  ('activity', 2, $$Practice — Waking This Up in Ordinary Life$$,
   $$Choose one small task this week and follow it through to completion, on purpose, as evidence -- not because the task itself is important, but because completing it rebuilds trust in your own follow-through.$$),

  ('conversation_window', 1, $$Awareness — IAP$$,
   $$Individual Awareness Profile. Saying where your sense of role or purpose feels shaken right now.$$),

  ('conversation_window', 2, $$Understanding — CAT$$,
   $$Conversations Across Time. Following what "making a difference" has actually looked like in your life, including recently.$$),

  ('conversation_window', 3, $$Agency — InnerCompass$$,
   $$InnerCompass. Choosing one real, small action to follow through on next.$$),

  ('take_home', 1, $$Take-Home$$,
   $$WHERE I FEEL UNSURE OF MY ROLE — ONE THING I FOLLOWED THROUGH ON RECENTLY — WHAT THAT ACTUALLY PROVED — WHO OR WHAT I MAKE A DIFFERENCE TO — ONE NEXT ACTION — ONE PRACTICE I WANT TO TRY THIS WEEK.$$),

  ('success_definition', 1, $$What Becomes Possible$$,
   $$Not a promise of a settled, permanent sense of role or purpose. What can become possible is a person rebuilding real evidence, through small completed actions, that they can act and be trusted -- by themselves first.$$),

  ('boundary', 1, $$Shared Room Version & Guide Boundaries$$,
   $$In a Shared Room, this class can be taught to the whole Table -- naming a specific lost role stays optional. Guide boundaries: never assign a participant their "role"; never treat someone's uncertainty about purpose as laziness or lack of effort; never compare one person's pace of rebuilding self-trust to another's.$$),

  ('format_variant', 1, $$Short Class (20–30 minutes)$$,
   $$Self-directed: read the orientation and Virtue Family reference, complete the Personal Recognition page. Guide-facilitated: teach the role-lost/capacity-intact distinction and offer the Hard Work recognition activity; no private conversation required.$$),

  ('format_variant', 2, $$Full Class (60–90 minutes)$$,
   $$Self-directed: complete the short-class content, then open a private AVAIA conversation. Guide-facilitated: full Shared Teaching and both activities, with time for an optional private conversation during the session.$$),

  ('format_variant', 3, $$Workshop / Breakout$$,
   $$Smaller tables discuss what "following through" looks like in general, using a shared hypothetical, before individual private reflection on a real, personal example.$$),

  ('format_variant', 4, $$School / Youth Lesson$$,
   $$Youth-adapted language: "what's something I actually followed through on?" framed around age-appropriate responsibility (schoolwork, a commitment to a friend, a chore). Same guardian-consent and Youth-assent requirements as every other AVAIA Youth offering before any private conversation.$$),

  ('format_variant', 5, $$Experience / Retreat Segment$$,
   $$As a segment following The Loss of Dreams / Opportunities: once a new direction starts to feel possible, this class asks what it takes to actually walk toward it -- follow-through, not just intention.$$)

) as v(section_type, position, title, body)
where e.title = $$The Loss of Self-Trust$$;

-- ===========================================================================
-- CLASS 5 -- The Loss of Decision-Making / Boundaries (Virtue Family: Fortitude)
-- ===========================================================================
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, v.section_type, v.position, v.title, v.body, 'published'
from public.experiences e
cross join (values

  ('orientation', 1, $$What This Class Is$$,
   $$A class about the moment fear, guilt, shame, or doubt start making decisions for you -- and about the Fortitude it takes to know your boundaries and choose from inside them anyway.$$),

  ('orientation', 2, $$What This Class Teaches$$,
   $$This class helps someone learn that fear, guilt, shame, and doubt are real and often reasonable -- but they don't have to be the ones deciding. Fortitude is the practice of choosing anyway, from inside boundaries that keep a person safe.$$),

  ('hike_lesson', 1, $$The Hike Lesson$$,
   $$Source note, stated plainly: only the Prologue and the opening of Chapter 1 of "The View From Above" were recovered as verbatim text, told in full on the collection page. This class's chapter-level content exists in the archive only as unreteanscribed audio and video and could not be independently recovered; nothing further is invented here. What follows is Dorian's own directly-supplied recognition and lesson. Original recognition: "Why do fear, guilt, shame, and doubt keep interfering with decisions?" Dorian's lesson: "I need to know my boundaries and know that I am safe within them."$$),

  ('question', 1, $$The Human Question$$,
   $$What do I choose when fear, guilt, shame, or doubt are present?$$),

  ('anchor', 1, $$Anchor$$,
   $$I need to know my boundaries and know that I am safe within them.$$),

  ('reference', 1, $$The Virtue Family — Fortitude$$,
   $$Fortitude's canonical elements: Courage, Magnanimity, Steadfast, Resilience, Assertive, Confidence, Fearlessness, Independent, Bravery, Valor. Every person already carries this family, including when fear, guilt, shame, or doubt are loud. This class asks which elements can help someone notice they can act despite those feelings, not by eliminating them first -- Steadfast and Assertive often surface first when boundaries are the real question.$$),

  ('reference', 2, $$Stories & Examples$$,
   $$Dorian's own account -- told in full on the collection page -- describes the fear and doubt present in even deciding to drive back up that canyon road, and the courage of going anyway, in the presence of that fear rather than after it disappeared. Beyond that recovered material, a presenter may use other real examples of choosing despite fear, guilt, shame, or doubt -- setting a boundary with a family member, making a hard decision under uncertainty -- clearly marked as illustrative, separate from Dorian's own story.$$),

  ('movement', 1, $$What This Class Does$$,
   $$Movement: Understanding into Agency. Purpose: help a person separate the presence of fear, guilt, shame, or doubt from the decision itself -- the feeling and the choice are not the same event. Core idea: boundaries are what make it safe to choose even while those feelings are present; a boundary isn't a wall against feeling, it's a structure for acting responsibly despite it. Facilitator teaching: name each of the four honestly -- fear (what might happen), guilt (what I did or didn't do), shame (who I am because of it), doubt (whether I can trust my own judgment) -- without treating any of them as illegitimate or as something to simply talk yourself out of. Key distinction: Fortitude is not the absence of these feelings; it's choosing while they're present, inside a boundary that keeps the choice safe. Shared-room experience: the presenter names, once, that everyone in the room has decisions they're avoiding because of one of these four, and that's ordinary, not a personal failing. Activities: Naming the Interference; My Boundary, My Safety. Private reflection: participants privately name one decision that fear, guilt, shame, or doubt has been interfering with, without disclosure required. Optional AVAIA conversation: InnerCompass is available to work through this privately. Transition: once a person can choose inside a boundary, the room is ready to ask what kind of life that boundary is actually building toward -- the next class's question.$$),

  ('guide_preparation', 1, $$Shared Teaching$$,
   $$Open by naming fear, guilt, shame, and doubt as four distinct, legitimate experiences, not one undifferentiated "bad feeling" to be talked away. Teach that a boundary is not avoidance -- it's the structure that makes a real decision safe to make, the same way a guardrail doesn't stop a road from going somewhere, it makes traveling it safer. Distinguish this class's Fortitude from bravado: Fortitude here includes knowing your limits and building a boundary around them, not just pushing through regardless of cost. Watch for a room that treats any hesitation as weakness -- reframe hesitation in the presence of real fear, guilt, shame, or doubt as informative, not shameful; the goal is deciding WITH that information, inside a safe boundary, not deciding as if it weren't there.$$),

  ('participant_guide', 1, $$Personal Recognition$$,
   $$This page is yours. WHICH OF THE FOUR IS LOUDEST FOR ME: Fear, guilt, shame, or doubt -- which one shows up most in your decisions right now? A DECISION IT'S BEEN INTERFERING WITH: Name it, even loosely. WHAT BOUNDARY WOULD MAKE THIS SAFER TO DECIDE: What structure, limit, or condition would let you choose without that feeling having to disappear first? WHAT I ALREADY KNOW, UNDERNEATH THE NOISE: If the fear/guilt/shame/doubt weren't deciding, what do you actually think is true here? ONE SMALL CHOICE I CAN MAKE INSIDE A BOUNDARY: Something real, sized to what feels safe right now.$$),

  ('activity', 1, $$Chemistry Recognition Activity$$,
   $$Offer the Fortitude elements and ask which one already shows up when the participant thinks of a hard decision they've made before, even a small one -- Steadfast, Resilience, and Assertive often surface here. None is required.$$),

  ('activity', 2, $$Practice — Waking This Up in Ordinary Life$$,
   $$This week, name one decision you've been avoiding, name honestly which of the four (fear, guilt, shame, doubt) is loudest in it, and set one small, concrete boundary that would make it safer to decide -- then decide, inside that boundary.$$),

  ('conversation_window', 1, $$Awareness — IAP$$,
   $$Individual Awareness Profile. Saying, in your own words, what decision feels stuck and what's actually interfering with it.$$),

  ('conversation_window', 2, $$Understanding — CAT$$,
   $$Conversations Across Time. Following where fear, guilt, shame, or doubt tend to show up in your life, and what boundaries have worked for you before.$$),

  ('conversation_window', 3, $$Agency — InnerCompass$$,
   $$InnerCompass. Choosing, inside a real boundary, what you actually want to do.$$),

  ('take_home', 1, $$Take-Home$$,
   $$WHICH OF THE FOUR IS LOUDEST FOR ME — A DECISION IT'S BEEN INTERFERING WITH — WHAT BOUNDARY WOULD MAKE THIS SAFER TO DECIDE — WHAT I ALREADY KNOW, UNDERNEATH THE NOISE — ONE SMALL CHOICE I CAN MAKE INSIDE A BOUNDARY — ONE PRACTICE I WANT TO TRY THIS WEEK.$$),

  ('success_definition', 1, $$What Becomes Possible$$,
   $$Not a promise that fear, guilt, shame, or doubt disappear. What can become possible is a person recognizing they can build a real boundary and choose safely inside it, without waiting for those feelings to go away first.$$),

  ('boundary', 1, $$Shared Room Version & Guide Boundaries$$,
   $$In a Shared Room, this class can be taught to the whole Table -- naming which specific decision or feeling is loudest stays private. Guide boundaries: never diagnose which of the four a participant "really" has; never pressure a specific decision or boundary onto anyone; never treat hesitation as something to be argued out of a participant.$$),

  ('format_variant', 1, $$Short Class (20–30 minutes)$$,
   $$Self-directed: read the orientation and Virtue Family reference, complete the Personal Recognition page. Guide-facilitated: teach the four-feelings/boundary distinction and offer the Fortitude recognition activity; no private conversation required.$$),

  ('format_variant', 2, $$Full Class (60–90 minutes)$$,
   $$Self-directed: complete the short-class content, then open a private AVAIA conversation. Guide-facilitated: full Shared Teaching and both activities, with time for an optional private conversation during the session.$$),

  ('format_variant', 3, $$Workshop / Breakout$$,
   $$Smaller tables discuss the difference between avoidance and boundary-setting using a shared hypothetical decision, before individual private reflection on a real one.$$),

  ('format_variant', 4, $$School / Youth Lesson$$,
   $$Youth-adapted language: "what's stopping me from deciding?" framed around age-appropriate decisions (a friendship conflict, a choice about who to trust). Same guardian-consent and Youth-assent requirements as every other AVAIA Youth offering before any private conversation.$$),

  ('format_variant', 5, $$Experience / Retreat Segment$$,
   $$As a segment following The Loss of Self-Trust: once a person can act and follow through again, this class asks how to do that safely -- from inside real boundaries, not despite the absence of fear.$$)

) as v(section_type, position, title, body)
where e.title = $$The Loss of Decision-Making / Boundaries$$;
