// AVAIA View From Above -- the ten self-directed classes, front-door
// content. This is a separate, hardcoded content layer from the Guide-
// facing curriculum depth in `experiences`/`experience_sections`
// (migrations 0055-0057) -- the same split Defying Grief already uses
// (its public /defying-grief page is hardcoded TSX; its Guide curriculum
// depth lives in the database). Not a duplication for its own sake: the
// experiences/experience_sections tables have no read policy for an
// ordinary signed-in Host at all (see migration 0020's RLS -- 'guide' or
// 'admin' role only), so a Host taking a class alone was never going to
// reach that data through those tables regardless of publish status.
//
// virtueLooksLike below is not a second copy of illustrative content --
// every entry points directly at VIRTUE_FAMILY_LOOKS_LIKE
// (lib/virtue-looks-like.ts), the one shared source also used by the
// Digital Chemistry Kit at /chemistry. Written once here originally;
// factored out so both surfaces read the same array, not two.
//
// SOURCE DISCIPLINE: only the Prologue and the opening of Chapter 1 of
// Dorian's memoir "The View From Above" were recovered as verbatim text
// from the source archive -- told in full on the collection page
// (app/view-from-above/page.tsx). Chapters 2-10 exist in that archive
// only as unreteanscribed audiobook and video files; their specific
// chapter-by-chapter scenes could not be recovered or verified, and
// nothing is invented here to fill that gap. Each class's `hikeLesson`
// field below carries Dorian's own directly-supplied recognition and
// lesson language, not further invented narrative -- see the
// `hikeLessonSourceNote` on every entry.

import { VIRTUE_FAMILY_LOOKS_LIKE } from "@/lib/virtue-looks-like";

export type ViewFromAboveClass = {
  slug: string;
  secondaryLoss: string;
  title: string; // "The Loss of ..."
  virtueFamily: string;
  virtueElements: string[];
  humanQuestion: string;
  dorianLesson: string;
  whatItIs: string;
  whatItTeaches: string; // completes "This class helps someone learn..."
  hikeLesson: string;
  hikeLessonSourceNote: string;
  virtueLooksLike: string[]; // multiple expressions, no scoring
  personalRecognition: { prompt: string; helper: string }[];
  chemistryActivity: string;
  practice: string;
  whatBecomesPossible: string;
  experienceId?: string; // set at runtime by looking up the matching `experiences` row for the Guide-facilitated link
};

const HIKE_SOURCE_NOTE =
  "Only the Prologue and the opening of Chapter 1 of “The View From Above” were recovered as the author's own written words -- told in full on this page. This class's own place in the hike exists in the source archive only as an audiobook chapter and video, without a transcript, so it couldn't be independently recovered here. What follows is Dorian's own directly-supplied recognition and lesson for this class, in his own words -- not further invented scene detail.";

export const VIEW_FROM_ABOVE_CLASSES: ViewFromAboveClass[] = [
  {
    slug: "meaning",
    secondaryLoss: "Meaning",
    title: "The Loss of Meaning",
    virtueFamily: "Gratitude",
    virtueElements: ["Appreciation", "Gratefulness", "Thankfulness"],
    humanQuestion: "What is the point?",
    dorianLesson: "I need to find meaning in life and be able to be grateful in all situations.",
    whatItIs:
      "A class about the question that arrives first, and hardest, after anything real is disrupted: what is the point? Not answered for you here -- opened, so you can find your own answer, or sit honestly with not yet having one.",
    whatItTeaches:
      "This class helps someone learn that meaning isn't something you either have or don't have -- it's something you can actively look for, name, and practice gratitude toward, even inside circumstances that don't make sense yet.",
    hikeLesson: HIKE_SOURCE_NOTE,
    hikeLessonSourceNote: HIKE_SOURCE_NOTE,
    virtueLooksLike: VIRTUE_FAMILY_LOOKS_LIKE.gratitude,
    personalRecognition: [
      { prompt: "What is the point, for me, right now?", helper: "Not the point of everything -- just the point of showing up today." },
      { prompt: "What still feels meaningful?", helper: "Name one thing, however small." },
      { prompt: "What am I grateful for, without pretending?", helper: "Something real, that doesn't require minimizing anything else." },
    ],
    chemistryActivity:
      "Gratitude's elements are Appreciation, Gratefulness, and Thankfulness -- three different doors into the same room. Which feels most awake in you right now? Which feels furthest away? Neither answer is required.",
    practice:
      "Once a day, name one specific thing that's still real and still good -- out loud or in writing -- without qualifying it.",
    whatBecomesPossible:
      "Not a promise that meaning arrives on schedule. What can become possible is recognizing you're allowed to look for meaning actively, and that gratitude and grief may become possible to hold at the same time.",
  },
  {
    slug: "reality",
    secondaryLoss: "Reality",
    title: "The Loss of Reality",
    virtueFamily: "Humility",
    virtueElements: ["Modesty", "Unpretentious", "Meekness", "Sincerity"],
    humanQuestion: "What is real to me anymore?",
    dorianLesson: "So many things do not make sense. Foundational beliefs can be questioned or disrupted.",
    whatItIs:
      "A class about the disorientation that follows when something you were sure of turns out not to hold -- when foundational beliefs get questioned or disrupted, and you're no longer certain what's real.",
    whatItTeaches:
      "This class helps someone learn that not knowing what's real anymore isn't a failure of understanding -- it's a real, survivable stage that Humility can move through, without forcing false certainty back into place too soon.",
    hikeLesson: HIKE_SOURCE_NOTE,
    hikeLessonSourceNote: HIKE_SOURCE_NOTE,
    virtueLooksLike: VIRTUE_FAMILY_LOOKS_LIKE.humility,
    personalRecognition: [
      { prompt: "What was I sure of, before?", helper: "About the world, about people, about yourself." },
      { prompt: "What feels uncertain now?", helper: "What's changed about how sure you feel?" },
      { prompt: "What am I willing to look at again?", helper: "Naming willingness, not conclusions." },
    ],
    chemistryActivity:
      "Humility's elements are Modesty, Unpretentious, Meekness, and Sincerity. Which one already shows up when you say “I don't know” out loud? Sincerity often surfaces first here -- that's real data, not a required answer.",
    practice:
      "Once this week, when uncertain about something, say “I don't know yet” out loud instead of a quick, confident answer -- and notice what happens.",
    whatBecomesPossible:
      "Not a promise that certainty returns. What can become possible is recognizing that not knowing what's real yet is a humble, survivable place to stand -- and that re-examining a belief isn't the same as losing it.",
  },
  {
    slug: "dreams-opportunities",
    secondaryLoss: "Dreams / Opportunities",
    title: "The Loss of Dreams / Opportunities",
    virtueFamily: "Positive Attitude",
    virtueElements: ["Hope", "Adaptability", "Optimism", "Flexibility", "Zeal"],
    humanQuestion: "Where am I going?",
    dorianLesson: "I need direction, hope, and positive expectations.",
    whatItIs:
      "A class about the moment a future you were counting on disappears, changes, or becomes unrecognizable -- and the real work of finding direction again.",
    whatItTeaches:
      "This class helps someone learn that losing a specific dream isn't the same as losing the capacity for direction itself -- Positive Attitude is a practice of hope that can be rebuilt even when the original plan is gone.",
    hikeLesson: HIKE_SOURCE_NOTE,
    hikeLessonSourceNote: HIKE_SOURCE_NOTE,
    virtueLooksLike: VIRTUE_FAMILY_LOOKS_LIKE["positive-attitude"],
    personalRecognition: [
      { prompt: "The dream or opportunity that changed", helper: "Name it plainly, in your own words." },
      { prompt: "What I actually wanted from it", helper: "Underneath the specific plan, what was the deeper hope?" },
      { prompt: "One possibility, even small", helper: "Something that feels even slightly like a direction." },
    ],
    chemistryActivity:
      "Positive Attitude includes Hope, Adaptability, Optimism, Flexibility, and more. Which one already shows up, even faintly, when you think about tomorrow? None is required.",
    practice:
      "Once this week, name one small, real possibility out loud -- not a plan, just a direction worth being curious about -- and take one small step toward it.",
    whatBecomesPossible:
      "Not a promise that a new dream arrives quickly. What can become possible is recognizing that direction and hope are practices you can exercise again, even before a new destination is clear.",
  },
  {
    slug: "self-trust",
    secondaryLoss: "Self-Trust",
    title: "The Loss of Self-Trust",
    virtueFamily: "Hard Work",
    virtueElements: ["Persistence", "Perseverance", "Diligence", "Self-reliance", "Dedication"],
    humanQuestion: "What is my role?",
    dorianLesson:
      "I need to know that what I am doing makes a difference to me and others, and that I can act, work, and follow through.",
    whatItIs:
      "A class about the quiet question that follows disruption: what is my role now? And about rebuilding trust in your own ability to act, work, and follow through.",
    whatItTeaches:
      "This class helps someone learn that self-trust, once shaken, gets rebuilt the same way it's usually built -- through small, real, followed-through actions, which is exactly what Hard Work is made of.",
    hikeLesson: HIKE_SOURCE_NOTE,
    hikeLessonSourceNote: HIKE_SOURCE_NOTE,
    virtueLooksLike: VIRTUE_FAMILY_LOOKS_LIKE["hard-work"],
    personalRecognition: [
      { prompt: "Where I feel unsure of my role", helper: "Name where “what is my role now?” feels loudest." },
      { prompt: "One thing I followed through on recently", helper: "However small -- name it plainly." },
      { prompt: "Who or what I make a difference to", helper: "Even one person, one place, one small thing." },
    ],
    chemistryActivity:
      "Hard Work includes Persistence, Diligence, Self-reliance, and more. Which one already shows up when you think of something you followed through on recently? Noticing what feels dormant is equally useful.",
    practice:
      "Choose one small task this week and follow it through to completion, on purpose -- as evidence, not because the task itself matters most.",
    whatBecomesPossible:
      "Not a promise of a settled, permanent sense of purpose. What can become possible is rebuilding real evidence, through small completed actions, that you can act and be trusted -- by yourself first.",
  },
  {
    slug: "decision-making-boundaries",
    secondaryLoss: "Decision-Making / Boundaries",
    title: "The Loss of Decision-Making / Boundaries",
    virtueFamily: "Fortitude",
    virtueElements: ["Courage", "Steadfast", "Resilience", "Assertive", "Bravery"],
    humanQuestion: "What do I choose when fear, guilt, shame, or doubt are present?",
    dorianLesson: "I need to know my boundaries and know that I am safe within them.",
    whatItIs:
      "A class about the moment fear, guilt, shame, or doubt start making decisions for you -- and about the Fortitude it takes to know your boundaries and choose from inside them anyway.",
    whatItTeaches:
      "This class helps someone learn that fear, guilt, shame, and doubt don't have to be the ones deciding. Fortitude is choosing anyway, from inside boundaries that keep you safe.",
    hikeLesson: HIKE_SOURCE_NOTE,
    hikeLessonSourceNote: HIKE_SOURCE_NOTE,
    virtueLooksLike: VIRTUE_FAMILY_LOOKS_LIKE.fortitude,
    personalRecognition: [
      { prompt: "Which of the four is loudest for me", helper: "Fear, guilt, shame, or doubt?" },
      { prompt: "A decision it's been interfering with", helper: "Name it, even loosely." },
      { prompt: "What boundary would make this safer to decide", helper: "What structure or limit would help?" },
    ],
    chemistryActivity:
      "Fortitude includes Courage, Steadfast, Resilience, Assertive, and more. Which one already shows up when you think of a hard decision you've made before, even a small one?",
    practice:
      "This week, name one decision you've been avoiding, name which of the four is loudest, set one small boundary that would make it safer -- then decide, inside that boundary.",
    whatBecomesPossible:
      "Not a promise that fear, guilt, shame, or doubt disappear. What can become possible is building a real boundary and choosing safely inside it, without waiting for those feelings to go away first.",
  },
  {
    slug: "lifes-vision",
    secondaryLoss: "Life's Vision",
    title: "The Loss of Life's Vision",
    virtueFamily: "Wisdom",
    virtueElements: ["Discernment", "Understanding", "Vision", "Intuition", "Prudence"],
    humanQuestion: "Where do I belong?",
    dorianLesson: "I need grounding, belonging, and some understanding of place, home, and direction.",
    whatItIs:
      "A class about the disorientation of not knowing where you belong anymore -- home, place, direction, or a picture of the life you were building -- and the Wisdom it takes to find grounding again.",
    whatItTeaches:
      "This class helps someone learn that belonging and life's vision can be rebuilt through discernment, even when the picture you were building is no longer the one in front of you.",
    hikeLesson: HIKE_SOURCE_NOTE,
    hikeLessonSourceNote: HIKE_SOURCE_NOTE,
    virtueLooksLike: VIRTUE_FAMILY_LOOKS_LIKE.wisdom,
    personalRecognition: [
      { prompt: "Where belonging feels uncertain", helper: "A place, a relationship, a role." },
      { prompt: "What used to ground me", helper: "What gave you a sense of home or place before?" },
      { prompt: "What still grounds me now", helper: "Even something small or unexpected." },
    ],
    chemistryActivity:
      "Wisdom includes Discernment, Understanding, Vision, Intuition, and more. Which one already shows up when you think about your own sense of place or direction?",
    practice:
      "Once this week, spend ten quiet minutes somewhere that currently feels most like grounding -- even imperfectly -- and simply notice what belonging feels like there.",
    whatBecomesPossible:
      "Not a promise of a fast or final answer to where you belong. What can become possible is practicing real discernment about grounding, trusting that clarity can build over time.",
  },
  {
    slug: "connection",
    secondaryLoss: "Connection",
    title: "The Loss of Connection",
    virtueFamily: "Justice",
    virtueElements: ["Fairness", "Respect", "Dignity", "Honesty", "Equality"],
    humanQuestion: "What does fair, honest, reciprocal connection look like?",
    dorianLesson: "Connection includes fairness, honesty, reciprocity, dignity, and respect for another person's perspective.",
    whatItIs:
      "A class about relationships and connections that feel unfair, unreciprocated, or unequal -- and about what Justice offers: fairness, honesty, reciprocity, dignity, and respect for another person's perspective.",
    whatItTeaches:
      "This class helps someone learn to name, without accusation, what fair and reciprocal connection actually requires -- and to tell the difference between a relationship that's simply different from what they expected and one that's genuinely unjust.",
    hikeLesson: HIKE_SOURCE_NOTE,
    hikeLessonSourceNote: HIKE_SOURCE_NOTE,
    virtueLooksLike: VIRTUE_FAMILY_LOOKS_LIKE.justice,
    personalRecognition: [
      { prompt: "The connection that feels uneven", helper: "Name it, without needing to justify the feeling." },
      { prompt: "Which of the five feels missing", helper: "Fairness, honesty, reciprocity, dignity, or respect for your perspective." },
      { prompt: "Is this different, or unfair?", helper: "Not what you expected, or genuinely lacking one of the five?" },
    ],
    chemistryActivity:
      "Justice includes Fairness, Respect, Dignity, Honesty, and more. Which one already shows up in a relationship that DOES feel fair and reciprocal to you?",
    practice:
      "This week, in one relationship, practice naming your own experience honestly (“I've noticed I do most of the reaching out”) without accusation.",
    whatBecomesPossible:
      "Not a promise that every relationship becomes perfectly reciprocal. What can become possible is having real language to evaluate a connection honestly, and the dignity to name what's missing.",
  },
  {
    slug: "control",
    secondaryLoss: "Control",
    title: "The Loss of Control",
    virtueFamily: "Self-Control",
    virtueElements: ["Awareness", "Patience", "Peace", "Temperance", "Moderation"],
    humanQuestion: "What is actually mine to govern?",
    dorianLesson:
      "I need to understand what I can govern in myself and how I participate when I cannot control life, situations, other people, or the future.",
    whatItIs:
      "A class about feeling overwhelmed -- and about the real, sometimes narrow difference between what's actually yours to govern and what never was.",
    whatItTeaches:
      "This class helps someone learn to separate what they can govern in themselves from what they cannot control in life, other people, or the future -- and to practice Self-Control specifically on the first.",
    hikeLesson: HIKE_SOURCE_NOTE,
    hikeLessonSourceNote: HIKE_SOURCE_NOTE,
    virtueLooksLike: VIRTUE_FAMILY_LOOKS_LIKE["self-control"],
    personalRecognition: [
      { prompt: "What's overwhelming me right now", helper: "Name it plainly." },
      { prompt: "What I cannot control in this", helper: "Be specific and honest." },
      { prompt: "What I can actually govern in myself, here", helper: "Your response, effort, attention, integrity." },
    ],
    chemistryActivity:
      "Self-Control includes Awareness, Patience, Peace, Temperance, and more. Which one already shows up when you think of a time you navigated something overwhelming without losing yourself?",
    practice:
      "Once this week, when you notice overwhelm rising, write two short lists: what I can't control here, what I can. Choose one small action from the second list only.",
    whatBecomesPossible:
      "Not a promise that overwhelming circumstances become controllable. What can become possible is recognizing exactly what's yours to govern, and finding real participation possible even inside what isn't.",
  },
  {
    slug: "identity",
    secondaryLoss: "Identity",
    title: "The Loss of Identity",
    virtueFamily: "Integrity",
    virtueElements: ["Authenticity", "Character", "Principles", "Genuineness", "Reliability"],
    humanQuestion: "Who am I?",
    dorianLesson: "I need to know who I am as an individual, what I stand for, and what my values are.",
    whatItIs:
      "A class about the question “who am I?” when a role, relationship, or identity you relied on is gone -- and about the Integrity it takes to find out what actually still stands.",
    whatItTeaches:
      "This class helps someone learn to separate identity borrowed from a role from identity that's genuinely their own -- values and character that remain, even when a role is gone.",
    hikeLesson: HIKE_SOURCE_NOTE,
    hikeLessonSourceNote: HIKE_SOURCE_NOTE,
    virtueLooksLike: VIRTUE_FAMILY_LOOKS_LIKE.integrity,
    personalRecognition: [
      { prompt: "The role or identity that changed", helper: "Name it plainly." },
      { prompt: "The values underneath the role", helper: "What did that role let you express -- love, responsibility, care?" },
      { prompt: "What still stands, without the role", helper: "Which of those values are still true about you right now?" },
    ],
    chemistryActivity:
      "Integrity includes Authenticity, Character, Principles, and more. Which one already shows up when you think of what you'd want to still be true about you, no matter what role you hold?",
    practice:
      "Once this week, notice one moment you act from a value that has nothing to do with any role, and name to yourself: “this is mine, independent of any title.”",
    whatBecomesPossible:
      "Not a promise of a fully settled sense of identity. What can become possible is recognizing real, durable values and character that remain true, even when a role that once expressed them has changed.",
  },
  {
    slug: "attachment-support",
    secondaryLoss: "Attachment / Support",
    title: "The Loss of Attachment / Support",
    virtueFamily: "Love",
    virtueElements: ["Devotion", "Loyalty", "Compassion", "Cherish", "Kindness"],
    humanQuestion: "Who am I connected to, and what does connection mean?",
    dorianLesson: "Human beings need connection, bonding, security, inclusion, and meaningful attachment.",
    whatItIs:
      "The final class in the collection -- about who you've lost, who you're still connected to, and whether those attachments are real. About Love as bonding, security, and inclusion, not only romance.",
    whatItTeaches:
      "This class helps someone learn that connection and attachment are genuine needs, not weaknesses -- and that even after real loss, you can recognize the attachments that remain real and can be trusted.",
    hikeLesson: HIKE_SOURCE_NOTE,
    hikeLessonSourceNote: HIKE_SOURCE_NOTE,
    virtueLooksLike: VIRTUE_FAMILY_LOOKS_LIKE.love,
    personalRecognition: [
      { prompt: "Who I've lost", helper: "Named plainly, however that loss looks for you." },
      { prompt: "Who I'm still connected to", helper: "People present in your life now, even if the connection has changed." },
      { prompt: "Is this attachment real?", helper: "For one relationship -- what makes it feel real and trustworthy?" },
    ],
    chemistryActivity:
      "Love includes Devotion, Loyalty, Compassion, and more. Which one already shows up in a connection you trust right now?",
    practice:
      "This week, reach out to one person you're genuinely attached to -- even briefly -- and name, in your own words, that the connection matters to you.",
    whatBecomesPossible:
      "Not a promise that loss stops hurting. What can become possible is recognizing which connections are real and trustworthy right now, and carrying attachment to what's gone alongside investment in what remains.",
  },
];

export function getViewFromAboveClass(slug: string): ViewFromAboveClass | undefined {
  return VIEW_FROM_ABOVE_CLASSES.find((c) => c.slug === slug);
}
