import type { VirtueFamilyKey } from "@/lib/virtues";

// AVAIA Chemistry Stories -- the story architecture for Chemistry for
// Families & Kids. Every story is built around one canonical Chemistry
// element (name must match lib/virtues.ts exactly -- verified against it
// directly, nothing invented there). All character names, situations,
// and plots are original AVAIA material -- no outside children's books,
// characters, franchises, or curricula were used or adapted.
//
// Governing rule, same as everywhere else Chemistry appears: a child is
// never told they "have" or "don't have" an element, and a story never
// teaches that a specific problem automatically requires a specific
// element. Every story simply shows the element becoming visible through
// what a character does -- the closing prompts turn it back toward the
// child's own recognition, not a lesson to memorize.
//
// This is a PILOT set (six stories, six different Virtue Families) built
// to prove the architecture and give Dorian something real to react to
// -- not all 123 elements. Adding a new element's story later means
// adding one more object to STORY_LIBRARY below in the same shape;
// nothing about the page or the reading levels needs to change.
//
// Two reading levels per story:
// - "beginning" -- very young / beginning-reader: short sentences, one
//   idea per line, concrete and immediate.
// - "growing" -- an older child: fuller sentences, a little more
//   interiority, still plain language.
// Neither level is gated by Youth guardian-consent architecture -- these
// are free reading pages, the same as a Library entry; consent only
// applies where an actual private AVAIA conversation opens (see
// app/chemistry/family/page.tsx's own comment on where that boundary
// is), which nothing on the reading page itself requires.

export type ReadingLevel = "beginning" | "growing";

export type StoryboardScene = {
  scene: number;
  visual: string;
  narration: string;
  onScreenText?: string;
};

export type ChemistryStory = {
  slug: string;
  elementName: string; // must match a Virtue.name in lib/virtues.ts
  familyKey: VirtueFamilyKey;
  title: string;
  beginning: string[]; // short paragraphs, beginning-reader level
  growing: string[]; // fuller paragraphs, older-child level
  recognitionPrompts: string[]; // the four standard prompts, filled in
  noticeThisWeek: string;
  storyboard: StoryboardScene[];
};

function standardPrompts(elementName: string): string[] {
  return [
    "What did you notice?",
    `Where did you see ${elementName.toLowerCase()}?`,
    "Have you ever seen someone do something like that?",
    `What might ${elementName.toLowerCase()} look like for you?`,
  ];
}

export const STORY_LIBRARY: ChemistryStory[] = [
  {
    slug: "kindness-the-extra-seat",
    elementName: "Kindness",
    familyKey: "love",
    title: "The Extra Seat",
    beginning: [
      "Mara sat down to eat lunch. She had a whole table to herself.",
      "Then she saw Theo standing by the door. He didn't have anyone to sit with.",
      "Mara looked at her table. It had lots of room.",
      "“Come sit here,” Mara said, and she scooted her tray over to make an extra seat.",
      "Theo smiled and sat down. Now the table wasn't empty anymore.",
    ],
    growing: [
      "Mara found a table by the window and set her tray down. The cafeteria was loud, but her spot was quiet, and she had the whole table to herself.",
      "Across the room, she noticed Theo standing near the door, holding his tray, looking for somewhere to sit. Nobody waved him over. He started walking toward an empty corner instead.",
      "Mara looked at her own table. There were five empty chairs and only her in one of them.",
      "She didn't think about it for very long. “Hey, there's room over here,” she called out, and slid her tray down to make space.",
      "Theo looked surprised, then walked over and sat down. They didn't talk about much — just school, and a show they both liked — but the table wasn't empty anymore, and neither of them was sitting alone.",
    ],
    recognitionPrompts: standardPrompts("Kindness"),
    noticeThisWeek:
      "This week, notice one moment when you could make room for someone — at a table, in a game, in a conversation.",
    storyboard: [
      { scene: 1, visual: "A cafeteria. Mara alone at a long table with empty seats.", narration: "Mara had the whole table to herself." },
      { scene: 2, visual: "Theo standing near the door holding a tray, looking around.", narration: "Across the room, Theo didn't have anywhere to sit." },
      { scene: 3, visual: "Close-up on the empty chairs at Mara's table.", narration: "Mara looked at all the room she had." },
      { scene: 4, visual: "Mara waving, sliding her tray over.", narration: "“Come sit here,” she said." },
      { scene: 5, visual: "Theo sitting down, both kids smiling.", narration: "Now the table wasn't empty anymore.", onScreenText: "Where have you seen kindness this week?" },
    ],
  },
  {
    slug: "courage-the-high-dive",
    elementName: "Courage",
    familyKey: "fortitude",
    title: "The High Dive",
    beginning: [
      "Jonah stood at the edge of the high dive. It looked very tall from up there.",
      "His legs felt shaky. His stomach felt funny.",
      "He was scared. But he wanted to jump anyway.",
      "Jonah counted to three, and jumped.",
      "The water was cold and loud, but Jonah popped back up, smiling. He had done it — even though he was scared.",
    ],
    growing: [
      "Jonah had climbed the ladder to the high dive three times already, and three times he'd climbed back down without jumping. This time, he made himself stay at the top.",
      "From up here, the water looked very far away. His hands were sweaty on the rail. Somewhere below, he could hear his friends yelling for him to jump, but their voices sounded far away too.",
      "Being scared didn't go away just because he wanted it to. His heart was pounding and his legs felt like they might not hold him.",
      "He thought about climbing back down again. Instead, he took a breath, counted to three out loud, and jumped before he could talk himself out of it.",
      "The water rushed up fast and loud, and for a second everything was cold and quiet. Then he broke the surface, gasping, and heard his friends cheering. He hadn't stopped being scared. He'd jumped anyway.",
    ],
    recognitionPrompts: standardPrompts("Courage"),
    noticeThisWeek:
      "This week, notice one thing that feels a little scary, and notice what it's like to do it anyway, even in a small way.",
    storyboard: [
      { scene: 1, visual: "A tall diving platform, Jonah at the top, looking down.", narration: "Jonah stood at the edge of the high dive." },
      { scene: 2, visual: "Close-up on Jonah's shaky hands on the rail.", narration: "His legs felt shaky. His stomach felt funny." },
      { scene: 3, visual: "Jonah closing his eyes, taking a breath.", narration: "He was scared. But he wanted to jump anyway." },
      { scene: 4, visual: "Jonah jumping, mid-air.", narration: "Jonah counted to three, and jumped." },
      { scene: 5, visual: "Jonah surfacing in the water, smiling, friends cheering.", narration: "He had done it — even though he was scared.", onScreenText: "Where have you seen courage this week?" },
    ],
  },
  {
    slug: "honesty-the-broken-vase",
    elementName: "Honesty",
    familyKey: "justice",
    title: "The Broken Vase",
    beginning: [
      "Priya was playing ball inside, even though she wasn't supposed to.",
      "The ball hit a vase. The vase broke into pieces.",
      "Priya could have hidden the pieces. No one saw what happened.",
      "Instead, Priya found her dad and said, “I broke the vase. It was my fault.”",
      "Her dad was not happy about the vase. But he was proud that Priya told the truth.",
    ],
    growing: [
      "Priya knew she wasn't supposed to play ball in the living room, but everyone else was outside and she was bored, so she bounced it against the wall anyway.",
      "On the fifth bounce, the ball caught the edge of the shelf and knocked the blue vase to the floor, where it shattered into more pieces than she could count.",
      "For a second, she just stood there. No one had seen. She could sweep it up, say she didn't know what happened, and probably no one would ever find out it was her.",
      "Instead, she went and found her dad in the kitchen. “I broke the vase,” she said, before she could change her mind. “I was playing ball inside and I shouldn't have been.”",
      "Her dad sighed — it had been her grandmother's vase — but he looked at her for a second and said, “Thank you for telling me the truth. That mattered more to me than the vase did.”",
    ],
    recognitionPrompts: standardPrompts("Honesty"),
    noticeThisWeek:
      "This week, notice a moment when telling the truth is harder than staying quiet — and notice what that's like.",
    storyboard: [
      { scene: 1, visual: "A living room, a ball bouncing near a shelf.", narration: "Priya was playing ball inside, even though she wasn't supposed to." },
      { scene: 2, visual: "A vase falling and shattering on the floor.", narration: "The ball hit a vase. The vase broke into pieces." },
      { scene: 3, visual: "Priya standing alone, looking at the broken pieces, no one else in the room.", narration: "No one saw what happened." },
      { scene: 4, visual: "Priya walking into the kitchen where her dad is.", narration: "“I broke the vase,” she said. “It was my fault.”" },
      { scene: 5, visual: "Dad kneeling down, a hand on her shoulder.", narration: "He was proud that Priya told the truth.", onScreenText: "Where have you seen honesty this week?" },
    ],
  },
  {
    slug: "patience-the-slow-seed",
    elementName: "Patience",
    familyKey: "self-control",
    title: "The Slow Seed",
    beginning: [
      "Oliver planted a seed in a little pot.",
      "The next day, he looked. Nothing had grown yet.",
      "The next day, and the next, still nothing.",
      "Oliver wanted to dig it up and look. But he waited instead, and just gave it water.",
      "One morning, a tiny green sprout popped out of the dirt. Oliver had waited long enough to see it.",
    ],
    growing: [
      "Oliver planted a bean seed in a paper cup and set it on the windowsill, exactly the way his teacher had shown the class.",
      "The next morning he checked it before breakfast. Nothing. He checked again after school. Still nothing — just dirt in a cup.",
      "By the third day with no sprout, he was sure he'd done something wrong. He almost dug it up just to see what was happening underneath.",
      "Instead he watered it like he was supposed to and left it alone, even though waiting felt like the hardest part of the whole thing.",
      "On the sixth morning, there it was — a small curled green sprout pushing up through the dirt. It had been growing the whole time, even on the days he couldn't see anything happening at all.",
    ],
    recognitionPrompts: standardPrompts("Patience"),
    noticeThisWeek:
      "This week, notice one thing you're waiting for, and notice what it feels like to wait without rushing it.",
    storyboard: [
      { scene: 1, visual: "A small pot on a windowsill, a child patting dirt over a seed.", narration: "Oliver planted a seed in a little pot." },
      { scene: 2, visual: "Close-up of the pot, days passing (a small calendar or sun/moon cycle), no sprout.", narration: "Day after day, nothing had grown yet." },
      { scene: 3, visual: "Oliver reaching toward the pot as if to dig, then stopping and picking up a watering can instead.", narration: "He wanted to dig it up and look. But he waited instead, and just gave it water." },
      { scene: 4, visual: "Time-lapse style shot of the pot across several mornings.", narration: "He waited, and watered, and waited some more." },
      { scene: 5, visual: "A tiny green sprout poking through the dirt, Oliver's delighted face.", narration: "One morning, a tiny green sprout popped out of the dirt.", onScreenText: "Where have you seen patience this week?" },
    ],
  },
  {
    slug: "perseverance-the-third-try",
    elementName: "Perseverance",
    familyKey: "hard-work",
    title: "The Third Try",
    beginning: [
      "Lily tried to tie her shoelaces. The bow came apart.",
      "She tried again. It came apart again.",
      "Lily felt like giving up and asking for help.",
      "She tried one more time, slower this time, and pulled the loops tight.",
      "The bow held! Lily had kept trying until it worked.",
    ],
    growing: [
      "Lily had watched her big brother tie his shoes a hundred times, and it always looked easy when he did it. Hers came apart the second she let go.",
      "She tried again, looping and pulling the way she'd seen him do it. The bow held for about two seconds before it slipped loose again.",
      "Her brother was already at the door, waiting. Part of her wanted to just ask him to do it for her, the way he usually did.",
      "Instead she sat back down, went slower this time, and paid attention to exactly where her fingers went on each loop before she pulled them tight.",
      "The third try held. It wasn't a perfect bow, but it stayed tied all the way to school — because she'd kept trying instead of stopping at the second one.",
    ],
    recognitionPrompts: standardPrompts("Perseverance"),
    noticeThisWeek:
      "This week, notice something that took more than one try, and notice what it felt like to keep going.",
    storyboard: [
      { scene: 1, visual: "A child sitting on the floor, shoelaces coming undone.", narration: "Lily tried to tie her shoelaces. The bow came apart." },
      { scene: 2, visual: "Second attempt, bow slipping loose again, a frustrated look.", narration: "She tried again. It came apart again." },
      { scene: 3, visual: "A brother waiting by the door, tapping his foot.", narration: "Part of her wanted to just ask for help." },
      { scene: 4, visual: "Lily slowing down, watching her own hands carefully.", narration: "She tried one more time, slower this time." },
      { scene: 5, visual: "A tied bow, Lily smiling, standing up.", narration: "The bow held. She had kept trying until it worked.", onScreenText: "Where have you seen perseverance this week?" },
    ],
  },
  {
    slug: "appreciation-the-thank-you-note",
    elementName: "Appreciation",
    familyKey: "gratitude",
    title: "The Thank-You Note",
    beginning: [
      "Every day, the school bus driver waved and said good morning.",
      "Sam never said much back — just got on the bus and found a seat.",
      "One day, Sam made a card. It said, “Thank you for driving us to school.”",
      "Sam handed it to the driver before getting off the bus.",
      "The driver's whole face lit up. “Nobody's ever done that before,” she said, smiling all the way to the next stop.",
    ],
    growing: [
      "Every single school day, the bus driver, Ms. Alvarez, said good morning to every kid who climbed the steps, rain or shine, even on the days nobody said it back.",
      "Sam always just nodded and found a seat near the back. It hadn't really occurred to him that her good morning was something she chose to do, every day, whether or not anyone noticed.",
      "One night, doing homework at the kitchen table, he found a spare piece of paper and, almost without deciding to, wrote: “Thank you for driving us to school every day. I don't think I ever said that.”",
      "The next morning he felt a little embarrassed handing it over, like it was a strange thing to do. He gave it to her anyway, right before he found his seat.",
      "He didn't see her read it until they reached his stop — but her whole face had changed, softer, surprised. “Nobody's ever done that before,” she said. “Thank you.” She was still smiling when the doors closed.",
    ],
    recognitionPrompts: standardPrompts("Appreciation"),
    noticeThisWeek:
      "This week, notice one person who does something for you regularly that you don't usually say thank you for.",
    storyboard: [
      { scene: 1, visual: "A school bus, driver waving good morning to kids boarding.", narration: "Every day, the bus driver waved and said good morning." },
      { scene: 2, visual: "Sam at a kitchen table, writing on a piece of paper.", narration: "One night, Sam made a card." },
      { scene: 3, visual: "Sam handing the card to the driver as he steps onto the bus.", narration: "Thank you for driving us to school, it said." },
      { scene: 4, visual: "The driver reading the card at a stoplight, smiling.", narration: "Nobody's ever done that before, she said.", onScreenText: "Where have you seen appreciation this week?" },
    ],
  },
];

export function getChemistryStory(slug: string): ChemistryStory | undefined {
  return STORY_LIBRARY.find((s) => s.slug === slug);
}
