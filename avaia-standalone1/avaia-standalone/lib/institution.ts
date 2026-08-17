// The AVAIA institution — a single, typed source of truth.
//
// Source of record: "The AVAIA Institutional Manual" and Dorian Johnson's build
// answers (AVAIA Enterprises, LLC). Content below is drawn directly from those
// materials. Nothing is invented. Where something is still genuinely unsupplied
// (official virtue symbols, documented virtue formulas, virtue "distortions"),
// it is marked `AWAITING_SOURCE` rather than fabricated.

export const AWAITING_SOURCE = "AWAITING_SOURCE" as const;
export type AwaitingSource = typeof AWAITING_SOURCE;

export interface Pending {
  status: AwaitingSource;
  referencedIn: string;
  need: string;
}
export function pending(referencedIn: string, need: string): Pending {
  return { status: AWAITING_SOURCE, referencedIn, need };
}

import type { VirtueFamilyKey } from "./virtues";

// ---------------------------------------------------------------------------
// Layer I — Constitution
// ---------------------------------------------------------------------------

export const CONSTITUTION_PREAMBLE =
  "AVAIA exists to help individuals, relationships, families, and communities move from disruption toward understanding, from understanding toward restoration, and from restoration toward intentional participation in life. It was founded upon the belief that lasting restoration begins with understanding; that people flourish through meaningful relationships, the practice of virtue, and intentional participation; and that every individual possesses inherent worth, dignity, and the capacity for continued growth.";

export interface Article {
  n: string;
  title: string;
  text: string;
}

export const CONSTITUTION_ARTICLES: Article[] = [
  { n: "I", title: "Identity", text: "AVAIA is an institution dedicated to guided interpersonal, virtue-centered understanding and human flourishing. It is not defined by any single program, technology, conversation model, or educational resource. Its identity is preserved through its Constitution, expressed through the GIVE Method, implemented through documented operating systems, strengthened by integrated resources, and sustained through Guides who faithfully embody its principles." },
  { n: "II", title: "Mission", text: "The mission of AVAIA is to increase understanding, strengthen relationships, cultivate virtue, and encourage intentional participation in life through guided interpersonal conversation. AVAIA seeks not merely to solve problems but to restore visibility where there is confusion, understanding where there is fragmentation, and participation where life has been interrupted." },
  { n: "III", title: "Purpose", text: "The purpose of AVAIA is to provide an integrated framework through which individuals may better understand themselves, their relationships, their circumstances, and the possibilities available to them, strengthening personal agency, relational health, and human flourishing while honoring each person's autonomy and responsibility." },
  { n: "IV", title: "Core Commitments", text: "AVAIA is committed to pursuing understanding before action; honoring the dignity and worth of every individual; protecting the autonomy of the Host; cultivating wisdom through guided discovery rather than prescribed conclusions; strengthening relationships through mutual participation; encouraging virtue as a lifelong practice; supporting integrity without attempting to control outcomes; preserving hope while remaining grounded in reality; promoting participation over passivity; and building institutions that can faithfully serve future generations." },
  { n: "V", title: "The Nature of the Guide", text: "Guides do not exist to direct lives, provide identities, or determine outcomes. Their responsibility is to facilitate understanding, protect the integrity of the conversation, increase visibility, encourage thoughtful reflection, and support the Host as they discern their own path forward. Guides remain servants of the process rather than authorities over the person." },
  { n: "VI", title: "The Nature of the Host", text: "The Host remains the owner of their story, relationships, decisions, and participation. No conversation, Guide, operating system, or program shall diminish the Host's responsibility for their own life or replace their capacity for discernment. The purpose of AVAIA is not to create dependence but to strengthen understanding, confidence, and intentional participation." },
  { n: "VII", title: "The Role of Virtue", text: "AVAIA recognizes virtue as an enduring foundation for human flourishing. Virtues provide direction during uncertainty, stability during disruption, and wisdom throughout life's continual development. The cultivation of virtue is not the pursuit of perfection but the lifelong practice of becoming more fully aligned with one's highest character and values." },
  { n: "VIII", title: "Relationships", text: "AVAIA recognizes relationships as central to human life. Healthy relationships are strengthened through visibility, mutual participation, honesty, responsibility, compassion, and respect. While individuals remain responsible for their own integrity, meaningful relationships require the willing participation of all parties and cannot be sustained through the efforts of one person alone." },
  { n: "IX", title: "Stewardship", text: "Every Guide, instructor, administrator, and future leader serves as a steward of this institution. Stewardship requires preserving the integrity of AVAIA's Constitution while allowing thoughtful growth, continued learning, and responsible refinement. New ideas are welcomed when they strengthen the institution without compromising its foundational identity." },
  { n: "X", title: "Continuity", text: "AVAIA is designed to endure beyond any individual Guide, author, technology, or generation. Its Constitution provides continuity, its methodology provides consistency, its operating systems provide reliability, its resources provide support, and its Guides provide faithful implementation — together preserving an institution capable of serving people with wisdom, integrity, and compassion across generations." },
];

export const CONSTITUTION_CLOSING =
  "AVAIA exists to restore understanding where there is confusion, connection where there is isolation, virtue where there is uncertainty, and participation where life has been interrupted. May every conversation honor the dignity of the person, protect the integrity of the process, and contribute to the flourishing of individuals, relationships, families, and communities.";

// The GIVE Method — Guided Interpersonal Virtue-Centered Experience.
export const GIVE_METHOD = {
  name: "Guided Interpersonal Virtue-Centered Experience",
  purpose:
    "AVAIA's foundational methodology for facilitating human understanding, restoration, and intentional participation. Not a therapy, coaching, counseling, or treatment protocol — a structured, virtue-centered method of guided conversation that carries the Constitution into practice.",
  components: [
    { letter: "G", label: "Guided", text: "The Guide facilitates discovery without controlling the destination — protecting the conversation, increasing visibility, and supporting understanding rather than providing answers or making decisions for the Host." },
    { letter: "I", label: "Interpersonal", text: "Understanding develops through relationship — with others, and also with oneself, one's memories, values, future, and the many internal voices that influence a life." },
    { letter: "V", label: "Virtue-Centered", text: "The restoration of human flourishing is supported through the intentional development and practice of virtue, which provides direction, balance, and stability while restoring what disruption has fragmented." },
    { letter: "E", label: "Experience", text: "Lasting transformation comes through lived participation rather than information alone. Understanding becomes meaningful when it is experienced, integrated, and practiced in everyday life." },
  ],
};

// Fundamental Operating Principles (Dorian's canonical list of 18).
export interface Principle {
  title: string;
  text: string;
}
export const OPERATING_PRINCIPLES: Principle[] = [
  { title: "Understanding Before Action", text: "Sustainable action begins with sufficient understanding. AVAIA first increases visibility and clarifies relationships before encouraging decisions." },
  { title: "Discernment Over Prescription", text: "The Guide facilitates discernment rather than prescribing solutions. Wisdom emerges through understanding, not through directing outcomes." },
  { title: "The Host Owns the Conversation", text: "The Host remains the owner of their story, relationships, decisions, and participation. AVAIA strengthens autonomy rather than creating dependence." },
  { title: "The Guide Protects the Process", text: "The Guide safeguards the integrity of the conversation — protecting the table, increasing visibility, and maintaining curiosity." },
  { title: "The Witness Preserves Visibility", text: "The Witness ensures that what becomes visible is acknowledged, remembered, and integrated without judgment or control." },
  { title: "Every Voice Deserves to Be Heard; No Voice Deserves Control", text: "Every perspective has value; no single perspective should dominate the conversation or determine the outcome without discernment." },
  { title: "Relationships Require Mutual Participation", text: "Healthy relationships cannot be created or sustained through the efforts of only one person. AVAIA honors both personal responsibility and the limits of individual control." },
  { title: "Participation Matters", text: "Restoration occurs through active participation rather than passive observation. Understanding becomes meaningful when it is lived." },
  { title: "Virtue Provides Direction", text: "Virtues serve as enduring guides toward wisdom, stability, integrity, and flourishing, cultivated through practice and experience." },
  { title: "Integrity Without Outcome Control", text: "Individuals are responsible for acting with integrity but are not responsible for controlling the choices or responses of others." },
  { title: "Start With What Is Known", text: "Conversations begin with observable reality rather than assumptions, interpretations, or conclusions." },
  { title: "Small Questions Open Large Doors", text: "Simple, thoughtful questions often reveal deeper understanding than premature explanations." },
  { title: "Understand Enough", text: "The purpose of understanding is not endless exploration but sufficient clarity to support intentional participation and meaningful decisions." },
  { title: "Preserve Simplicity", text: "Complex human experiences should not be reduced to simplistic answers, nor clear understanding buried beneath unnecessary complexity." },
  { title: "Integrate Before Expanding", text: "When new ideas emerge, existing systems are examined first to see whether the concept already exists before creating new components." },
  { title: "Preserve the Architecture", text: "The architecture is not redesigned unless careful testing demonstrates a genuine structural deficiency." },
  { title: "Components Serve Functions", text: "Every component must exist to fulfill a clearly defined function within the institution." },
  { title: "Functions Serve Integration", text: "Individual functions strengthen the integrated operation of AVAIA rather than creating isolated or competing systems." },
];

// The Journey arc (Dorian, Q9).
export const JOURNEY_ARC = [
  "Disruption",
  "Fragmentation",
  "Awareness",
  "Understanding",
  "Restoration",
  "Wholeness",
  "Agency",
  "Action",
  "Intentional Participation",
];

export const JOURNEY_MOVEMENTS = [
  { name: "Awareness", text: "Naming what is present and recognizing what has become disrupted." },
  { name: "Understanding", text: "Exploring relationships, meaning, patterns, tensions, losses, virtues, and perspectives." },
  { name: "Discernment", text: "Identifying what the Host can choose, what integrity requires, and how they can participate intentionally in life." },
];

// ---------------------------------------------------------------------------
// The Table — roles and seats (Table Formation Engine)
// ---------------------------------------------------------------------------

export interface Role {
  key: string;
  name: string;
  charge: string;
}
export const ROLES: Role[] = [
  { key: "host", name: "Host", charge: "The person whose life, story, question, or situation is being explored. The Host owns the conversation and every decision, and determines what is shared, what stays private, and the pace." },
  { key: "guide", name: "Guide", charge: "A trained human Guide (or, in some implementations, an AI-supported guide function) who protects the process and facilitates understanding. The Guide never owns the outcome." },
  { key: "witness", name: "Witness", charge: "The function that preserves visibility and continuity — human, system, or both. It records what became visible so each conversation begins where the last concluded." },
  { key: "council", name: "Council", charge: "A structured set of perspectives that expands understanding. It advises, and never governs or overrides the Host." },
];

export interface Seat {
  name: string;
  text: string;
}
export const SEATS: Seat[] = [
  { name: "Host", text: "The owner of the conversation." },
  { name: "Guide", text: "The facilitator who protects the process." },
  { name: "Witness", text: "The keeper of continuity and visibility." },
  { name: "Council", text: "Invited perspectives that broaden understanding." },
  { name: "Self Seats", text: "Parts of the Host's own experience — younger self, present self, future self, wounded self, wise self, forgotten self." },
  { name: "Relationship Seats", text: "Important people or relationships connected to the Host's situation." },
  { name: "Virtue Seats", text: "Virtues invited into the conversation for direction, balance, strength, or clarity — a perspective, not a person." },
  { name: "Secondary Loss Seats", text: "Losses that may need to be recognized because they are influencing the Host's experience." },
  { name: "Empty Chair", text: "A place held for someone or something absent, unresolved, lost, unavailable, or unable to participate directly." },
];

// ---------------------------------------------------------------------------
// Layer I — How the AVAIA Conversation Works (Manual)
// ---------------------------------------------------------------------------

export const CONVERSATION_WORKS = {
  intro:
    "Every AVAIA conversation follows the same operating philosophy. Although each stage has a unique purpose, the structure stays consistent throughout the journey. The Host experiences one natural conversation; behind the scenes, AVAIA continuously recognizes patterns, preserves continuity, and increases understanding. The Host never needs to manage the process — the Guide does.",
  roles: [
    { name: "The Host", text: "The individual seeking greater understanding. The Host owns the conversation and every decision, and determines what is shared, what stays private, and how quickly the conversation moves. The Host is never pressured toward a conclusion — their responsibility is simply to participate honestly." },
    { name: "The Guide", text: "The facilitator. Rather than directing the Host, the Guide creates conditions where understanding can naturally emerge — listening deeply, recognizing patterns, inviting exploration, protecting psychological safety, preventing premature conclusions, and preparing the referral for the next stage. The Guide never owns the outcome; the Guide protects the process." },
    { name: "The Witness", text: "Present throughout the entire journey, quietly observing to preserve continuity. The Witness records what became visible — not what should have happened — without judging or persuading, so each conversation begins where the last concluded rather than starting over." },
  ],
  principles: [
    "The Host owns the table.",
    "The Guide protects the table.",
    "The Witness preserves the journey.",
    "Every voice deserves to be heard; no voice deserves control.",
    "Emotional voices are fully heard but do not govern the conversation.",
    "Virtues remain available throughout as restorative perspectives.",
    "The purpose is increased understanding, not agreement.",
    "Understanding comes before decision; decisions always belong to the Host.",
  ],
};

// ---------------------------------------------------------------------------
// Layer I — Relationship Between All Components (Manual)
// ---------------------------------------------------------------------------

export const COMPONENT_RELATIONSHIPS = {
  intro:
    "AVAIA functions as an integrated institution whose strength comes from the relationship between its components rather than any single program, conversation, or resource. Every component serves a distinct purpose while supporting the whole.",
  relationships: [
    { name: "Constitution", text: "Establishes AVAIA's identity, philosophy, governing principles, and boundaries — the permanent foundation for everything else." },
    { name: "GIVE Method", text: "Defines the relational methodology through which the constitutional principles are expressed in practice." },
    { name: "Core Conversations", text: "IAP, CAT, InnerCompass, and Preparation each implement the GIVE Method within a specific stage of the Journey." },
    { name: "Operating Systems", text: "The Guide, Witness, and Council systems define the responsibilities, posture, and interaction of each role." },
    { name: "Core Engines", text: "The Table Formation Engine, Chemistry of Virtue, and Secondary Loss Engine provide the tools for observation, organization, and integration." },
    { name: "Organizational Operations", text: "The Workbook, GPT directory, workflow maps, and document index provide continuity, consistency, and coordination." },
    { name: "Programs", text: "Apply AVAIA's methodology to specific populations, settings, and pathways without altering the foundational principles." },
    { name: "Resource Library", text: "Equips Guides through research, worksheets, templates, and educational resources." },
  ],
  integration:
    "No component operates independently. Each exists to strengthen every other while preserving the integrity of the institution as a unified whole.",
};

// ---------------------------------------------------------------------------
// Layer I — Governance & Future Development Policy (Manual)
// ---------------------------------------------------------------------------

export const GOVERNANCE = {
  intro:
    "The Governance and Future Development Policy preserves AVAIA's constitutional identity while allowing thoughtful growth, refinement, and responsible expansion over time.",
  standards: [
    { title: "The Constitution Governs the Institution", text: "All future development remains consistent with the principles established within the Constitution." },
    { title: "Preserve the Architecture", text: "The architecture is not redesigned unless careful testing demonstrates a genuine structural deficiency." },
    { title: "Integrate Before Expanding", text: "When new ideas emerge, existing systems are examined first to see whether the concept already exists before creating new components." },
    { title: "Components Serve Functions", text: "Every component must exist to fulfill a clearly defined function." },
    { title: "Functions Serve Integration", text: "Individual functions strengthen the integrated operation of AVAIA rather than creating isolated or competing systems." },
    { title: "Simplicity Is Preserved", text: "Growth should increase clarity rather than complexity." },
    { title: "Testing Precedes Revision", text: "Meaningful changes are informed by observation, practical application, and testing — not preference or novelty." },
    { title: "Documentation Accompanies Development", text: "Every approved addition or revision is documented, indexed, and incorporated into the manual." },
    { title: "Resources May Expand", text: "Programs, materials, research, and implementation resources are expected to grow as the institution matures." },
    { title: "Principles Remain Stable", text: "Applications and resources may evolve, but the constitutional identity and governing principles remain the enduring foundation." },
  ],
  commitment:
    "AVAIA exists to preserve an integrated approach to guided interpersonal, virtue-centered understanding that can be faithfully understood, taught, practiced, and sustained across generations.",
};

// ---------------------------------------------------------------------------
// Layer II — Core Conversation Manuals
// ---------------------------------------------------------------------------

export interface ConversationManual {
  slug: string;
  name: string;
  abbr?: string;
  position: string;
  purpose: string;
  objectives: string[];
  structure?: string[];
  hostDoes?: string;
  exampleQuestion?: string;
  inputs: string[];
  outputs: string[];
  boundaries: string[];
  carriesForward?: string[];
  referralTo?: string;
}

export const CONVERSATIONS: ConversationManual[] = [
  {
    slug: "preparation",
    name: "Preparation GPT",
    position: "Occurs before any core conversation.",
    purpose: "Assists the Guide before a conversation by organizing available information, reviewing prior documentation, and identifying themes and areas to explore — without determining direction or outcome.",
    objectives: ["Organize available information", "Review previous referrals", "Identify emerging themes", "Highlight possible areas for exploration", "Prepare the Guide for thoughtful engagement", "Promote consistency across conversations"],
    structure: ["Review available documentation", "Summarize prior conversations", "Identify recurring themes", "Highlight possible virtues", "Identify possible secondary losses", "Suggest areas for exploration", "Prepare the Guide"],
    hostDoes: "The Host is not present. Preparation is used by the Guide before a session.",
    inputs: ["Prior workbook records", "Previous referrals"],
    outputs: ["Preparation summary", "Conversation overview", "Significant themes", "Questions for exploration"],
    boundaries: ["Does not replace the Guide", "Does not conduct conversations", "Does not make conclusions", "Does not predict outcomes"],
    referralTo: "iap",
  },
  {
    slug: "iap",
    name: "Individual Awareness Profile",
    abbr: "IAP",
    position: "Preparation GPT → IAP → CAT",
    purpose: "The first core conversation. Establishes awareness by helping the Host describe their current experience, identify disruption, and recognize emerging patterns — without solving or interpreting prematurely.",
    objectives: ["Establish rapport and psychological safety", "Listen without premature interpretation", "Identify presenting concerns", "Recognize areas of fragmentation", "Observe emerging themes and patterns", "Identify possible secondary losses", "Recognize existing strengths and virtues"],
    structure: ["Establish connection", "Explore the presenting concern", "Increase awareness of significant experiences", "Observe patterns and relationships", "Identify areas requiring further understanding", "Summarize what has become visible", "Prepare a referral to CAT"],
    hostDoes: "The Host describes what is happening and what brought them to AVAIA.",
    exampleQuestion: "What feels most present or unresolved right now?",
    inputs: ["Host conversation", "Guide observations"],
    outputs: ["Summary of presenting concerns", "Major themes", "Areas of fragmentation", "Emerging virtues", "Possible secondary losses", "Referral to CAT"],
    boundaries: ["No diagnosis", "No prescribing", "No solving problems", "No deciding for the Host", "No forced emotional processing"],
    carriesForward: ["Presenting concern", "Major themes", "Areas of fragmentation", "Possible secondary losses", "Significant relationships", "Questions needing deeper understanding"],
    referralTo: "cat",
  },
  {
    slug: "cat",
    name: "Conversations Across Time",
    abbr: "CAT",
    position: "IAP → CAT → InnerCompass",
    purpose: "Deepens understanding by exploring relationships, perspectives, meanings, and internal voices across time. Its purpose is understanding — not decision-making. The conversation is held as a round table.",
    objectives: ["Increase visibility", "Explore relationships", "Examine meaning", "Understand tensions", "Identify competing perspectives", "Clarify patterns across time", "Prepare for intentional decision-making"],
    structure: ["Review the referral", "Explore relationships", "Expand perspectives", "Examine meanings", "Increase visibility", "Recognize patterns", "Summarize understanding", "Prepare referral to InnerCompass"],
    hostDoes: "The Host explores relationships, perspectives, meaning, history, and tensions.",
    exampleQuestion: "What has become more visible as you look at this across time?",
    inputs: ["IAP referral", "Guided conversation"],
    outputs: ["Increased understanding", "Clarified relationships", "Identified tensions", "Emerging possibilities", "Referral to InnerCompass"],
    boundaries: ["No directing decisions", "Does not tell the Host what to do", "No rushing toward solutions", "No outcome control"],
    carriesForward: ["What became visible", "Core tensions", "Meaning discovered", "Relationship insights", "Possible options", "Discernment needs"],
    referralTo: "innercompass",
  },
  {
    slug: "innercompass",
    name: "InnerCompass",
    position: "CAT → InnerCompass → Workbook",
    purpose: "Transforms understanding into thoughtful decisions and meaningful action, helping the Host discern choices that align with their understanding, relationships, virtues, and responsibilities.",
    objectives: ["Support discernment", "Clarify options", "Examine integrity", "Evaluate consequences", "Encourage responsibility", "Strengthen agency", "Develop intentional participation"],
    structure: ["Review the referral", "Clarify the present decision", "Explore available possibilities", "Evaluate alignment with virtues and responsibilities", "Identify obstacles", "Discern intentional action", "Establish participation", "Document decisions"],
    hostDoes: "The Host considers options, obstacles, virtues, integrity, and next steps.",
    exampleQuestion: "What decision or action would allow you to participate with integrity?",
    inputs: ["CAT referral", "Guided conversation"],
    outputs: ["Clearly articulated decisions", "Supporting rationale", "Identified virtues", "Anticipated obstacles", "Action commitments", "Workbook documentation"],
    boundaries: ["Host owns all decisions", "No guarantees of outcomes", "Does not eliminate uncertainty", "Does not replace personal responsibility"],
    carriesForward: ["Decisions", "Rationale", "Virtues involved", "Obstacles", "Participation plan", "Follow-up needs"],
    referralTo: "workbook",
  },
];

export const JOURNEY_FLOW = [
  { key: "preparation", label: "Preparation GPT", kind: "conversation" as const },
  { key: "iap", label: "Individual Awareness Profile", kind: "conversation" as const },
  { key: "cat", label: "Conversations Across Time", kind: "conversation" as const },
  { key: "innercompass", label: "InnerCompass", kind: "conversation" as const },
  { key: "workbook", label: "Workbook", kind: "record" as const },
  { key: "continued", label: "Continued Participation", kind: "outcome" as const },
];

// ---------------------------------------------------------------------------
// Layer II — Operating Systems
// ---------------------------------------------------------------------------

export interface OperatingSystem {
  slug: string;
  name: string;
  abbr: string;
  purpose: string;
  responsibilities: string[];
  boundaries: string[];
}
export const OPERATING_SYSTEMS: OperatingSystem[] = [
  { slug: "guide", name: "Guide Operating System", abbr: "GOS", purpose: "Establishes the posture, responsibilities, and operational standards of every AVAIA Guide. The Guide is not the source of answers, but the steward of the conversation.", responsibilities: ["Protect the integrity of the conversation", "Maintain a posture of curiosity", "Increase visibility without directing conclusions", "Support understanding before action", "Preserve the Host's ownership of decisions", "Implement the GIVE Method"], boundaries: ["No diagnosis", "No prescribing", "No outcome control", "No replacing Host autonomy"] },
  { slug: "witness", name: "Witness Operating System", abbr: "WOS", purpose: "Ensures that what becomes visible is acknowledged, preserved, and integrated without judgment or control. The Witness remembers without controlling.", responsibilities: ["Observe faithfully", "Preserve continuity", "Record meaningful developments", "Recognize progress", "Support integration over time"], boundaries: ["Does not direct", "Does not evaluate worth", "Does not make decisions"] },
  { slug: "council", name: "Council Operating System", abbr: "COS", purpose: "Provides structured opportunities to consider additional perspectives that strengthen understanding, wisdom, and discernment. The Council exists to broaden awareness, not determine conclusions.", responsibilities: ["Offer perspective", "Expand understanding", "Encourage thoughtful reflection", "Reveal possibilities", "Challenge assumptions respectfully"], boundaries: ["Advisory only", "Does not govern", "Does not override the Host"] },
];

// ---------------------------------------------------------------------------
// Layer II — Core Engines
// ---------------------------------------------------------------------------

export interface Engine {
  slug: string;
  name: string;
  abbr?: string;
  trademark?: boolean;
  purpose: string;
  responsibilities: string[];
  boundaries?: string[];
  awaiting?: Pending;
}
export const ENGINES: Engine[] = [
  { slug: "table-formation", name: "Table Formation Engine", abbr: "TFE", purpose: "Provides the structural framework for AVAIA conversations — establishing the table, activating only the seats that serve understanding, and preventing any voice from taking control.", responsibilities: ["Organize the conversation", "Balance perspectives", "Increase visibility", "Support understanding"], boundaries: ["Does not determine conclusions", "Does not direct decisions", "Does not operate independently of the Guide"] },
  { slug: "chemistry-of-virtue", name: "Chemistry of Virtue", trademark: true, purpose: "A systematic framework for how virtues function individually and together to strengthen character, relationships, discernment, and intentional participation. Recognizes strengths before deficiencies and balance rather than perfection.", responsibilities: ["Organize virtue relationships", "Support virtue combinations and formulas", "Integrate with conversations", "Support report generation"], boundaries: ["Do not invent virtue definitions", "Do not assign moral worth or label individuals"] },
  { slug: "secondary-loss", name: "Secondary Loss Engine", abbr: "SLE", purpose: "Identifies and organizes the often-unrecognized secondary losses that accompany significant disruption. Bringing them into view increases understanding and supports restoration.", responsibilities: ["Identify secondary losses", "Support awareness", "Integrate with IAP, CAT, and InnerCompass", "Support reporting"], boundaries: ["No diagnosis", "No assumptions", "Does not assign blame"] },
  { slug: "referral", name: "Referral Engine", purpose: "Transfers structured information between AVAIA conversations so the Host never has to start over. Each referral preserves what became visible and what belongs in the next conversation.", responsibilities: ["Preserve continuity", "Transfer relevant information", "Prevent duplication", "Support report generation"], boundaries: ["Referrals support conversations", "Referrals do not replace conversations"] },
  { slug: "report", name: "Report Engine", purpose: "Generates purpose-specific reports from a single AVAIA conversation. One conversation, multiple report types; the conversation stays unchanged and only the report output changes.", responsibilities: ["Produce role-specific reports", "Share only what the stated purpose requires", "Honor consent and confidentiality"] },
];

// ---------------------------------------------------------------------------
// Secondary Losses — with their healing virtue family (Manual)
// ---------------------------------------------------------------------------

export interface SecondaryLoss {
  loss: string;
  healingFamily: VirtueFamilyKey;
  healingLabel: string;
}
export const SECONDARY_LOSSES: SecondaryLoss[] = [
  { loss: "Meaning", healingFamily: "gratitude", healingLabel: "Gratitude" },
  { loss: "Reality", healingFamily: "humility", healingLabel: "Humility" },
  { loss: "Dreams / Opportunities", healingFamily: "positive-attitude", healingLabel: "Positive Attitude" },
  { loss: "Self-Trust", healingFamily: "hard-work", healingLabel: "Hard Work" },
  { loss: "Decision-Making / Boundaries", healingFamily: "fortitude", healingLabel: "Fortitude" },
  { loss: "Life Vision", healingFamily: "wisdom", healingLabel: "Wisdom" },
  { loss: "Connection", healingFamily: "justice", healingLabel: "Justice" },
  { loss: "Control", healingFamily: "self-control", healingLabel: "Self-Control" },
  { loss: "Identity", healingFamily: "integrity", healingLabel: "Integrity" },
  { loss: "Attachment / Support", healingFamily: "love", healingLabel: "Love" },
];

// Authoritative-source helpers, same treatment as formatVirtueHierarchy /
// isValidVirtueFamily in lib/virtues.ts -- IAP and CAT referral generation
// previously invented free-prose secondary-loss labels ("loss of home,"
// "loss of professional meaning") instead of using these ten official
// categories, the same root cause the Chemistry of Virtue fix addressed
// for virtue classification. See SECONDARY_LOSS_DISCIPLINE in
// lib/engine/prompts.ts and its use in lib/engine/referral-generation.ts.

/** Plain-text "Loss (restoration: Family)" rendering of the complete
 *  Secondary Loss taxonomy, generated directly from SECONDARY_LOSSES --
 *  never hand-copied, so it can't drift from the canonical list. */
export function formatSecondaryLossHierarchy(): string {
  return SECONDARY_LOSSES.map((s) => `${s.loss} (restoration: ${s.healingLabel})`).join("\n");
}

/** True only if category exactly matches one of the ten official Secondary
 *  Loss names (e.g. "Dreams / Opportunities"), case-insensitive. */
export function isValidSecondaryLoss(category: string): boolean {
  return SECONDARY_LOSSES.some((s) => s.loss.toLowerCase() === category.trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// Reports & consent (Dorian Q25, Q26)
// ---------------------------------------------------------------------------

export interface ReportType {
  name: string;
  recipient: string;
  contains: string;
}
export const REPORTS: ReportType[] = [
  { name: "Guide Report", recipient: "Guide", contains: "Themes, context, referral information, and conversation preparation." },
  { name: "Counselor Report", recipient: "Counselor or approved support professional", contains: "High-level context, strengths, stressors, and areas for exploration." },
  { name: "Student Success Report", recipient: "Student and approved advisor / counselor", contains: "Learning patterns, transition needs, support needs, and strengths." },
  { name: "Leadership Report", recipient: "Participant and approved leadership facilitator", contains: "Communication patterns, strengths, growth areas, and participation themes." },
  { name: "Organizational Report", recipient: "Organization admin", contains: "Aggregated, non-private, non-identifying insights — unless explicit consent is given." },
];

export const CONSENT_COVERS = [
  "What is recorded",
  "Who can see it",
  "What reports may be generated",
  "What information is private",
  "What can be shared",
  "How consent can be managed",
];

// ---------------------------------------------------------------------------
// The Workbook
// ---------------------------------------------------------------------------

export const WORKBOOK_CONTENTS = [
  "Conversation summaries",
  "Referral documentation",
  "Guide observations",
  "Host reflections",
  "Virtue development",
  "Secondary Loss observations",
  "Decision records",
  "Participation plans",
  "Progress documentation",
];

// ---------------------------------------------------------------------------
// Layer III — Programs
// ---------------------------------------------------------------------------

export interface Program {
  name: string;
  blurb: string;
  status: "flagship" | "active" | "planned";
}
export const PROGRAMS: Program[] = [
  { name: "Defying Grief", blurb: "AVAIA's flagship grief education and restoration program — understanding grief, recognizing primary and secondary losses, cultivating virtue, and participating intentionally in life while honoring what was lost.", status: "flagship" },
  { name: "Certification Program", blurb: "Trains and certifies AVAIA Guides in the Constitution, GIVE Method, conversations, operating systems, engines, boundaries, and documentation standards.", status: "active" },
  { name: "Workshops & Speaking", blurb: "Educational outreach introducing AVAIA's principles and method — invitations to understanding rather than promotional events.", status: "active" },
  { name: "Future Programs", blurb: "Governed to remain constitutionally aligned while expanding AVAIA's ability to serve individuals, relationships, organizations, and communities.", status: "planned" },
];

// ---------------------------------------------------------------------------
// Organization Configuration (doc 17)
// ---------------------------------------------------------------------------

export const CONFIGURABLE_ITEMS = ["Branding", "Report Types", "User Roles", "Permissions", "Programs", "Resource Access"];
export const FIXED_COMPONENTS = ["Constitution", "GIVE Method", "Core Conversations", "Operating Systems", "Core Engines"];
export const CONFIGURATION_EXAMPLES = ["Universities", "Counseling Practices", "Grief Organizations", "Businesses", "Faith Communities"];

export interface UserRole {
  name: string;
  can: string;
}
export const USER_ROLES: UserRole[] = [
  { name: "Host", can: "Participate in conversations, view their own Workbook, and manage consent." },
  { name: "Guide", can: "Conduct sessions, view assigned Host materials, create referrals, and generate approved reports." },
  { name: "Organization Admin", can: "Manage users, programs, branding, permissions, and aggregate reporting." },
  { name: "AVAIA Admin", can: "Manage institutional content, system-wide settings, approved programs, and platform structure." },
  { name: "Certified Guide / Instructor", can: "Access certification materials and approved teaching resources." },
];

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function conversation(slug: string): ConversationManual | undefined {
  return CONVERSATIONS.find((c) => c.slug === slug);
}
