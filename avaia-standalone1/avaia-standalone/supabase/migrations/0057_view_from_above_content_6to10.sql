-- AVAIA View From Above -- class content, classes 6-10 (of 10).
-- Continues 0055/0056. See 0055's header for the full source-discipline
-- note; every hike_lesson row below repeats the essential disclosure
-- inline so it stands on its own if read in isolation.

-- ===========================================================================
-- CLASS 6 -- The Loss of Life's Vision (Virtue Family: Wisdom)
-- ===========================================================================
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, v.section_type, v.position, v.title, v.body, 'published'
from public.experiences e
cross join (values

  ('orientation', 1, $$What This Class Is$$,
   $$A class about the disorientation of not knowing where you belong anymore -- home, place, direction, or a picture of the life you were building -- and the Wisdom it takes to find grounding again.$$),

  ('orientation', 2, $$What This Class Teaches$$,
   $$This class helps someone learn that belonging and life's vision can be rebuilt through discernment and understanding, even when the picture you were building is no longer the one in front of you.$$),

  ('hike_lesson', 1, $$The Hike Lesson$$,
   $$Source note, stated plainly: only the Prologue and the opening of Chapter 1 of "The View From Above" were recovered as verbatim text, told in full on the collection page. This class's chapter-level content exists in the archive only as unreteanscribed audio and video and could not be independently recovered; nothing further is invented here. What follows is Dorian's own directly-supplied recognition and lesson. Original recognition: "Where do I belong?" Dorian's lesson: "I need grounding, belonging, and some understanding of place, home, and direction."$$),

  ('question', 1, $$The Human Question$$,
   $$Where do I belong?$$),

  ('anchor', 1, $$Anchor$$,
   $$I need grounding, belonging, and some understanding of place, home, and direction.$$),

  ('reference', 1, $$The Virtue Family — Wisdom$$,
   $$Wisdom's canonical elements include Percipience, Judgment, Light, Balance, Originality, Reason, Knowledge, Imagination, Critical Thinking, Spirituality, Logic, Discernment, Understanding, Prudence, Intuition, Wonder, Creativity, Objectivity, Capacity, Vision, Simplicity, Change, and Priority. Every person already carries this family. This class asks which elements can help someone discern where they actually belong now -- Discernment, Understanding, and Vision often surface first when the old picture of home or direction no longer fits.$$),

  ('reference', 2, $$Stories & Examples$$,
   $$Dorian's own account -- told in full on the collection page -- describes a canyon and a road that had been home to him for years, transformed overnight into the place his world changed; belonging to that place had to be relearned, painfully and slowly, rather than simply assumed. Beyond that recovered material, a presenter may use other real examples of belonging or vision disrupted -- a move, an empty nest, retirement, a home that no longer feels like home -- clearly marked as illustrative, separate from Dorian's own story.$$),

  ('movement', 1, $$What This Class Does$$,
   $$Movement: Understanding. Purpose: help a person discern a renewed sense of belonging and direction, without forcing a single, tidy new vision into place prematurely. Core idea: "life's vision" is not one fixed picture decided once -- it's something Wisdom helps a person keep discerning as life changes. Facilitator teaching: distinguish belonging to a PLACE from belonging in a broader sense (to people, to a role, to a story about your life) -- a person may have lost one without losing the capacity for the other. Key distinction: Wisdom here is not certainty about the future; it's the discernment to keep asking the question honestly rather than settling for either false certainty or despair. Shared-room experience: the presenter names, once, that not having a clear vision right now is not a wisdom deficit -- it may be exactly what real discernment looks like mid-process. Activities: Where I Belong Now; The Picture I'm Building. Private reflection: participants privately name one place, relationship, or role where belonging feels uncertain, without disclosure required. Optional AVAIA conversation: CAT is available to follow this further privately. Transition: once a person has room to discern where they belong, the room is ready to ask what fair, honest connection with others actually requires -- the next class's question.$$),

  ('guide_preparation', 1, $$Shared Teaching$$,
   $$Open by naming that "where do I belong?" often follows any major life disruption, not only physical relocation -- a person can lose their sense of belonging while staying in the exact same house. Teach Wisdom in this class as discernment over time, not a single correct answer arrived at once. Distinguish practical grounding (a literal place, routine, or home) from deeper belonging (to people, to meaning, to a sense of one's own story) -- both matter, and a participant may be missing one without the other. Watch for a room that rushes toward "just find a new place/purpose" -- slow that down; real discernment about belonging usually takes longer than a single class, and that's expected, not a failure of the process.$$),

  ('participant_guide', 1, $$Personal Recognition$$,
   $$This page is yours. WHERE BELONGING FEELS UNCERTAIN: A place, a relationship, a role -- name where "where do I belong?" feels loudest. WHAT USED TO GROUND ME: What gave you a sense of home or place before? WHAT STILL GROUNDS ME NOW: Even something small or unexpected. THE PICTURE I WAS BUILDING: What life's vision did you have before, and how has it changed? WHAT I'M STARTING TO DISCERN: Any early sense, however uncertain, of where you might belong now.$$),

  ('activity', 1, $$Chemistry Recognition Activity$$,
   $$Offer the Wisdom elements and ask which one already shows up when the participant thinks about their own sense of place or direction -- Discernment, Understanding, and Intuition often surface here. None is required.$$),

  ('activity', 2, $$Practice — Waking This Up in Ordinary Life$$,
   $$Once this week, spend ten quiet minutes somewhere that currently feels most like grounding -- even imperfectly -- and simply notice, without deciding anything, what belonging feels like there right now.$$),

  ('conversation_window', 1, $$Awareness — IAP$$,
   $$Individual Awareness Profile. Saying, in your own words, where belonging feels uncertain right now.$$),

  ('conversation_window', 2, $$Understanding — CAT$$,
   $$Conversations Across Time. Following what grounding has looked like across your life, and where it might be quietly re-forming now.$$),

  ('conversation_window', 3, $$Agency — InnerCompass$$,
   $$InnerCompass. Choosing one place, relationship, or practice to invest in as a source of belonging going forward.$$),

  ('take_home', 1, $$Take-Home$$,
   $$WHERE BELONGING FEELS UNCERTAIN — WHAT USED TO GROUND ME — WHAT STILL GROUNDS ME NOW — THE PICTURE I WAS BUILDING — WHAT I'M STARTING TO DISCERN — ONE PRACTICE I WANT TO TRY THIS WEEK.$$),

  ('success_definition', 1, $$What Becomes Possible$$,
   $$Not a promise of a fast or final answer to where you belong. What can become possible is a person practicing real discernment about grounding and direction, trusting that clarity can build over time rather than arriving all at once.$$),

  ('boundary', 1, $$Shared Room Version & Guide Boundaries$$,
   $$In a Shared Room, this class can be taught to the whole Table -- naming a specific place or loss stays optional. Guide boundaries: never tell a participant where they belong; never treat an unresolved sense of belonging as a failure to move on; never rank one kind of home or grounding above another.$$),

  ('format_variant', 1, $$Short Class (20–30 minutes)$$,
   $$Self-directed: read the orientation and Virtue Family reference, complete the Personal Recognition page. Guide-facilitated: teach the place/deeper-belonging distinction and offer the Wisdom recognition activity; no private conversation required.$$),

  ('format_variant', 2, $$Full Class (60–90 minutes)$$,
   $$Self-directed: complete the short-class content, then open a private AVAIA conversation. Guide-facilitated: full Shared Teaching and both activities, with time for an optional private conversation during the session.$$),

  ('format_variant', 3, $$Workshop / Breakout$$,
   $$Smaller tables discuss what grounding and belonging mean in the abstract, using a shared hypothetical, before individual private reflection on a real, personal example.$$),

  ('format_variant', 4, $$School / Youth Lesson$$,
   $$Youth-adapted language: "where do I feel like I fit?" framed around age-appropriate belonging (a friend group, a family change, a new school). Same guardian-consent and Youth-assent requirements as every other AVAIA Youth offering before any private conversation.$$),

  ('format_variant', 5, $$Experience / Retreat Segment$$,
   $$As a segment following The Loss of Decision-Making / Boundaries: once a person can choose safely inside boundaries, this class asks where those choices are actually leading -- toward what kind of belonging.$$)

) as v(section_type, position, title, body)
where e.title = $$The Loss of Life's Vision$$;

-- ===========================================================================
-- CLASS 7 -- The Loss of Connection (Virtue Family: Justice)
-- ===========================================================================
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, v.section_type, v.position, v.title, v.body, 'published'
from public.experiences e
cross join (values

  ('orientation', 1, $$What This Class Is$$,
   $$A class about relationships and connections that feel unfair, unreciprocated, or unequal -- and about what Justice offers: fairness, honesty, reciprocity, dignity, and respect for another person's perspective.$$),

  ('orientation', 2, $$What This Class Teaches$$,
   $$This class helps someone learn to name, without accusation, what fair and reciprocal connection actually requires -- and to recognize the difference between a relationship that's simply different from what they expected and one that is genuinely unjust.$$),

  ('hike_lesson', 1, $$The Hike Lesson$$,
   $$Source note, stated plainly: only the Prologue and the opening of Chapter 1 of "The View From Above" were recovered as verbatim text, told in full on the collection page. This class's chapter-level content exists in the archive only as unreteanscribed audio and video and could not be independently recovered; nothing further is invented here. What follows is Dorian's own directly-supplied recognition and lesson. Original recognition: "Why are things so unfair? Why do some relationships and connections feel unreciprocated?" Dorian's lesson: "Connection includes fairness, honesty, reciprocity, dignity, and respect for another person's perspective."$$),

  ('question', 1, $$The Human Question$$,
   $$What does fair, honest, reciprocal connection look like?$$),

  ('anchor', 1, $$Anchor$$,
   $$Connection includes fairness, honesty, reciprocity, dignity, and respect for another person's perspective.$$),

  ('reference', 1, $$The Virtue Family — Justice$$,
   $$Justice's canonical elements: Fairness, Honesty, Courtesy, Impartial, Respect, Tolerance, Benignity, Dignity, Acceptance, Grace, Truth, Civility, Chivalry, Honor, Equality. Every person already carries this family. This class asks which elements can help someone see a relationship more clearly -- Fairness, Respect, and Dignity often surface first when reciprocity feels absent -- without using Justice as a weapon to prove another person wrong.$$),

  ('reference', 2, $$Stories & Examples$$,
   $$Dorian's own account -- told in full on the collection page -- describes friends who showed up for him after everything changed, dividing themselves without being asked into the people who could offer quiet company and the people who could offer practical help; real reciprocal connection showing up in different forms, from different people, without any of them needing to match exactly. Beyond that recovered material, a presenter may use other real examples of connection that felt unreciprocated or unfair -- a friendship that only goes one direction, a family relationship built on unequal expectations -- clearly marked as illustrative, separate from Dorian's own story.$$),

  ('movement', 1, $$What This Class Does$$,
   $$Movement: Understanding. Purpose: give a person language for what's actually missing in a connection that feels unfair or unreciprocated, without turning the class into a forum for accusing any specific person. Core idea: fair, reciprocal connection includes honesty, dignity, and respect for another person's perspective -- even when two people see the relationship differently. Facilitator teaching: distinguish a relationship that is simply DIFFERENT from what someone expected (not necessarily unjust) from one that is genuinely lacking fairness, honesty, or respect (a real justice concern) -- both are common, and this class helps sort which is which for a given relationship. Key distinction: naming unfairness in a relationship is not the same as declaring the other person entirely at fault; Justice includes respecting their perspective too, even while naming your own experience honestly. Shared-room experience: the presenter names, once, that unreciprocated connection is a common, real experience, not something to be ashamed of noticing. Activities: What Fair Connection Includes; Naming What's Missing, Without Accusation. Private reflection: participants privately name one relationship where reciprocity feels uncertain, without disclosure required. Optional AVAIA conversation: CAT is available to follow this further privately. Transition: once a person can name what fair connection requires, the room is ready to ask what's actually theirs to govern in a relationship they can't fully control -- the next class's question.$$),

  ('guide_preparation', 1, $$Shared Teaching$$,
   $$Open by naming that feeling like a relationship is unfair or one-sided is a common, legitimate experience worth taking seriously, not a sign of being overly sensitive. Teach the five elements Dorian named -- fairness, honesty, reciprocity, dignity, respect for another's perspective -- as a genuine checklist for evaluating a relationship's health, used privately by the participant, never publicly applied to a specific named person in the room. Distinguish "this relationship disappointed my expectations" from "this relationship lacks fairness or respect" -- the first may call for adjusting expectations; the second calls for a real boundary or conversation. Never let this class become a venue for participants to publicly relitigate a specific relationship conflict -- keep the teaching general, and route anything specific into private reflection or an AVAIA conversation.$$),

  ('participant_guide', 1, $$Personal Recognition$$,
   $$This page is yours. THE CONNECTION THAT FEELS UNEVEN: Name it, in your own words, without needing to justify the feeling. WHICH OF THE FIVE FEELS MISSING: Fairness, honesty, reciprocity, dignity, or respect for your perspective -- which one is actually absent here? IS THIS DIFFERENT OR UNFAIR: Is this relationship simply not what you expected, or does it genuinely lack one of the five? WHAT I'VE BEEN GIVING VS. RECEIVING: An honest, non-accusatory look. ONE THING I COULD NAME OR ASK FOR: A small, real step toward more reciprocal connection, if you want to take it.$$),

  ('activity', 1, $$Chemistry Recognition Activity$$,
   $$Offer the Justice elements and ask which one already shows up when the participant thinks of a relationship that DOES feel fair and reciprocal -- Respect, Honesty, and Dignity often surface here as a useful contrast. None is required.$$),

  ('activity', 2, $$Practice — Waking This Up in Ordinary Life$$,
   $$This week, in one relationship, practice naming your own experience honestly ("I've noticed I do most of the reaching out") without accusation -- and notice what becomes possible in the conversation when fairness is named plainly rather than silently resented.$$),

  ('conversation_window', 1, $$Awareness — IAP$$,
   $$Individual Awareness Profile. Saying, in your own words, which connection feels uneven and what that's actually meant for you.$$),

  ('conversation_window', 2, $$Understanding — CAT$$,
   $$Conversations Across Time. Following the pattern across your relationships -- where reciprocity is strong, and where it consistently isn't.$$),

  ('conversation_window', 3, $$Agency — InnerCompass$$,
   $$InnerCompass. Choosing what, if anything, you want to name, ask for, or change in a specific connection.$$),

  ('take_home', 1, $$Take-Home$$,
   $$THE CONNECTION THAT FEELS UNEVEN — WHICH OF THE FIVE FEELS MISSING — IS THIS DIFFERENT OR UNFAIR — WHAT I'VE BEEN GIVING VS. RECEIVING — ONE THING I COULD NAME OR ASK FOR — ONE PRACTICE I WANT TO TRY THIS WEEK.$$),

  ('success_definition', 1, $$What Becomes Possible$$,
   $$Not a promise that every relationship becomes perfectly reciprocal. What can become possible is a person having real language to evaluate a connection honestly, and the dignity to name what's missing without needing to prove the other person wrong.$$),

  ('boundary', 1, $$Shared Room Version & Guide Boundaries$$,
   $$In a Shared Room, this class carries real weight -- it can surface tension between people actually at the same Table (a couple, a family). The shared teaching itself is safe for the group; naming a SPECIFIC relationship as unfair should move to private processing, not be aired at the Table without both people's consent. Guide boundaries: never referee whose account of a relationship is correct; never let this class become a forum for one participant to publicly indict another; protect every account as real for the person holding it, even when two accounts conflict.$$),

  ('format_variant', 1, $$Short Class (20–30 minutes)$$,
   $$Self-directed: read the orientation and Virtue Family reference, complete the Personal Recognition page. Guide-facilitated: teach the five elements of fair connection and offer the Justice recognition activity; no private conversation required.$$),

  ('format_variant', 2, $$Full Class (60–90 minutes)$$,
   $$Self-directed: complete the short-class content, then open a private AVAIA conversation. Guide-facilitated: full Shared Teaching and both activities, with time for an optional private conversation during the session.$$),

  ('format_variant', 3, $$Workshop / Breakout$$,
   $$Smaller tables discuss what fair, reciprocal connection looks like in general (using a shared hypothetical relationship), never a real relationship between people at the same table; individual private reflection handles anything personal.$$),

  ('format_variant', 4, $$School / Youth Lesson$$,
   $$Youth-adapted language: "what does a fair friendship look like?" framed around age-appropriate connection (friendships, peer dynamics). Same guardian-consent and Youth-assent requirements as every other AVAIA Youth offering before any private conversation.$$),

  ('format_variant', 5, $$Experience / Retreat Segment$$,
   $$As a segment following The Loss of Life's Vision: once a person has more clarity on where they belong, this class asks what fair, honest connection with the people in that picture actually requires.$$)

) as v(section_type, position, title, body)
where e.title = $$The Loss of Connection$$;

-- ===========================================================================
-- CLASS 8 -- The Loss of Control (Virtue Family: Self-Control)
-- ===========================================================================
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, v.section_type, v.position, v.title, v.body, 'published'
from public.experiences e
cross join (values

  ('orientation', 1, $$What This Class Is$$,
   $$A class about feeling overwhelmed -- and about the real, sometimes narrow difference between what's actually yours to govern and what never was.$$),

  ('orientation', 2, $$What This Class Teaches$$,
   $$This class helps someone learn to separate what they can actually govern in themselves from what they cannot control in life, situations, other people, or the future -- and to practice Self-Control specifically on the first, not the second.$$),

  ('hike_lesson', 1, $$The Hike Lesson$$,
   $$Source note, stated plainly: only the Prologue and the opening of Chapter 1 of "The View From Above" were recovered as verbatim text, told in full on the collection page. This class's chapter-level content exists in the archive only as unreteanscribed audio and video and could not be independently recovered; nothing further is invented here. What follows is Dorian's own directly-supplied recognition and lesson. Original recognition: "I feel overwhelmed." Dorian's lesson: "I need to understand what I can govern in myself and how I participate when I cannot control life, situations, other people, or the future."$$),

  ('question', 1, $$The Human Question$$,
   $$What is actually mine to govern?$$),

  ('anchor', 1, $$Anchor$$,
   $$I need to understand what I can govern in myself and how I participate when I cannot control life, situations, other people, or the future.$$),

  ('reference', 1, $$The Virtue Family — Self-Control$$,
   $$Self-Control's canonical elements: Purity, Peace, Obedience, Mindfulness, Patience, Serenity, Long Suffering, Awareness, Fidelity, Temperance, Moderation. Every person already carries this family. This class asks which elements can help someone participate wisely in what they can't control -- Awareness, Patience, and Peace often surface first when overwhelm is the starting point, without implying that Self-Control means suppressing feeling.$$),

  ('reference', 2, $$Stories & Examples$$,
   $$Dorian's own account -- told in full on the collection page -- describes the helplessness of the two-day search itself: the river's own pace, the terrain, the outcome, none of it his to control, only his own presence, his own choices about how to show up, remaining truly his. Beyond that recovered material, a presenter may use other real examples of overwhelming lack of control -- a medical diagnosis, another person's choices, an uncertain outcome at work -- clearly marked as illustrative, separate from Dorian's own story.$$),

  ('movement', 1, $$What This Class Does$$,
   $$Movement: Understanding into Agency. Purpose: help a person draw an honest, specific line between what they can govern and what they cannot, rather than staying stuck in generalized overwhelm. Core idea: Self-Control is not about controlling outcomes, other people, or the future -- it's about governing your own response, attention, and participation inside circumstances you don't control. Facilitator teaching: make the distinction concrete -- I cannot control another person's choices, but I can control how I respond to them; I cannot control an outcome, but I can control my own effort and integrity inside the process. Key distinction: this is not passivity or resignation -- real, active participation is still possible and important inside what you can't control; Self-Control governs HOW you participate, not WHETHER you do. Shared-room experience: the presenter names, once, that feeling overwhelmed usually means the two categories (controllable/uncontrollable) have blurred together, and this class's whole job is separating them again. Activities: The Two Columns; What Participation Looks Like. Private reflection: participants privately name one thing overwhelming them right now, without disclosure required. Optional AVAIA conversation: InnerCompass is available to work through this privately. Transition: once a person can separate what's theirs to govern from what isn't, the room is ready to ask who they actually are underneath all of it -- identity, the next class's question.$$),

  ('guide_preparation', 1, $$Shared Teaching$$,
   $$Open by naming overwhelm as usually a sign that the controllable and the uncontrollable have blurred together in a person's mind, not a character flaw. Teach the two-column exercise directly: what can I actually govern (my attention, effort, response, integrity, how I show up) versus what I cannot (outcomes, other people's choices, the past, the future, most of what happens to me). Be explicit that Self-Control in this class does NOT mean suppressing or hiding feeling -- it means choosing how to participate given the feeling, not pretending it away. Watch for two opposite failure modes in a room: someone trying to control everything (leading to more overwhelm) and someone giving up all participation because they can't control the outcome (a different kind of loss); Self-Control lives in the honest middle -- real participation in what's yours, real release of what isn't.$$),

  ('participant_guide', 1, $$Personal Recognition$$,
   $$This page is yours. WHAT'S OVERWHELMING ME RIGHT NOW: Name it plainly. WHAT I CANNOT CONTROL IN THIS: Be specific and honest. WHAT I CAN ACTUALLY GOVERN IN MYSELF, HERE: Your response, effort, attention, integrity -- what's genuinely yours. WHERE I'VE BEEN TRYING TO CONTROL THE UNCONTROLLABLE: Notice without judgment. HOW I WANT TO PARTICIPATE, GIVEN ALL OF THIS: Not control the outcome -- participate with integrity inside it.$$),

  ('activity', 1, $$Chemistry Recognition Activity$$,
   $$Offer the Self-Control elements and ask which one already shows up when the participant thinks of a time they navigated something overwhelming without losing themselves -- Awareness, Patience, and Temperance often surface here. None is required.$$),

  ('activity', 2, $$Practice — Waking This Up in Ordinary Life$$,
   $$Once this week, when you notice overwhelm rising, pause and physically write (or say aloud) two short lists side by side: what I can't control here, and what I can. Choose one small action from the second list only.$$),

  ('conversation_window', 1, $$Awareness — IAP$$,
   $$Individual Awareness Profile. Saying, in your own words, what's overwhelming you right now.$$),

  ('conversation_window', 2, $$Understanding — CAT$$,
   $$Conversations Across Time. Following the pattern -- where you tend to try to control what you can't, and where you already govern yourself well.$$),

  ('conversation_window', 3, $$Agency — InnerCompass$$,
   $$InnerCompass. Choosing how you want to participate in something you can't fully control.$$),

  ('take_home', 1, $$Take-Home$$,
   $$WHAT'S OVERWHELMING ME RIGHT NOW — WHAT I CANNOT CONTROL IN THIS — WHAT I CAN ACTUALLY GOVERN IN MYSELF, HERE — WHERE I'VE BEEN TRYING TO CONTROL THE UNCONTROLLABLE — HOW I WANT TO PARTICIPATE, GIVEN ALL OF THIS — ONE PRACTICE I WANT TO TRY THIS WEEK.$$),

  ('success_definition', 1, $$What Becomes Possible$$,
   $$Not a promise that overwhelming circumstances become controllable. What can become possible is a person recognizing exactly what's theirs to govern, and finding real, honest participation possible even inside what isn't.$$),

  ('boundary', 1, $$Shared Room Version & Guide Boundaries$$,
   $$In a Shared Room, this class can be taught to the whole Table -- naming what specifically feels overwhelming stays optional. Guide boundaries: never tell a participant what is or isn't theirs to control; never use this class to minimize a genuinely difficult, uncontrollable circumstance; never imply that better Self-Control would have produced a better outcome.$$),

  ('format_variant', 1, $$Short Class (20–30 minutes)$$,
   $$Self-directed: read the orientation and Virtue Family reference, complete the Personal Recognition page. Guide-facilitated: teach the two-column (controllable/uncontrollable) distinction and offer the Self-Control recognition activity; no private conversation required.$$),

  ('format_variant', 2, $$Full Class (60–90 minutes)$$,
   $$Self-directed: complete the short-class content, then open a private AVAIA conversation. Guide-facilitated: full Shared Teaching and both activities, with time for an optional private conversation during the session.$$),

  ('format_variant', 3, $$Workshop / Breakout$$,
   $$Smaller tables practice the two-column exercise together on a shared hypothetical overwhelming situation, before individual private reflection on a real one.$$),

  ('format_variant', 4, $$School / Youth Lesson$$,
   $$Youth-adapted language: "what's actually mine to control here?" framed around age-appropriate overwhelm (grades, friend drama, family stress). Same guardian-consent and Youth-assent requirements as every other AVAIA Youth offering before any private conversation.$$),

  ('format_variant', 5, $$Experience / Retreat Segment$$,
   $$As a segment following The Loss of Connection: once a person has language for what fair connection requires from others, this class turns inward to what's actually theirs to govern in any relationship or circumstance.$$)

) as v(section_type, position, title, body)
where e.title = $$The Loss of Control$$;

-- ===========================================================================
-- CLASS 9 -- The Loss of Identity (Virtue Family: Integrity)
-- ===========================================================================
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, v.section_type, v.position, v.title, v.body, 'published'
from public.experiences e
cross join (values

  ('orientation', 1, $$What This Class Is$$,
   $$A class about the question "who am I?" when a role, relationship, or identity you relied on is gone -- and about the Integrity it takes to find out what actually still stands.$$),

  ('orientation', 2, $$What This Class Teaches$$,
   $$This class helps someone learn to separate identity that was borrowed from a role or relationship from identity that is genuinely their own -- values and character that remain, even when a role is gone.$$),

  ('hike_lesson', 1, $$The Hike Lesson$$,
   $$Source note, stated plainly: only the Prologue and the opening of Chapter 1 of "The View From Above" were recovered as verbatim text, told in full on the collection page. This class's chapter-level content exists in the archive only as unreteanscribed audio and video and could not be independently recovered; nothing further is invented here. What follows is Dorian's own directly-supplied recognition and lesson. Original recognition: "Who am I?" Dorian's lesson: "I need to know who I am as an individual, what I stand for, and what my values are."$$),

  ('question', 1, $$The Human Question$$,
   $$Who am I?$$),

  ('anchor', 1, $$Anchor$$,
   $$I need to know who I am as an individual, what I stand for, and what my values are.$$),

  ('reference', 1, $$The Virtue Family — Integrity$$,
   $$Integrity's canonical elements include Genuineness, Reliability, Ethical, Innocence, Nobility, Probity, Vulnerability, Authenticity, Character, Excellence, Principles, Individuality, Morality. Every person already carries this family. This class asks which elements can help someone find what still stands after a role or identity is gone -- Authenticity, Character, and Principles often surface first, without implying identity must be entirely rebuilt from nothing.$$),

  ('reference', 2, $$Stories & Examples$$,
   $$Dorian's own account -- told in full on the collection page -- describes surviving two of his worst fears, divorce and the loss of his son, and finding that being a father, and the values that shaped how he was a father, remained real and true even without the specific role being present in the same way. Beyond that recovered material, a presenter may use other real examples of identity disrupted -- a job that defined someone ending, an "empty nest," a relationship that was central to someone's sense of self ending -- clearly marked as illustrative, separate from Dorian's own story.$$),

  ('movement', 1, $$What This Class Does$$,
   $$Movement: Understanding into Agency. Purpose: help a person separate identity that depended on an external role or relationship from identity that is genuinely, durably theirs. Core idea: "who am I" can survive the loss of a role, because character and values are not the same thing as the role that expressed them. Facilitator teaching: make the distinction concrete -- being "a parent" as a role can end or change; the values that shaped how someone parented (patience, love, responsibility) do not disappear with the role. Key distinction: this is not a claim that role-loss doesn't matter -- it clearly does -- only that identity is not reducible to role, and the class asks what remains once the role is set aside. Shared-room experience: the presenter names, once, that "who am I without this?" is one of the hardest, most honest questions a person can ask, and worth real time, not a quick answer. Activities: Role vs. Values; What Still Stands. Private reflection: participants privately name one role or identity that changed, without disclosure required. Optional AVAIA conversation: InnerCompass is available to work through this privately. Transition: once a person can name what still stands, the room is ready to ask who they're still connected to, and what that connection means -- the final class's question.$$),

  ('guide_preparation', 1, $$Shared Teaching$$,
   $$Open by naming that losing a role, relationship, or identity marker (parent, spouse, career, community position) is one of the most disorienting kinds of loss, precisely because it can feel like losing yourself, not just losing something you had. Teach the role/values distinction directly and concretely, using an example the room can follow without personal disclosure. Distinguish Integrity as used here (character, values, principles that persist) from the ordinary sense of "honesty" -- this class is about wholeness and consistency of self, not primarily about truth-telling. Watch for a room moving to premature reinvention ("just become someone new") -- slow that down; this class is about recognizing what's already durably true about a person, not manufacturing a new identity from scratch.$$),

  ('participant_guide', 1, $$Personal Recognition$$,
   $$This page is yours. THE ROLE OR IDENTITY THAT CHANGED: Name it plainly. WHAT THAT ROLE MEANT TO ME: Not just the role itself -- what it represented. THE VALUES UNDERNEATH THE ROLE: What did that role let you express or practice -- love, responsibility, care, discipline, something else? WHAT STILL STANDS, WITHOUT THE ROLE: Which of those values are still true about you, right now, even without the role? WHO I AM, IN MY OWN WORDS: A short, honest attempt -- it doesn't have to be complete.$$),

  ('activity', 1, $$Chemistry Recognition Activity$$,
   $$Offer the Integrity elements and ask which one already shows up when the participant thinks of what they'd want people to say is still true about them, no matter what role they hold -- Character, Authenticity, and Principles often surface here. None is required.$$),

  ('activity', 2, $$Practice — Waking This Up in Ordinary Life$$,
   $$Once this week, notice one moment where you act from a value (patience, honesty, care) that has nothing to do with any specific role -- and name to yourself, in that moment, "this is mine, this is who I am, independent of any title."$$),

  ('conversation_window', 1, $$Awareness — IAP$$,
   $$Individual Awareness Profile. Saying, in your own words, what role or identity has changed and what that's meant for you.$$),

  ('conversation_window', 2, $$Understanding — CAT$$,
   $$Conversations Across Time. Following the values underneath the role, and where they still show up in your life now.$$),

  ('conversation_window', 3, $$Agency — InnerCompass$$,
   $$InnerCompass. Choosing how you want to actively express what still stands, going forward.$$),

  ('take_home', 1, $$Take-Home$$,
   $$THE ROLE OR IDENTITY THAT CHANGED — WHAT THAT ROLE MEANT TO ME — THE VALUES UNDERNEATH THE ROLE — WHAT STILL STANDS, WITHOUT THE ROLE — WHO I AM, IN MY OWN WORDS — ONE PRACTICE I WANT TO TRY THIS WEEK.$$),

  ('success_definition', 1, $$What Becomes Possible$$,
   $$Not a promise of a fully settled, permanent sense of identity. What can become possible is a person recognizing real, durable values and character that remain true, even when a role or relationship that once expressed them has changed.$$),

  ('boundary', 1, $$Shared Room Version & Guide Boundaries$$,
   $$In a Shared Room, this class can be taught to the whole Table -- naming a specific role or loss stays optional. Guide boundaries: never tell a participant who they are; never treat a role-based identity crisis as something to be resolved quickly; never suggest one person's rebuilt identity is the model for another's.$$),

  ('format_variant', 1, $$Short Class (20–30 minutes)$$,
   $$Self-directed: read the orientation and Virtue Family reference, complete the Personal Recognition page. Guide-facilitated: teach the role/values distinction and offer the Integrity recognition activity; no private conversation required.$$),

  ('format_variant', 2, $$Full Class (60–90 minutes)$$,
   $$Self-directed: complete the short-class content, then open a private AVAIA conversation. Guide-facilitated: full Shared Teaching and both activities, with time for an optional private conversation during the session.$$),

  ('format_variant', 3, $$Workshop / Breakout$$,
   $$Smaller tables discuss the role/values distinction using a shared hypothetical (e.g. a fictional character who loses a job), before individual private reflection on a real, personal example.$$),

  ('format_variant', 4, $$School / Youth Lesson$$,
   $$Youth-adapted language: "who am I, even without [team, group, role]?" framed around age-appropriate identity questions (a team, a friend group, a family role). Same guardian-consent and Youth-assent requirements as every other AVAIA Youth offering before any private conversation.$$),

  ('format_variant', 5, $$Experience / Retreat Segment$$,
   $$As a segment following The Loss of Control: once a person has clarity on what's theirs to govern, this class asks what's actually, durably theirs underneath every role -- setting up the final class's question about connection.$$)

) as v(section_type, position, title, body)
where e.title = $$The Loss of Identity$$;

-- ===========================================================================
-- CLASS 10 -- The Loss of Attachment / Support (Virtue Family: Love)
-- ===========================================================================
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, v.section_type, v.position, v.title, v.body, 'published'
from public.experiences e
cross join (values

  ('orientation', 1, $$What This Class Is$$,
   $$The final class in the collection -- about who you've lost, who you're still connected to, and whether those attachments are real. About Love as bonding, security, and inclusion, not only romance.$$),

  ('orientation', 2, $$What This Class Teaches$$,
   $$This class helps someone learn that human connection and attachment are genuine needs, not weaknesses -- and that even after real loss, a person can recognize the attachments that remain real and can be trusted.$$),

  ('hike_lesson', 1, $$The Hike Lesson$$,
   $$Source note, stated plainly: only the Prologue and the opening of Chapter 1 of "The View From Above" were recovered as verbatim text, told in full on the collection page. This class's chapter-level content exists in the archive only as unreteanscribed audio and video and could not be independently recovered; nothing further is invented here. What follows is Dorian's own directly-supplied recognition and lesson. Original recognition: "Who have I lost? Who am I still connected to? Are those attachments real?" Dorian's lesson: "Human beings need connection, bonding, security, inclusion, and meaningful attachment."$$),

  ('question', 1, $$The Human Question$$,
   $$Who am I connected to, and what does connection mean?$$),

  ('anchor', 1, $$Anchor$$,
   $$Human beings need connection, bonding, security, inclusion, and meaningful attachment.$$),

  ('reference', 1, $$The Virtue Family — Love$$,
   $$Love's canonical elements include Charity, Thoughtfulness, Cherish, Sympathy, Devotion, Kindness, Adoration, Mercy, Sacrifice, Nurturing, Compassion, Benevolence, Generosity, Hospitality, Forgiveness, Helpfulness, Loyalty, Yearning. Every person already carries this family. This class asks which elements can help someone recognize which attachments are real and trustworthy right now -- Devotion, Loyalty, and Compassion often surface first, without implying that grieving a lost attachment means it wasn't real.$$),

  ('reference', 2, $$Stories & Examples$$,
   $$Dorian's own account -- told in full on the collection page -- describes still hearing his son's voice from downstream while fishing, and knowing, in that moment, that the attachment was still real, even though the physical presence was gone; and describes the friends who showed up, dividing themselves into who could offer quiet company and who could offer practical help, without being asked -- new and renewed attachment, real and present, alongside continuing loss. Beyond that recovered material, a presenter may use other real examples of attachment disrupted or renewed -- estrangement, reconciliation, a support system rebuilt after isolation -- clearly marked as illustrative, separate from Dorian's own story.$$),

  ('movement', 1, $$What This Class Does$$,
   $$Movement: Agency, closing the collection. Purpose: help a person take honest inventory of who they're attached to now, and recognize which attachments are real and can be trusted, even alongside real loss. Core idea: an attachment that has been lost or changed does not retroactively become unreal -- and a person can hold continuing connection to someone no longer present alongside new, real connection to people who are. Facilitator teaching: distinguish attachment that has ENDED (through death, distance, or estrangement) from attachment that CONTINUES in changed form (memory, legacy, ongoing relationship at a different depth) -- both categories can be real and worth naming honestly. Key distinction: Love in this class is not romantic love specifically -- it's the broader human need for bonding, security, and inclusion, which shows up in friendship, family, and community as much as in romance. Shared-room experience: the presenter names, once, that this class closes the collection by turning outward, toward who a person is still connected to -- not as a tidy resolution, but as a real, ongoing question. Activities: Who I've Lost, Who I'm Connected To; Are These Attachments Real?. Private reflection: participants privately name one attachment, past or present, that matters to them, without disclosure required. Optional AVAIA conversation: any of IAP, CAT, or InnerCompass is available, matching wherever the person is in their own process. Transition: this is the last class in the collection -- the natural close is the collection's own "What Became Visible?" reflection, not a new question.$$),

  ('guide_preparation', 1, $$Shared Teaching$$,
   $$Open by naming Love, in this class's sense, as the broad human need for connection, bonding, security, and inclusion -- present in friendship, family, and community, not only romance. Teach the distinction between attachment that has ended and attachment that continues in a changed form; both are real, and grief for the first does not erase the truth of the second. Be attentive: this class often surfaces significant loss for participants (a death, an estrangement, isolation) -- hold it with real care, and be ready to route anyone who needs more than this class's format to a private AVAIA conversation or, if appropriate, a Certified Guide. As the final class in the collection, this is also a natural moment to invite reflection on the whole ten-class arc, using AVAIA's own "What Became Visible?" framing, without forcing a tidy conclusion onto anyone's process.$$),

  ('participant_guide', 1, $$Personal Recognition$$,
   $$This page is yours. WHO I'VE LOST: Named plainly, however that loss looks for you. WHO I'M STILL CONNECTED TO: People present in your life now, even if that connection has changed. IS THIS ATTACHMENT REAL: For one relationship, past or present -- what makes it feel real and trustworthy to you? WHAT I NEED FROM CONNECTION: Bonding, security, inclusion -- which of these feels most needed right now? IF I'VE TAKEN THIS WHOLE COLLECTION: What became visible to me, across all ten classes, that I couldn't see from where I started?$$),

  ('activity', 1, $$Chemistry Recognition Activity$$,
   $$Offer the Love elements and ask which one already shows up in a connection the participant trusts right now -- Devotion, Compassion, and Loyalty often surface here. None is required.$$),

  ('activity', 2, $$Practice — Waking This Up in Ordinary Life$$,
   $$This week, reach out to one person you're genuinely attached to -- even briefly -- and name, in your own words, that the connection matters to you. Notice what it's like to say so plainly.$$),

  ('conversation_window', 1, $$Awareness — IAP$$,
   $$Individual Awareness Profile. Saying, in your own words, who you've lost and who you're still connected to.$$),

  ('conversation_window', 2, $$Understanding — CAT$$,
   $$Conversations Across Time. Following which attachments feel real and trustworthy, and which feel uncertain.$$),

  ('conversation_window', 3, $$Agency — InnerCompass$$,
   $$InnerCompass. Choosing how you want to invest in, repair, or honor a real attachment going forward.$$),

  ('take_home', 1, $$Take-Home$$,
   $$WHO I'VE LOST — WHO I'M STILL CONNECTED TO — IS THIS ATTACHMENT REAL — WHAT I NEED FROM CONNECTION — WHAT BECAME VISIBLE TO ME ACROSS THIS COLLECTION — ONE PRACTICE I WANT TO TRY THIS WEEK.$$),

  ('success_definition', 1, $$What Becomes Possible$$,
   $$Not a promise that loss stops hurting or that every attachment is repaired. What can become possible is a person recognizing which connections are real and trustworthy right now, and carrying forward attachment to what's gone alongside genuine investment in what remains.$$),

  ('boundary', 1, $$Shared Room Version & Guide Boundaries$$,
   $$In a Shared Room, this class can carry real emotional weight -- naming who's been lost stays entirely optional, and a presenter should watch capacity closely here more than in any other class in the collection. Guide boundaries: never require anyone to name a loss aloud; never compare the significance of one participant's loss to another's; know AVAIA's crisis guidance and be ready to step outside the curriculum if a participant needs more support than this format offers.$$),

  ('format_variant', 1, $$Short Class (20–30 minutes)$$,
   $$Self-directed: read the orientation and Virtue Family reference, complete the Personal Recognition page. Guide-facilitated: teach the ended-vs-continuing attachment distinction and offer the Love recognition activity; no private conversation required.$$),

  ('format_variant', 2, $$Full Class (60–90 minutes)$$,
   $$Self-directed: complete the short-class content, then open a private AVAIA conversation. Guide-facilitated: full Shared Teaching and both activities, with time for an optional private conversation during the session -- and, if this closes a full ten-class series, time for the group to reflect together on What Became Visible across the whole collection.$$),

  ('format_variant', 3, $$Workshop / Breakout$$,
   $$Smaller tables discuss what makes an attachment feel real and trustworthy in general, using a shared hypothetical, before individual private reflection on real, personal attachments.$$),

  ('format_variant', 4, $$School / Youth Lesson$$,
   $$Youth-adapted language: "who am I close to, and how do I know I can trust that?" framed around age-appropriate connection (friendships, family, mentors). Same guardian-consent and Youth-assent requirements as every other AVAIA Youth offering before any private conversation -- and particular care given Youth-specific safety considerations already governed by AVAIA's separate Youth safety procedure.$$),

  ('format_variant', 5, $$Experience / Retreat Segment$$,
   $$As the closing segment of the full View From Above collection or a longer Experience: this class naturally follows The Loss of Identity, and can close with the collection's own "What Became Visible?" reflection -- what the whole climb made visible that wasn't visible from where the person started.$$)

) as v(section_type, position, title, body)
where e.title = $$The Loss of Attachment / Support$$;
