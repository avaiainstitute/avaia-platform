// The Chemistry of Virtue - the authoritative AVAIA data.
//
// Source: "The AVAIA Institutional Manual" + the official Chemistry of Virtue(R)
// table (Dorian Johnson / Avaia Enterprises, LLC). 10 families, 123 elements,
// each with the Manual's own definition and the OFFICIAL two-letter symbol from
// the table ("do not make changes"). Nothing here is invented.
//
// A few symbols intentionally repeat ACROSS families (Ad, Hp, Id, Mo), per the
// official table; distinguish elements by name + family, never symbol alone.

export type VirtueFamilyKey =
  | "wisdom"
  | "justice"
  | "fortitude"
  | "self-control"
  | "love"
  | "positive-attitude"
  | "hard-work"
  | "integrity"
  | "gratitude"
  | "humility";

export interface VirtueFamily {
  key: VirtueFamilyKey;
  name: string;
  color: string;
  definition: string;
}

export interface Virtue {
  /** Official two-letter symbol from the Chemistry of Virtue table. */
  symbol: string;
  name: string;
  family: VirtueFamilyKey;
  definition: string;
}

export const VIRTUE_FAMILIES: VirtueFamily[] = [
  { key: "wisdom", name: "Wisdom", color: "#3f6fd4", definition: "Wisdom is using good judgment, which enables us to make responsible decisions that are both good for us and good for others." },
  { key: "justice", name: "Justice", color: "#8f1d1d", definition: "Justice is respecting the rights of all persons, including ourselves. It includes many of the interpersonal virtues that offer dignity to a person." },
  { key: "fortitude", name: "Fortitude", color: "#1c7a4a", definition: "Fortitude helps us make the hard right decision instead of the easy wrong one. It is the strength that enables us to overcome and withstand the hardships, defeats, inconveniences, and pain that comes with life." },
  { key: "self-control", name: "Self-Control", color: "#7a3b34", definition: "Also known as the virtue Temperance, it is the ability to self-govern ourselves. It enables us to control our appetites and passions, and delay instant gratification as we work for our own higher goals." },
  { key: "love", name: "Love", color: "#d1352b", definition: "Love goes beyond Justice because it offers more than fairness requires. Selfless love includes the willingness to sacrifice one's own self for the sake of someone else, and expecting nothing in return." },
  { key: "positive-attitude", name: "Positive Attitude", color: "#6a4fb0", definition: "With a Positive Attitude, you are an asset to yourself and others around you. Hope, enthusiasm, being easy-going, and a sense of humor are characteristics and strengths of one who has a positive attitude." },
  { key: "hard-work", name: "Hard Work", color: "#3a97b8", definition: "There is no substitute in life for Hard Work. It includes initiative, diligence, goal-setting, and resourcefulness." },
  { key: "integrity", name: "Integrity", color: "#e08a1e", definition: "Integrity is different than honesty (being truthful with others) because we are being honest with ourselves and who we authentically are. It is being consistent in our actions and words in any given situation." },
  { key: "gratitude", name: "Gratitude", color: "#e888b8", definition: "Gratitude is the secret to a happy life. It is being thankful for the little things that help us truly be happy and help us find joy. It is an act of our own choosing." },
  { key: "humility", name: "Humility", color: "#8fae4a", definition: "Humility may be the foundation of a person living a truly moral life because it is being aware of our own imperfections and having a willingness to change. Humility is vital in order to acquire all of the other virtues." },
];

export const VIRTUES: Virtue[] = [
  // Wisdom
  { symbol: "Bl", name: "Balance", family: "wisdom", definition: "Mental or emotional stability" },
  { symbol: "Cp", name: "Capacity", family: "wisdom", definition: "The ability, depth or power to do, experience, or understand something" },
  { symbol: "Ce", name: "Change", family: "wisdom", definition: "To make or become different in person or circumstance" },
  { symbol: "Cr", name: "Creativity", family: "wisdom", definition: "The ability to make new things or think of new ideas" },
  { symbol: "Ct", name: "Critical thinking", family: "wisdom", definition: "Judging a particular opinion, belief, or idea in an objective way using reason and logic" },
  { symbol: "Dt", name: "Discernment", family: "wisdom", definition: "Being able to determine the value or quality of something; going past a perception of something and making detailed judgments" },
  { symbol: "Im", name: "Imagination", family: "wisdom", definition: "Having or showing an ability to think of new and interesting ideas;  having or showing imagination" },
  { symbol: "Iu", name: "Intuition", family: "wisdom", definition: "The ability to understand something immediately, without the need for conscious reasoning" },
  { symbol: "Jd", name: "Judgment", family: "wisdom", definition: "Making well considered or decisions or come to sensible conclusions" },
  { symbol: "Kn", name: "Knowledge", family: "wisdom", definition: "The information, understanding, or skills that a person gains through education or experience; the state of knowing about a particular fact or situation" },
  { symbol: "Li", name: "Light", family: "wisdom", definition: "The natural agent that stimulates sight and makes things visible" },
  { symbol: "Lg", name: "Logic", family: "wisdom", definition: "Reasoning conducted or assessed according to strict principles of validity" },
  { symbol: "Oj", name: "Objectivity", family: "wisdom", definition: "Not influenced by personal feelings or opinions in considering and representing facts" },
  { symbol: "Og", name: "Originality", family: "wisdom", definition: "The ability to think independently and creatively" },
  { symbol: "Pc", name: "Percipience", family: "wisdom", definition: "Having a good understanding of things; the ability to be perceptive." },
  { symbol: "Pi", name: "Priority", family: "wisdom", definition: "The fact or condition of being regarded or treated as more important than others" },
  { symbol: "Pr", name: "Prudence", family: "wisdom", definition: "Wise or careful in conduct; being shrewd or thrifty in planning ahead" },
  { symbol: "Re", name: "Reason", family: "wisdom", definition: "The power of the mind to think, understand, and form judgments logically" },
  { symbol: "Sp", name: "Simplicity", family: "wisdom", definition: "The quality or condition of being easy, plain, or uncomplicated to understand or do" },
  { symbol: "Su", name: "Spirituality", family: "wisdom", definition: "Being concerned with the human spirit or soul as opposed to material or physical things" },
  { symbol: "Un", name: "Understanding", family: "wisdom", definition: "A person's ability to comprehend something through use of their intellect, perception, or judgment" },
  { symbol: "Vs", name: "Vision", family: "wisdom", definition: "The ability to see, think about, or plan the future with great imagination and intelligence" },
  { symbol: "Wn", name: "Wonder", family: "wisdom", definition: "A feeling caused by seeing something that is very surprising, beautiful, or amazing" },
  // Justice
  { symbol: "Ac", name: "Acceptance", family: "justice", definition: "The act of accepting something or someone unconditionally" },
  { symbol: "Bg", name: "Benignity", family: "justice", definition: "Kindness or tolerance toward others" },
  { symbol: "Cl", name: "Chivalry", family: "justice", definition: "The outward display of respect towards another person that shows a sense of honor, especially by men towards women" },
  { symbol: "Cv", name: "Civility", family: "justice", definition: "Formal politeness and courtesy in behavior or speech; using polite remarks in any conversation" },
  { symbol: "Co", name: "Courtesy", family: "justice", definition: "The act of politeness in one's attitude and behavior toward someone or something" },
  { symbol: "Di", name: "Dignity", family: "justice", definition: "A sense of being worthy of honor or respect" },
  { symbol: "Eq", name: "Equality", family: "justice", definition: "Being equal, especially in status, rights, or opportunities" },
  { symbol: "Fr", name: "Fairness", family: "justice", definition: "Treating people in a way that does not favor some over others" },
  { symbol: "Gr", name: "Grace", family: "justice", definition: "Unmerited favor, kindness and mercy" },
  { symbol: "He", name: "Honesty", family: "justice", definition: "The quality of being fair and truthful" },
  { symbol: "Hn", name: "Honor", family: "justice", definition: "Respect that is given to someone who is loved and admired" },
  { symbol: "Ip", name: "Impartial", family: "justice", definition: "The ability to be fair and have an inclination to weigh both views or opinions equally without any bias" },
  { symbol: "Rp", name: "Respect", family: "justice", definition: "A feeling of deep admiration for someone or something; a personal regard for the feelings, wishes, or rights of others" },
  { symbol: "Tl", name: "Tolerance", family: "justice", definition: "The ability, willingness, or capacity to endure continued subjection to someone or something a without forbearance or interference" },
  { symbol: "Tr", name: "Truth", family: "justice", definition: "That which is true or in accordance with fact or reality; a fact or belief that is accepted as being true" },
  // Fortitude
  { symbol: "As", name: "Assertive", family: "fortitude", definition: "Having or showing a confident personality" },
  { symbol: "Bv", name: "Bravery", family: "fortitude", definition: "A quality of spirit what enables you to face danger without showing fear" },
  { symbol: "Cf", name: "Confidence", family: "fortitude", definition: "A feeling or belief that you can do something well or succeed at something" },
  { symbol: "Cg", name: "Courage", family: "fortitude", definition: "Mental or moral strength to venture, persevere, and withstand danger, fear, or difficulty" },
  { symbol: "Fl", name: "Fearlessness", family: "fortitude", definition: "Lacking in or showing no fear" },
  { symbol: "Id", name: "Independent", family: "fortitude", definition: "A feeling or belief that you can do something well or succeed at something" },
  { symbol: "Mg", name: "Magnanimity", family: "fortitude", definition: "Being great of mind and heart.  It encompasses, usually, a refusal to be petty, a willingness to face danger, and actions for noble purposes" },
  { symbol: "Rs", name: "Resilience", family: "fortitude", definition: "The capacity to recover quickly from difficulties; toughness" },
  { symbol: "Sf", name: "Steadfast", family: "fortitude", definition: "Being firm and unwavering in purpose, resolution, faith, etc." },
  { symbol: "Vl", name: "Valor", family: "fortitude", definition: "Having great courage in the face of danger" },
  // Self-Control
  { symbol: "Aw", name: "Awareness", family: "self-control", definition: "The knowledge or perception of a particular situation or fact" },
  { symbol: "Fi", name: "Fidelity", family: "self-control", definition: "faithfulness to a person, cause, or belief, demonstrated by continuing loyalty and support." },
  { symbol: "Ls", name: "Long-suffering", family: "self-control", definition: "Having or showing patience in spite of troubles, especially those caused by other people" },
  { symbol: "Mc", name: "Mercy", family: "self-control", definition: "Compassion or forgiveness shown towards someone whom it is within one's power to punish or harm" },
  { symbol: "Mn", name: "Mindfulness", family: "self-control", definition: "A mental state achieved by focusing one's awareness on the present moment, while calmly acknowledging and accepting one's feelings, thoughts, and bodily sensations" },
  { symbol: "Mo", name: "Moderation", family: "self-control", definition: "Within reasonable limits; not to excess" },
  { symbol: "Ob", name: "Obedience", family: "self-control", definition: "Compliance with an order, request, or law or submission to authority" },
  { symbol: "Pn", name: "Patience", family: "self-control", definition: "The ability to wait or tolerate delay without becoming annoyed or upset" },
  { symbol: "Pe", name: "Peace", family: "self-control", definition: "A state of tranquility or quietness" },
  { symbol: "Pu", name: "Purity", family: "self-control", definition: "Freedom from adulteration or contamination in any form" },
  { symbol: "Tm", name: "Temperance", family: "self-control", definition: "Moderation in the indulgence of the appetites or passions" },
  // Love
  { symbol: "Ad", name: "Adoration", family: "love", definition: "A deep love and respect for someone or something" },
  { symbol: "Am", name: "Admiration", family: "love", definition: "A feeling of high level of respect, approval, or appreciation for someone or something.  It often leads to a desire of emulation or aspiration towards the admired person or attribute." },
  { symbol: "Bn", name: "Benevolence", family: "love", definition: "Well meaning and kind" },
  { symbol: "Ch", name: "Charity", family: "love", definition: "Generosity and helpfulness especially toward the needy or suffering; it is the pure love of Christ" },
  { symbol: "Ci", name: "Cherish", family: "love", definition: "To protect and care for (someone or something) lovingly.  To treat with affection" },
  { symbol: "Cm", name: "Compassion", family: "love", definition: "Sympathetic consciousness of others’ distress together with a desire to alleviate it" },
  { symbol: "Dv", name: "Devotion", family: "love", definition: "Being loyal or enthusiastic towards someone or something" },
  { symbol: "Fg", name: "Forgiveness", family: "love", definition: "to cease to feel resentment against (an offender)" },
  { symbol: "Ge", name: "Generosity", family: "love", definition: "Being kind, understanding, and not selfish" },
  { symbol: "Hp", name: "Helpfulness", family: "love", definition: "Being useful; giving or ready to offer or give help" },
  { symbol: "Hs", name: "Hospitality", family: "love", definition: "Kindness and friendly behavior" },
  { symbol: "Kd", name: "Kindness", family: "love", definition: "The act or the state of being generous and considerate as well as compassionate towards others" },
  { symbol: "Ly", name: "Loyalty", family: "love", definition: "The act of binding yourself (intellectually or emotionally) to a course of action; feelings of allegiance" },
  { symbol: "Nr", name: "Nurturing", family: "love", definition: "Care for, protecting, or cherishing someone or something" },
  { symbol: "Sc", name: "Sacrifice", family: "love", definition: "A loss or something you give up, usually for the sake of a better cause" },
  { symbol: "Sy", name: "Sympathy", family: "love", definition: "Feeling of pity or sense of compassion towards someone; wanting to help someone in need" },
  { symbol: "Tg", name: "Thoughtfulness", family: "love", definition: "Taking into consideration or seeing to the needs of other people" },
  { symbol: "Yn", name: "Yearning", family: "love", definition: "Having an intense feeling of longing for something, typically something that one has lost or been separated from.  Being filled with compassion or a warm feeling." },
  // Positive Attitude
  { symbol: "Ad", name: "Adaptability", family: "positive-attitude", definition: "The quality of being able to adjust to new conditions; the capacity to be modified for a new use or purpose" },
  { symbol: "Be", name: "Beauty", family: "positive-attitude", definition: "A combination of qualities that pleases the intellect; denoting something intended to make someone or more attractive" },
  { symbol: "Cs", name: "Cheerfulness", family: "positive-attitude", definition: "Being noticeably happy and optimistic" },
  { symbol: "Fa", name: "Faith", family: "positive-attitude", definition: "A strong belief or trust in someone or something" },
  { symbol: "Fx", name: "Flexibility", family: "positive-attitude", definition: "The willingness to change or to try different things" },
  { symbol: "Hp", name: "Hope", family: "positive-attitude", definition: "To want something to happen or be true; to think and believe that something could happen or be true" },
  { symbol: "Hm", name: "Humor", family: "positive-attitude", definition: "A mood or state of mind that allows for the ability to express themselves in a way to amuse themselves or other people" },
  { symbol: "Jy", name: "Joy", family: "positive-attitude", definition: "Feeling, causing, or showing great lasting happiness" },
  { symbol: "Op", name: "Optimism", family: "positive-attitude", definition: "hopefulness and confidence about the future or the successful outcome of something." },
  { symbol: "Rv", name: "Reverence", family: "positive-attitude", definition: "Honor or respect that is felt for or shown to someone or something" },
  { symbol: "Se", name: "Serenity", family: "positive-attitude", definition: "The state of being calm, peaceful, and untroubled" },
  { symbol: "Zl", name: "Zeal", family: "positive-attitude", definition: "A feeling of strong eagerness.  A positive feeling of wanting to push ahead with something." },
  // Hard Work
  { symbol: "Ab", name: "Ambition", family: "hard-work", definition: "Having a strong desire for success or achievement" },
  { symbol: "Cy", name: "Community", family: "hard-work", definition: "A particular area or place considered together unified by common interests, social values and/or responsibilities" },
  { symbol: "Dc", name: "Dedication", family: "hard-work", definition: "Being dedicated or committed to a task or purpose" },
  { symbol: "De", name: "Determination", family: "hard-work", definition: "The quality of being firm in purpose" },
  { symbol: "Dg", name: "Diligence", family: "hard-work", definition: "Careful and persistent work or effort" },
  { symbol: "Ds", name: "Discipline", family: "hard-work", definition: "To train oneself to do something in a controlled and habitual way." },
  { symbol: "En", name: "Endurance", family: "hard-work", definition: "The capacity of something to last or to withstand an often unpleasant or difficult process or situation without giving way" },
  { symbol: "Pa", name: "Passion", family: "hard-work", definition: "Having, showing, or expressing strong emotions or beliefs in someone or something" },
  { symbol: "Pv", name: "Perseverance", family: "hard-work", definition: "Continued effort to do or achieve something   despite difficulties, failure, or opposition" },
  { symbol: "Pt", name: "Persistence", family: "hard-work", definition: "Having determination, being relentless and never-ceasing" },
  { symbol: "Sr", name: "Self-reliance", family: "hard-work", definition: "Reliance on one's own powers and resources rather than those of others." },
  { symbol: "Tc", name: "Tenacity", family: "hard-work", definition: "Being persistent in maintaining, adhering to, or seeking something valued or desired THANKFUL Being conscious of benefit received" },
  { symbol: "Th", name: "Thrift", family: "hard-work", definition: "The careful use of money or other goods; being frugal" },
  { symbol: "Ti", name: "Time", family: "hard-work", definition: "the indefinite continued progress of existence and events in the past, present, and future regarded as a whole." },
  // Integrity
  { symbol: "Ay", name: "Authenticity", family: "integrity", definition: "True to one’s own personality, spirit, or character" },
  { symbol: "Ca", name: "Character", family: "integrity", definition: "The moral qualities distinctive to an individual based on strength and originality in a person's nature or reputation" },
  { symbol: "Et", name: "Ethical", family: "integrity", definition: "As to relating with morally good, correct, and upright principles and standards" },
  { symbol: "Ex", name: "Excellence", family: "integrity", definition: "The quality of being outstanding or extremely good" },
  { symbol: "Gn", name: "Genuineness", family: "integrity", definition: "Being authentic and sincere" },
  { symbol: "Id", name: "Individuality", family: "integrity", definition: "The quality or character of a particular person or thing that distinguishes them from others of the same kind, especially when strongly marked" },
  { symbol: "In", name: "Innocence", family: "integrity", definition: "Lack of guile or corruption; purity" },
  { symbol: "Mo", name: "Morality", family: "integrity", definition: "The differentiation of intentions, decisions, and actions between what is considered \"good\" or \"bad\", \"right\" or \"wrong\"" },
  { symbol: "Nb", name: "Nobility", family: "integrity", definition: "Having or showing fine personal qualities or high moral principles" },
  { symbol: "Ps", name: "Principles", family: "integrity", definition: "A moral rule or strong belief that influences your actions" },
  { symbol: "Pb", name: "Probity", family: "integrity", definition: "the quality of having strong moral principles; honesty and decency" },
  { symbol: "Rl", name: "Reliability", family: "integrity", definition: "Being trustworthy or consistent" },
  { symbol: "Vu", name: "Vulnerability", family: "integrity", definition: "Being completely open and exposed physically, mentally, or emotionally to the possibility of anything that can happen" },
  // Gratitude
  { symbol: "Ap", name: "Appreciation", family: "gratitude", definition: "Showing gratitude or recognition of the good qualities of someone or something" },
  { symbol: "Gt", name: "Gratefulness", family: "gratitude", definition: "warmly or deeply appreciative of kindness or benefits received; thankful: expressing deep felt gratitude HAPPINESS A mental or emotional state of well-being characterized by positive or pleasant emotions ranging from contentment to intense joy" },
  { symbol: "Tf", name: "Thankfulness", family: "gratitude", definition: "Being conscious of benefit received." },
  // Humility
  { symbol: "Mk", name: "Meekness", family: "humility", definition: "The feeling of patience, being humble and submissive; having a disposition to be patient and long suffering" },
  { symbol: "Md", name: "Modesty", family: "humility", definition: "The quality of not being too proud or confident about yourself or your abilities" },
  { symbol: "Sn", name: "Sincerity", family: "humility", definition: "The absence of pretense, deceit, or hypocrisy" },
  { symbol: "Up", name: "Unpretentious", family: "humility", definition: "Not attempting to impress others with an appearance of greater importance, talent, or culture than is actually possessed" },
];

export function familyOf(key: VirtueFamilyKey): VirtueFamily {
  return VIRTUE_FAMILIES.find((f) => f.key === key)!;
}

/** Same lookup as familyOf, keyed by the family's display name instead --
 *  what stored data (referral virtue classifications, virtue_signature_
 *  entries) actually holds, per VirtueClassification's own shape. Returns
 *  undefined rather than throwing on an unrecognized name, since this is
 *  used to color/render already-validated-elsewhere data, not to gate it. */
export function familyByName(name: string): VirtueFamily | undefined {
  return VIRTUE_FAMILIES.find((f) => f.name === name);
}

export function virtuesByFamily(key: VirtueFamilyKey): Virtue[] {
  return VIRTUES.filter((v) => v.family === key);
}

// ---------------------------------------------------------------------------
// Authoritative hierarchy for conversational/referral use. Root cause of the
// "Serenity promoted to a standalone virtue" / "Trust classified as a virtue"
// finding: no prompt anywhere ever referenced this canonical data -- CAT and
// InnerCompass improvised from a separately hand-authored, approximate
// family/example-word list embedded in VIRTUE_TABLE_INTEGRATION instead. This
// is now the single source every virtue-classification prompt and every
// server-side validation should use, so nothing drifts from the real 123-
// element table again.
// ---------------------------------------------------------------------------

/** Plain-text "Family: Element, Element, ..." rendering of the complete
 *  Chemistry of Virtue, generated directly from VIRTUE_FAMILIES/VIRTUES --
 *  never hand-copied, so it can't drift from the canonical table. */
export function formatVirtueHierarchy(): string {
  return VIRTUE_FAMILIES.map((family) => {
    const elements = virtuesByFamily(family.key).map((v) => v.name);
    return `${family.name}: ${elements.join(", ")}`;
  }).join("\n");
}

/** True only if familyName exactly matches one of the ten official Chemistry
 *  of Virtue family display names (e.g. "Positive Attitude"). */
export function isValidVirtueFamily(familyName: string): boolean {
  return VIRTUE_FAMILIES.some((f) => f.name === familyName);
}

/** True only if elementName is a real Chemistry of Virtue element that
 *  belongs to familyName specifically -- not just a real element of some
 *  other family. Case-insensitive on the element name only. */
export function isValidVirtueElement(familyName: string, elementName: string): boolean {
  const family = VIRTUE_FAMILIES.find((f) => f.name === familyName);
  if (!family) return false;
  return virtuesByFamily(family.key).some(
    (v) => v.name.toLowerCase() === elementName.trim().toLowerCase()
  );
}

// ---------------------------------------------------------------------------
// Name-to-virtue acronym — one curated element per letter, so the same name
// always spells the same thing. This is a deterministic lookup, not an AI
// pick per request, for exactly that reason: consistency and speed matter
// more here than variety.
//
// Every letter has a real Chemistry of Virtue element except Q, which has
// none. Rather than invent one or force a weak phonetic stretch, Q maps to
// "Quality" — a real, meaningful word, explicitly NOT one of the 123
// official elements, the same treatment Audacity gets in Defying Grief: a
// seat at the table anyway, clearly marked as not officially part of the
// Chemistry of Virtue. X has a genuine element close enough to use as-is:
// "Excellence" already opens with the same sound X makes.
// ---------------------------------------------------------------------------

export const QUALITY_WORD = "Quality";

const LETTER_TO_VIRTUE_NAME: Record<string, string> = {
  A: "Authenticity",
  B: "Bravery",
  C: "Courage",
  D: "Dignity",
  E: "Excellence",
  F: "Fearlessness",
  G: "Generosity",
  H: "Honesty",
  I: "Individuality",
  J: "Joy",
  K: "Kindness",
  L: "Loyalty",
  M: "Mindfulness",
  N: "Nobility",
  O: "Originality",
  P: "Perseverance",
  // Q intentionally has no entry here -- see QUALITY_WORD above.
  R: "Respect",
  S: "Sincerity",
  T: "Truth",
  U: "Understanding",
  V: "Vision",
  W: "Wonder",
  X: "Excellence",
  Y: "Yearning",
  Z: "Zeal",
};

export type LetterVirtue =
  | { letter: string; kind: "virtue"; virtue: Virtue }
  | { letter: string; kind: "quality" }
  | { letter: string; kind: "none" };

/** Resolves a single letter to its curated virtue element, the special
 *  Quality case (Q), or "none" for anything that isn't A-Z. */
export function virtueForLetter(letter: string): LetterVirtue {
  const upper = letter.toUpperCase();
  if (!/^[A-Z]$/.test(upper)) return { letter: upper, kind: "none" };
  if (upper === "Q") return { letter: upper, kind: "quality" };
  const name = LETTER_TO_VIRTUE_NAME[upper];
  const virtue = name ? VIRTUES.find((v) => v.name === name) : undefined;
  if (!virtue) return { letter: upper, kind: "none" };
  return { letter: upper, kind: "virtue", virtue };
}

/** Resolves every letter in a name/word, in order, skipping non-letters. */
export function virtuesForName(input: string): LetterVirtue[] {
  return input
    .split("")
    .filter((ch) => /[a-zA-Z]/.test(ch))
    .map((ch) => virtueForLetter(ch));
}
