// The Grief Myth and Life Lesson threads of Defying Grief's four-thread
// architecture (Secondary Loss -> Virtue -> Grief Myth + Life Lesson),
// keyed by the same ten canonical Secondary Loss names as SECONDARY_LOSSES
// (lib/institution.ts), which already carries the Virtue thread. Source:
// Dorian's "Overview of Secondary Losses with Life Lessons, virtues, and
// myths" document, with one correction Dorian gave directly in this
// conversation: Attachment/Support's myth is "Grief is something you have
// to go through alone," not "Grief has a set timeline" (that myth belongs
// to Vision/Wisdom only, the document's own duplicate was an error).
//
// Consumed only by InnerCompass's Defying Grief layer
// (DEFYING_GRIEF_INNERCOMPASS_MYTH_LESSON in lib/engine/prompts.ts). Not a
// new stage, not a new architecture, this is the third and fourth of the
// four established Defying Grief threads (Secondary Loss and Virtue are
// already established, see SECONDARY_LOSSES and lib/view-from-above.ts).
//
// Never invent, rename, or expand this list of ten, same discipline as
// SECONDARY_LOSSES itself. Keyed to that list's own `loss` strings so a
// typo here fails loudly (undefined) rather than silently mismatching.

export type DefyingGriefThread = {
  /** The belief this Secondary Loss's Grief Myth represents, connects to
   *  the Audacity of Grief side of the existing InnerCompass choice
   *  architecture (DEFYING_GRIEF_INNERCOMPASS_CHOICE). */
  griefMyth: string;
  /** The named life lesson (mountain/trail), the practical-application
   *  side, connects to the Audacity of Happiness side of that same choice
   *  architecture. */
  lifeLessonName: string;
  /** The specific teachings/sub-points under that life lesson, Dorian's
   *  own language from the source document, not further invented. */
  lifeLessonTeachings: string[];
};

export const DEFYING_GRIEF_THREADS: Record<string, DefyingGriefThread> = {
  Meaning: {
    griefMyth: "Grief only happens when someone dies.",
    lifeLessonName: "The Value of the Hike",
    lifeLessonTeachings: [
      "It is impossible to lose everything.",
      "Understanding what is truly important in our lives.",
      "Why you must be the very best you.",
    ],
  },
  Reality: {
    griefMyth: "Strong people don't grieve.",
    lifeLessonName: "Our Thought Capacity",
    lifeLessonTeachings: [
      "The thoughts of your heart and the thoughts of your mind are two different kinds of thoughts.",
      "Learning how to express the thoughts that are from your heart.",
      "Knowing that strength comes from within.",
    ],
  },
  "Dreams / Opportunities": {
    griefMyth: "Grief is something to be fixed or cured.",
    lifeLessonName: "Steep",
    lifeLessonTeachings: [
      "Finding our own plan of happiness.",
      "We aren't there to conquer the mountain, we are there to conquer ourselves.",
      "We are not climbing for the world to see us, but for us to see the world.",
    ],
  },
  "Self-Trust": {
    griefMyth: "Time heals all wounds.",
    lifeLessonName: "Our Physical Capacity",
    lifeLessonTeachings: [
      "This life is your own professionally self-guided journey of self-discovery.",
      "You are the authority for your own journey of self-discovery.",
      "Sometimes you have to be your own hero.",
      "Why the person you “think” you are is no match for the person you really are.",
    ],
  },
  "Decision-Making / Boundaries": {
    griefMyth: "Talking about the loss will not help the situation.",
    lifeLessonName: "Dangerous Trail",
    lifeLessonTeachings: [
      "Our perception and perspective may not allow us to see things as they really are in our current situation.",
      "Giving ourselves permission, and what that means.",
      "We need to explore our own boundaries and what that means.",
      "What failure really means.",
      "Having the courage to take the first step.",
    ],
  },
  "Life's Vision": {
    griefMyth: "Grief has a set timeline.",
    lifeLessonName: "Overgrown Trail",
    lifeLessonTeachings: [
      "Knowing what an obstacle is, and what it is not.",
      "Having the vision to see past the obstacle.",
      "Seeing and taking the opportunities we are given, and knowing what to do with them.",
      "Knowing how to take the intangible and invisible inside of us and show others in a way that is tangible and visible.",
    ],
  },
  Connection: {
    griefMyth: "Grief is something you get over.",
    lifeLessonName: "Rocky Trail",
    lifeLessonTeachings: [
      "You are the authority in your own decisions.",
      "We need to trust ourselves that we will make the decisions that need to be made, as they are needed.",
      "There is no such thing as fairness when climbing the mountain. It is no respecter of persons.",
    ],
  },
  Control: {
    griefMyth: "Grief and mourning are the same thing.",
    lifeLessonName: "Long Hike",
    lifeLessonTeachings: [
      "Not getting attached to the good or the bad.",
      "Knowing what our process is, and realizing the lessons we are learning, the virtues of a caterpillar.",
      "Pacing ourselves.",
      "Being happy during the journey.",
    ],
  },
  Identity: {
    griefMyth: "Grief is the same for everyone.",
    lifeLessonName: "No Trail",
    lifeLessonTeachings: [
      "Letting go of control and allowing things to happen for our experience.",
      "Anything about that mountain is out of our control. What is in our control is how we deal with those things out of our control.",
      "Understanding that being vulnerable is not weakness. It is being completely open to our truth.",
      "How fear stops our progression.",
    ],
  },
  "Attachment / Support": {
    griefMyth: "Grief is something you have to go through alone.",
    lifeLessonName: "Support",
    lifeLessonTeachings: [
      "Knowing what it means to be lost, not all who wander are lost.",
      "Understanding that when we are looking for another “lost child,” we are able to find ourselves and the answers we have been looking for while we are lost.",
      "We all will have our own “but talk about a view” moment in life.",
    ],
  },
};

/** Plain-text rendering of the complete Myth + Life Lesson taxonomy, one
 *  block per Secondary Loss, generated directly from DEFYING_GRIEF_THREADS
 *  (never hand-copied, so it can't drift from the canonical list), for the
 *  system prompt to match against whichever Secondary Loss is already
 *  visible in this conversation's carried-forward context. Iterates
 *  Object.keys(DEFYING_GRIEF_THREADS), which mirrors SECONDARY_LOSSES'
 *  own ten-loss order exactly, same source discipline as
 *  formatSecondaryLossHierarchy in lib/institution.ts. */
export function formatDefyingGriefThreadsHierarchy(): string {
  return Object.entries(DEFYING_GRIEF_THREADS)
    .map(
      ([loss, t]) =>
        `Loss of ${loss}:\n  Grief Myth: "${t.griefMyth}"\n  Life Lesson: ${t.lifeLessonName}, ${t.lifeLessonTeachings.join("; ")}`
    )
    .join("\n\n");
}
