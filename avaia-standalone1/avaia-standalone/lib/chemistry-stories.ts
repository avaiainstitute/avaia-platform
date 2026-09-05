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
// Coverage status (kept current, checked against COUNT below -- see
// getChemistryStory's own file for the exact live count): this is a
// substantial expansion past the original six-story pilot, not yet all
// 123 canonical elements. Two families (Gratitude, Humility) are fully
// covered; every other family has multiple stories, not just one.
// Adding a new element's story later means adding one more object to
// STORY_LIBRARY below in the same shape; nothing about the page or the
// reading levels needs to change.
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

// ===========================================================================
// WISDOM
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "balance-the-two-jobs",
    elementName: "Balance",
    familyKey: "wisdom",
    title: "The Two Jobs",
    beginning: [
      "Mateo had homework to do. Mateo also wanted to play with his dog.",
      "He did a little homework. Then he played with his dog for a little while.",
      "Then he did more homework. Then he played some more.",
      "By dinner, the homework was done, and the dog was happy too.",
    ],
    growing: [
      "Mateo had a whole worksheet of math left, and his dog Biscuit kept dropping a ball at his feet, tail going.",
      "He could have ignored Biscuit until the worksheet was finished. He could have ignored the worksheet and played all afternoon instead.",
      "Instead he did five problems, then threw the ball for a few minutes, then came back to five more problems.",
      "It took longer than doing it all in one sitting might have. But by dinner, the worksheet was done and Biscuit was worn out and happy, and Mateo didn't feel like he'd had to give up either one.",
    ],
    recognitionPrompts: standardPrompts("Balance"),
    noticeThisWeek: "This week, notice one moment when you're pulled between two things you care about, and try giving a little time to each.",
    storyboard: [
      { scene: 1, visual: "A kitchen table with a math worksheet; a dog with a ball nearby.", narration: "Mateo had homework to do. Mateo also wanted to play with his dog." },
      { scene: 2, visual: "Mateo doing a few problems, then tossing the ball, back and forth.", narration: "He did a little of each, back and forth." },
      { scene: 3, visual: "Dinner table, finished worksheet, tired happy dog.", narration: "By dinner, the homework was done, and the dog was happy too.", onScreenText: "Where have you seen balance this week?" },
    ],
  },
  {
    slug: "capacity-the-full-cup",
    elementName: "Capacity",
    familyKey: "wisdom",
    title: "The Full Cup",
    beginning: [
      "Grandma asked Noor to help carry groceries.",
      "Noor said, 'I can only carry two bags right now. I'm already carrying my backpack.'",
      "Grandma said that was okay, and carried the rest herself.",
      "Noor helped with exactly as much as she really could.",
    ],
    growing: [
      "Grandma had six bags of groceries and asked Noor to help bring them in from the car.",
      "Noor wanted to say yes to everything, the way she usually did, but her arms were already full with her backpack and a school project she didn't want to drop.",
      "'I can carry two bags safely right now,' she said. 'I don't want to drop the project.'",
      "Grandma nodded and made two trips herself for the rest. Noor had been honest about what she actually had room for, instead of promising more and dropping something.",
    ],
    recognitionPrompts: standardPrompts("Capacity"),
    noticeThisWeek: "This week, notice one time you're honest about how much you can actually take on right now.",
    storyboard: [
      { scene: 1, visual: "A car trunk full of grocery bags.", narration: "Grandma asked Noor to help carry groceries." },
      { scene: 2, visual: "Noor holding a backpack and a project, looking at the bags.", narration: "'I can only carry two bags right now,' she said." },
      { scene: 3, visual: "Noor carrying two bags carefully inside; grandma making a second trip.", narration: "Noor helped with exactly as much as she really could.", onScreenText: "Where have you seen capacity this week?" },
    ],
  },
  {
    slug: "creativity-the-broken-crayon",
    elementName: "Creativity",
    familyKey: "wisdom",
    title: "The Broken Crayon",
    beginning: [
      "Ellie's favorite blue crayon broke in half.",
      "She was sad for a second. Then she had an idea.",
      "Now she had two blue crayons instead of one.",
      "She gave the extra half to her friend so they could both draw the sky.",
    ],
    growing: [
      "Ellie's favorite blue crayon, the good one, the one that colored smooth, snapped clean in half in her pencil box.",
      "For a second she just stared at it, annoyed — that was supposed to last the whole year.",
      "Then she realized: two shorter crayons still both worked exactly like one long one did.",
      "She kept one half and handed the other to her friend Diego, whose own blue crayon had worn down to a nub. Now they could both color the sky at the same time.",
    ],
    recognitionPrompts: standardPrompts("Creativity"),
    noticeThisWeek: "This week, notice one small problem, and try finding a way through it that nobody suggested to you first.",
    storyboard: [
      { scene: 1, visual: "A blue crayon snapping in a pencil box.", narration: "Ellie's favorite blue crayon broke in half." },
      { scene: 2, visual: "Ellie looking at the two pieces, a lightbulb moment.", narration: "She was sad for a second. Then she had an idea." },
      { scene: 3, visual: "Ellie and a friend coloring together, each with half a crayon.", narration: "Now they could both draw the sky.", onScreenText: "Where have you seen creativity this week?" },
    ],
  },
  {
    slug: "discernment-which-friend-is-right",
    elementName: "Discernment",
    familyKey: "wisdom",
    title: "Two Kinds of Advice",
    beginning: [
      "Sam wasn't sure if a joke he wanted to tell would hurt someone's feelings.",
      "One friend said 'just say it, it's funny.' Another friend said 'maybe think about it first.'",
      "Sam thought about it for a minute on his own.",
      "He decided to save the joke for later, for a different moment.",
    ],
    growing: [
      "Sam had a joke that was genuinely funny, but it was about something that had happened to his classmate Priya, and he wasn't sure if she'd laugh or feel embarrassed.",
      "One friend told him to just say it — it was funny, that's all that mattered. Another friend told him to think it over first.",
      "Instead of just going with whoever spoke last, Sam actually thought about Priya specifically, not about the joke in general.",
      "He decided to hold onto the joke for a different moment, or a different audience — not because someone told him to, but because he'd actually looked closely enough to decide for himself.",
    ],
    recognitionPrompts: standardPrompts("Discernment"),
    noticeThisWeek: "This week, notice one moment where you look closely at a situation instead of just going with the first opinion you hear.",
    storyboard: [
      { scene: 1, visual: "Sam standing between two friends giving opposite advice.", narration: "One friend said 'just say it.' Another said 'think about it first.'" },
      { scene: 2, visual: "Sam sitting alone, thinking, picturing his classmate's face.", narration: "Sam thought about it for a minute on his own." },
      { scene: 3, visual: "Sam deciding to hold the joke, walking away thoughtfully.", narration: "He decided to save it for a different moment.", onScreenText: "Where have you seen discernment this week?" },
    ],
  },
  {
    slug: "imagination-the-cardboard-castle",
    elementName: "Imagination",
    familyKey: "wisdom",
    title: "The Cardboard Castle",
    beginning: [
      "Theo had one big empty box from a new refrigerator.",
      "To some people it was just trash. To Theo it was a castle.",
      "He cut windows and a door and painted stones on the sides.",
      "For the rest of summer, it was the best castle on the block.",
    ],
    growing: [
      "The refrigerator box sat in the driveway for a whole day before anyone came to take it away, and Theo kept staring at it.",
      "His mom called it garbage. Theo saw a castle wall, if you looked at it a certain way.",
      "He spent the whole afternoon cutting windows, cutting a door that actually opened, and painting gray stones down the sides with leftover paint.",
      "By evening it wasn't a box anymore to anyone who walked by — it was the castle, and every kid on the block wanted a turn being king of it.",
    ],
    recognitionPrompts: standardPrompts("Imagination"),
    noticeThisWeek: "This week, notice one ordinary object, and try seeing it as something else entirely.",
    storyboard: [
      { scene: 1, visual: "A large plain cardboard box in a driveway.", narration: "Theo had one big empty box." },
      { scene: 2, visual: "Theo cutting windows and a door, painting stone shapes.", narration: "To Theo it was a castle." },
      { scene: 3, visual: "Kids lining up to play in the finished box-castle.", narration: "It was the best castle on the block.", onScreenText: "Where have you seen imagination this week?" },
    ],
  },
  {
    slug: "judgment-the-shortcut",
    elementName: "Judgment",
    familyKey: "wisdom",
    title: "The Shortcut",
    beginning: [
      "Ana knew a shortcut through the woods that saved ten minutes.",
      "But it was getting dark, and the shortcut had no lights.",
      "Ana decided to take the longer, lit path instead, just for tonight.",
      "She got home a little later, but she got home safely.",
    ],
    growing: [
      "Ana had walked the shortcut through the trees a hundred times — it cut a good ten minutes off the walk home, and normally she took it without thinking twice.",
      "Tonight the sky was already going gray at the edges, and the shortcut had exactly zero streetlights the whole way through.",
      "She stood at the fork for a second, actually weighing it, instead of going on habit alone.",
      "She chose the longer way, along the lit street, even though it meant getting home ten minutes later than she'd told her mom. Being right on time mattered less than getting there safely.",
    ],
    recognitionPrompts: standardPrompts("Judgment"),
    noticeThisWeek: "This week, notice one small decision where you actually weigh it, instead of doing what's automatic.",
    storyboard: [
      { scene: 1, visual: "A fork in a path — one way through dark trees, one way along a lit street.", narration: "Ana knew a shortcut through the woods." },
      { scene: 2, visual: "Ana pausing, looking at the darkening sky.", narration: "But it was getting dark, and the shortcut had no lights." },
      { scene: 3, visual: "Ana walking the lit street home, arriving safely.", narration: "She got home a little later, but she got home safely.", onScreenText: "Where have you seen judgment this week?" },
    ],
  },
  {
    slug: "knowledge-the-bird-book",
    elementName: "Knowledge",
    familyKey: "wisdom",
    title: "The Bird Book",
    beginning: [
      "Kofi saw a strange red bird in the backyard every morning.",
      "He didn't know its name, so he looked it up in a bird book.",
      "It was called a cardinal.",
      "Now every time he sees it, he knows exactly what he's looking at.",
    ],
    growing: [
      "Every morning for a week, the same bright red bird landed on the fence, and every morning Kofi wondered what it was called.",
      "Instead of just wondering forever, he finally pulled his grandfather's old bird book off the shelf and started flipping through the red ones.",
      "It took a while, but there it was: a Northern Cardinal, with a little paragraph about what it liked to eat and where it nested.",
      "The bird looked exactly the same the next morning. But Kofi didn't just see 'a red bird' anymore — he saw a cardinal, and that changed how much he noticed about it.",
    ],
    recognitionPrompts: standardPrompts("Knowledge"),
    noticeThisWeek: "This week, notice one thing you're curious about, and actually look it up.",
    storyboard: [
      { scene: 1, visual: "A red bird on a fence, a kid watching from a window.", narration: "Kofi saw a strange red bird every morning." },
      { scene: 2, visual: "Kofi flipping through an old bird book at the table.", narration: "He looked it up in a bird book." },
      { scene: 3, visual: "Kofi pointing out the window, naming the bird to a sibling.", narration: "Now he knows exactly what he's looking at.", onScreenText: "Where have you seen knowledge this week?" },
    ],
  },
  {
    slug: "understanding-why-she-was-quiet",
    elementName: "Understanding",
    familyKey: "wisdom",
    title: "Why She Was Quiet",
    beginning: [
      "Ruby's friend Beatriz was quiet all day at school.",
      "Ruby almost thought Beatriz was mad at her.",
      "Instead, Ruby asked, 'Are you okay today?'",
      "Beatriz said her cat was sick, and that's why she felt sad. Ruby understood now — it wasn't about her at all.",
    ],
    growing: [
      "Beatriz barely said a word all through lunch, and Ruby spent the whole period running through what she might have done wrong.",
      "It would have been easy to just assume, get a little hurt, and pull away for the rest of the day.",
      "Instead, on the walk home, Ruby just asked plainly: 'You've been really quiet today — are you okay?'",
      "Beatriz's eyes filled up as she explained her cat had been at the vet since morning. It had nothing to do with Ruby at all — and understanding that changed the whole rest of their walk.",
    ],
    recognitionPrompts: standardPrompts("Understanding"),
    noticeThisWeek: "This week, notice one time you ask instead of assume, when someone seems different than usual.",
    storyboard: [
      { scene: 1, visual: "Two friends at a lunch table, one unusually quiet.", narration: "Ruby's friend was quiet all day at school." },
      { scene: 2, visual: "Ruby looking worried, thinking she'd done something wrong.", narration: "Ruby almost thought her friend was mad at her." },
      { scene: 3, visual: "Ruby asking gently on the walk home; her friend explaining, tearing up.", narration: "Ruby understood now — it wasn't about her at all.", onScreenText: "Where have you seen understanding this week?" },
    ],
  },
  {
    slug: "vision-the-empty-lot",
    elementName: "Vision",
    familyKey: "wisdom",
    title: "The Empty Lot",
    beginning: [
      "There was an empty, weedy lot next to Zara's building.",
      "Everyone else walked past it every day without looking twice.",
      "Zara pictured a garden there instead, with flowers and vegetables.",
      "She told a grown-up about her idea, and one day, the lot really did become a garden.",
    ],
    growing: [
      "The lot next to Zara's building had been empty and overgrown with weeds for as long as she could remember — most people just walked past it without a second glance.",
      "But every time Zara passed it, she pictured something else: rows of vegetables, sunflowers taller than the fence, neighbors stopping to talk.",
      "She drew what she imagined and showed it to the building manager, who forwarded it to the city.",
      "It took almost a whole year of meetings and paperwork she wasn't even part of, but that empty lot really did become a garden — because someone had pictured it as something more, before anyone else could see it.",
    ],
    recognitionPrompts: standardPrompts("Vision"),
    noticeThisWeek: "This week, notice one ordinary place, and picture what it could become.",
    storyboard: [
      { scene: 1, visual: "A weedy empty lot next to an apartment building.", narration: "There was an empty, weedy lot next to Zara's building." },
      { scene: 2, visual: "Zara imagining the lot full of vegetables and flowers (dream-bubble style).", narration: "Zara pictured a garden there instead." },
      { scene: 3, visual: "The same lot, now a real community garden, a year later.", narration: "The lot really did become a garden.", onScreenText: "Where have you seen vision this week?" },
    ],
  },
  {
    slug: "wonder-the-first-snow",
    elementName: "Wonder",
    familyKey: "wisdom",
    title: "The First Snow",
    beginning: [
      "One morning, everything outside was white.",
      "Milo pressed his hand against the cold window glass.",
      "He had seen snow before, but somehow this time felt new.",
      "He just stood there for a long minute, amazed, before getting his coat.",
    ],
    growing: [
      "Milo had seen snow every winter of his life, and by now it wasn't supposed to be a surprise anymore.",
      "But this particular morning, waking up to a whole silent white world outside his window, something in him stopped completely still.",
      "He pressed his palm to the cold glass and just looked — at how quiet everything had gotten, at how the ordinary street outside had turned into something he'd never quite seen the same way before.",
      "He stood there for a full minute before he even thought about his coat, just letting the ordinary thing feel amazing again.",
    ],
    recognitionPrompts: standardPrompts("Wonder"),
    noticeThisWeek: "This week, notice one ordinary thing, and let yourself actually stop and look at it.",
    storyboard: [
      { scene: 1, visual: "A window with fresh snow outside, early morning light.", narration: "One morning, everything outside was white." },
      { scene: 2, visual: "A child's hand pressed to the cold glass, breath fogging it.", narration: "He pressed his hand against the cold window glass." },
      { scene: 3, visual: "The child standing still, awestruck, before finally reaching for a coat.", narration: "He just stood there, amazed, for a long minute.", onScreenText: "Where have you seen wonder this week?" },
    ],
  }
);

// ===========================================================================
// JUSTICE
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "fairness-splitting-the-last-slice",
    elementName: "Fairness",
    familyKey: "justice",
    title: "The Last Slice",
    beginning: [
      "There was one slice of pizza left, and two hungry kids.",
      "Both wanted it. Neither wanted to just take it.",
      "They cut it in half instead, one piece each.",
      "It wasn't a whole slice for either of them, but it felt right to both.",
    ],
    growing: [
      "The pizza box had exactly one slice left, and both Deshawn and his cousin Malik reached for it at the same time.",
      "Deshawn was actually a little hungrier, and could have just grabbed it — he got there half a second first.",
      "Instead he stopped and said, 'Let's split it,' and got the good scissors instead of an argument.",
      "Half a slice each wasn't as much as either of them wanted. But neither of them walked away feeling like the other one had won something at their expense.",
    ],
    recognitionPrompts: standardPrompts("Fairness"),
    noticeThisWeek: "This week, notice one moment where sharing something evenly matters more than getting the most for yourself.",
    storyboard: [
      { scene: 1, visual: "A pizza box with one slice left, two kids reaching.", narration: "There was one slice of pizza left, and two hungry kids." },
      { scene: 2, visual: "One kid pausing, then getting scissors instead of grabbing it.", narration: "They cut it in half instead." },
      { scene: 3, visual: "Both kids eating their half, satisfied.", narration: "It felt right to both.", onScreenText: "Where have you seen fairness this week?" },
    ],
  },
  {
    slug: "respect-grandpas-chair",
    elementName: "Respect",
    familyKey: "justice",
    title: "Grandpa's Chair",
    beginning: [
      "There was one comfortable chair in the living room. It was always Grandpa's.",
      "One day Grandpa was napping in his room, and the chair was empty.",
      "Lena wanted to sit in it. But she chose the couch instead.",
      "When Grandpa came out later, his chair was still exactly his.",
    ],
    growing: [
      "The big soft armchair by the window had been Grandpa's spot for as long as Lena could remember, even though nobody had ever officially said so.",
      "One afternoon he was napping, and the chair sat empty, and it really was more comfortable than the couch.",
      "Lena thought about it for a second, then chose the couch anyway — not because anyone was watching, but because that chair meant something to him.",
      "When Grandpa shuffled out later and settled back into his usual spot, he had no idea anything had almost changed. But Lena knew she'd chosen to honor something that mattered to someone else, even when it cost her a little comfort.",
    ],
    recognitionPrompts: standardPrompts("Respect"),
    noticeThisWeek: "This week, notice one thing that matters to someone else, and honor it even when no one's watching.",
    storyboard: [
      { scene: 1, visual: "A cozy armchair by a window, clearly a favorite spot.", narration: "There was one comfortable chair. It was always Grandpa's." },
      { scene: 2, visual: "A kid looking at the empty chair, tempted, then walking to the couch instead.", narration: "Lena wanted to sit in it. She chose the couch instead." },
      { scene: 3, visual: "Grandpa settling back into his chair later, unaware.", narration: "His chair was still exactly his.", onScreenText: "Where have you seen respect this week?" },
    ],
  },
  {
    slug: "truth-the-cracked-window",
    elementName: "Truth",
    familyKey: "justice",
    title: "The Cracked Window",
    beginning: [
      "A ball cracked the classroom window during recess.",
      "Nobody saw who threw it, except Wyatt.",
      "The teacher asked what happened. Wyatt could have said nothing.",
      "Instead, he said, 'It was an accident, and I saw it happen.' He told exactly what he saw, nothing more, nothing less.",
    ],
    growing: [
      "The ball cracked the corner of the classroom window with a sound loud enough that everyone froze, but by the time the teacher came out, the kid who'd thrown it had slipped back into the crowd.",
      "Wyatt had seen the whole thing, clearly, from right where he was standing near the fence.",
      "He could have said nothing and let it stay a mystery — nobody would have known he'd seen anything at all.",
      "Instead, when the teacher asked, he described exactly what he'd actually seen: an accident, a wild throw, nobody trying to break anything. Not more dramatic, not less — just what was actually true.",
    ],
    recognitionPrompts: standardPrompts("Truth"),
    noticeThisWeek: "This week, notice one moment where saying exactly what's true, no more and no less, actually matters.",
    storyboard: [
      { scene: 1, visual: "A cracked classroom window, kids scattering.", narration: "A ball cracked the classroom window during recess." },
      { scene: 2, visual: "Wyatt standing near the fence, having seen everything.", narration: "Nobody saw who threw it, except Wyatt." },
      { scene: 3, visual: "Wyatt calmly telling the teacher exactly what happened.", narration: "He told exactly what he saw, nothing more, nothing less.", onScreenText: "Where have you seen truth this week?" },
    ],
  },
  {
    slug: "dignity-the-torn-shoes",
    elementName: "Dignity",
    familyKey: "justice",
    title: "The Torn Shoes",
    beginning: [
      "A new kid came to school with shoes that were falling apart.",
      "Some kids laughed. Yusuf did not laugh.",
      "He sat next to the new kid at lunch like it was nothing unusual.",
      "The new kid didn't feel small that day, because Yusuf treated him like he mattered.",
    ],
    growing: [
      "The new kid, Marcus, showed up his first day in shoes that were coming apart at the sole, and a couple of kids near the lockers snickered before the bell even rang.",
      "Yusuf noticed the shoes too. He also noticed Marcus noticing everyone noticing.",
      "At lunch, Yusuf just walked over and sat down next to him, asking about his old school like the shoes weren't even there to talk about.",
      "Nothing about Marcus's shoes changed that day. But something about how small he felt walking into that lunchroom did — because one person had treated him like he mattered exactly as much as anyone else.",
    ],
    recognitionPrompts: standardPrompts("Dignity"),
    noticeThisWeek: "This week, notice one person who might be feeling small, and treat them like they matter, plainly, without making a show of it.",
    storyboard: [
      { scene: 1, visual: "A new kid arriving in worn-out shoes, other kids snickering nearby.", narration: "A new kid came to school with shoes that were falling apart." },
      { scene: 2, visual: "One kid noticing, then sitting down next to him at lunch.", narration: "Yusuf sat next to the new kid like it was nothing unusual." },
      { scene: 3, visual: "Both kids talking and laughing, shoes forgotten.", narration: "The new kid didn't feel small that day.", onScreenText: "Where have you seen dignity this week?" },
    ],
  },
  {
    slug: "equality-the-team-picks",
    elementName: "Equality",
    familyKey: "justice",
    title: "The Team Picks",
    beginning: [
      "Every recess, the same two kids got picked last for kickball.",
      "Harper was a team captain one day.",
      "She picked in a different order than usual, mixing everyone up.",
      "For once, nobody had to stand there the longest, waiting to be chosen.",
    ],
    growing: [
      "Every single recess, without anyone ever officially deciding it, the same two kids ended up standing there the longest, picked dead last for kickball.",
      "When it was finally Harper's turn to be captain, she noticed she was about to do the exact same thing everyone always did, out of pure habit.",
      "Instead, she picked names out of a hat that morning, before anyone even lined up, so nobody's turn depended on how good they were at the game.",
      "It wasn't a dramatic gesture. Nobody even really commented on it. But for one recess, the two kids who always stood there longest didn't have to.",
    ],
    recognitionPrompts: standardPrompts("Equality"),
    noticeThisWeek: "This week, notice one habit or routine that leaves the same people out every time, and try changing it.",
    storyboard: [
      { scene: 1, visual: "Kids lined up for kickball, the same two kids left standing at the end, again.", narration: "The same two kids got picked last, every time." },
      { scene: 2, visual: "Harper writing names on paper and drawing from a hat instead.", narration: "Harper picked in a different order than usual." },
      { scene: 3, visual: "A more mixed, evenly-distributed team lineup.", narration: "Nobody had to stand there the longest, waiting.", onScreenText: "Where have you seen equality this week?" },
    ],
  },
  {
    slug: "grace-the-spilled-juice",
    elementName: "Grace",
    familyKey: "justice",
    title: "The Spilled Juice",
    beginning: [
      "Ivy's little brother spilled juice all over her homework.",
      "Ivy was about to yell. He looked like he might cry first.",
      "She took a breath and said, 'It's okay, accidents happen.'",
      "They cleaned it up together instead of making it a bigger problem.",
    ],
    growing: [
      "Ivy had spent almost an hour on that homework, and her little brother Sami knocked his whole cup of juice straight across the page, soaking it through.",
      "For a second she felt the yell rising up in her chest, fully justified, ready to go.",
      "But Sami's face had already crumpled, and Ivy realized yelling wouldn't un-spill anything — it would just add a second mess on top of the first one.",
      "She took a breath and said it was okay, that accidents happen to everyone, and grabbed a towel. They mopped it up together, and her homework, a little wrinkled, still turned out fine.",
    ],
    recognitionPrompts: standardPrompts("Grace"),
    noticeThisWeek: "This week, notice one moment where you could react harshly, and choose gentleness instead.",
    storyboard: [
      { scene: 1, visual: "Juice spilling across a homework page.", narration: "Ivy's little brother spilled juice all over her homework." },
      { scene: 2, visual: "Ivy about to react, then softening as her brother's face falls.", narration: "She took a breath instead of yelling." },
      { scene: 3, visual: "Both kids cleaning up the spill together.", narration: "They cleaned it up together instead of making it worse.", onScreenText: "Where have you seen grace this week?" },
    ],
  },
  {
    slug: "tolerance-the-different-lunch",
    elementName: "Tolerance",
    familyKey: "justice",
    title: "The Different Lunch",
    beginning: [
      "Amara's lunch smelled different from everyone else's.",
      "One kid made a face at it.",
      "Jayden didn't make a face. He asked, 'What is it? It smells good.'",
      "Amara smiled and told him all about it.",
    ],
    growing: [
      "Amara's grandmother had packed her a lunch full of spices nobody else at the table had ever smelled before, and one kid wrinkled his nose the second she opened the container.",
      "Amara felt her face get hot, the way it always did when this happened.",
      "But Jayden, sitting across from her, leaned in instead and asked what it was, saying honestly that it smelled good to him.",
      "Amara's whole posture changed. She spent the rest of lunch explaining the dish her grandmother made, and for once, different didn't feel like something to be embarrassed about.",
    ],
    recognitionPrompts: standardPrompts("Tolerance"),
    noticeThisWeek: "This week, notice something unfamiliar to you, and get curious about it instead of reacting.",
    storyboard: [
      { scene: 1, visual: "A lunch table, one kid's food looking and smelling different.", narration: "Amara's lunch smelled different from everyone else's." },
      { scene: 2, visual: "One kid making a face; another leaning in curiously.", narration: "Jayden asked, 'What is it? It smells good.'" },
      { scene: 3, visual: "Amara smiling, explaining her food happily.", narration: "Different didn't feel like something to be embarrassed about.", onScreenText: "Where have you seen tolerance this week?" },
    ],
  },
  {
    slug: "courtesy-holding-the-door",
    elementName: "Courtesy",
    familyKey: "justice",
    title: "Holding the Door",
    beginning: [
      "Diego's arms were full of groceries walking into the building.",
      "A stranger reached the door first and could have just gone in.",
      "Instead, she held it open and waited for him.",
      "It took her ten extra seconds, and it made Diego's whole day a little easier.",
    ],
    growing: [
      "Diego's arms were completely full of grocery bags, the plastic handles cutting into his fingers, and he was still a few steps from the apartment building's front door.",
      "A woman he'd never met reached the door well before him and could have just walked through without a second thought.",
      "Instead she stopped, held it wide open, and waited those extra ten seconds while he shuffled through, bags and all.",
      "It cost her almost nothing. For Diego, juggling six bags and a set of keys, it was the difference between an easy walk in and a real struggle.",
    ],
    recognitionPrompts: standardPrompts("Courtesy"),
    noticeThisWeek: "This week, notice one small, easy thing you could do that would genuinely help someone else.",
    storyboard: [
      { scene: 1, visual: "A kid struggling with grocery bags approaching a building door.", narration: "Diego's arms were full of groceries." },
      { scene: 2, visual: "A stranger reaching the door first, then holding it open, waiting.", narration: "She held it open and waited for him." },
      { scene: 3, visual: "Diego walking through easily, nodding thanks.", narration: "It made his whole day a little easier.", onScreenText: "Where have you seen courtesy this week?" },
    ],
  }
);

// ===========================================================================
// FORTITUDE
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "bravery-the-first-day",
    elementName: "Bravery",
    familyKey: "fortitude",
    title: "The First Day",
    beginning: [
      "It was Naomi's first day at a brand-new school.",
      "She didn't know anyone. Her stomach felt tight and nervous.",
      "She walked in anyway, and sat down at a table with strangers.",
      "By lunchtime, one of those strangers was starting to feel like a friend.",
    ],
    growing: [
      "Naomi's stomach had been in knots since breakfast, and it didn't get better standing outside the unfamiliar front doors of her brand-new school.",
      "Every face inside was a stranger's face. Every hallway looked exactly like every other hallway, and she had no idea where anything was.",
      "She could have hung back near the wall all morning. Instead, at lunch, she made herself walk to a table and sit down among people she'd never met.",
      "Her voice shook a little the first time she spoke. But by the time the bell rang, one of those strangers, a girl named Priya, had already asked if she wanted to sit there again tomorrow.",
    ],
    recognitionPrompts: standardPrompts("Bravery"),
    noticeThisWeek: "This week, notice one moment your stomach feels tight, and do the thing anyway, even a little.",
    storyboard: [
      { scene: 1, visual: "A kid standing alone outside unfamiliar school doors.", narration: "It was Naomi's first day at a brand-new school." },
      { scene: 2, visual: "Naomi walking in, sitting at a lunch table of strangers.", narration: "She walked in anyway, and sat down." },
      { scene: 3, visual: "Naomi and a new friend laughing together.", narration: "One of those strangers was starting to feel like a friend.", onScreenText: "Where have you seen bravery this week?" },
    ],
  },
  {
    slug: "confidence-the-recital",
    elementName: "Confidence",
    familyKey: "fortitude",
    title: "The Recital",
    beginning: [
      "Owen had practiced his piano piece a hundred times.",
      "Backstage, his hands still felt shaky.",
      "He remembered how many times he had gotten it right at home.",
      "He walked out and played the whole piece, start to finish.",
    ],
    growing: [
      "Owen had played this same piece so many times at home that his fingers practically knew it without his brain being involved at all.",
      "Standing backstage with the recital lights glowing through the curtain, his hands still felt shaky, and his brain kept insisting he'd forget it the second he sat down.",
      "Instead of listening to that voice, he reminded himself of something true: he had actually played this piece correctly, dozens of times, under far worse conditions than this.",
      "He walked out, sat down, and let his hands do what they already knew how to do. The shaky feeling didn't fully disappear — but it didn't stop him either.",
    ],
    recognitionPrompts: standardPrompts("Confidence"),
    noticeThisWeek: "This week, notice one moment of nervousness, and remind yourself of real evidence that you can actually do the thing.",
    storyboard: [
      { scene: 1, visual: "A kid practicing piano at home, playing well.", narration: "Owen had practiced his piano piece a hundred times." },
      { scene: 2, visual: "Owen backstage, hands shaking, recital lights glowing beyond the curtain.", narration: "Backstage, his hands still felt shaky." },
      { scene: 3, visual: "Owen playing confidently on stage, finishing to applause.", narration: "He played the whole piece, start to finish.", onScreenText: "Where have you seen confidence this week?" },
    ],
  },
  {
    slug: "resilience-the-broken-sandcastle",
    elementName: "Resilience",
    familyKey: "fortitude",
    title: "The Broken Sandcastle",
    beginning: [
      "Talia spent all afternoon building a sandcastle.",
      "A wave came in and knocked it flat.",
      "She sat with it for a minute, feeling sad.",
      "Then she started building a new one, a little further from the water.",
    ],
    growing: [
      "Talia had spent almost the whole afternoon building the sandcastle, carving little windows, patting the walls smooth, getting the towers just right.",
      "One wave, bigger than the rest, rolled in without warning and flattened the whole thing in about two seconds.",
      "She sat there for a minute, genuinely upset, watching the wet sand where her towers used to be.",
      "Then she picked a new spot, further up the beach where the water couldn't reach, and started again. This one turned out even better than the first — because now she knew exactly what she was doing.",
    ],
    recognitionPrompts: standardPrompts("Resilience"),
    noticeThisWeek: "This week, notice something that didn't go as planned, and notice what it takes to start again.",
    storyboard: [
      { scene: 1, visual: "An elaborate sandcastle on a beach.", narration: "Talia spent all afternoon building a sandcastle." },
      { scene: 2, visual: "A wave crashing over it, flattening it completely.", narration: "A wave came in and knocked it flat." },
      { scene: 3, visual: "Talia starting a new sandcastle further from the water.", narration: "She started building a new one.", onScreenText: "Where have you seen resilience this week?" },
    ],
  },
  {
    slug: "steadfast-the-daily-walk",
    elementName: "Steadfast",
    familyKey: "fortitude",
    title: "The Daily Walk",
    beginning: [
      "Every single day, rain or shine, Grandpa walked around the block.",
      "One rainy morning, Iris asked why he didn't just skip it.",
      "He said, 'If I skip it when it's hard, I'll skip it every time it's hard.'",
      "He put on his raincoat and walked anyway.",
    ],
    growing: [
      "Grandpa had walked the same loop around the block every single morning for as long as Iris could remember, no matter the weather.",
      "One particularly gray, rainy morning, Iris asked why he didn't just stay in and skip it, just this once.",
      "'If I skip it because it's raining today,' he said, pulling on his raincoat, 'I'll find a reason to skip it every time something's hard. Then it stops being a walk I do — it's just a walk I meant to do.'",
      "He walked his loop that morning exactly like every other morning, a little wetter than usual, but exactly as steady.",
    ],
    recognitionPrompts: standardPrompts("Steadfast"),
    noticeThisWeek: "This week, notice one thing you keep doing even when it would be easy to skip it.",
    storyboard: [
      { scene: 1, visual: "An older man walking the same street every morning, in different weather across several frames.", narration: "Every single day, rain or shine, Grandpa walked around the block." },
      { scene: 2, visual: "A rainy window, Grandpa putting on a raincoat.", narration: "'If I skip it when it's hard, I'll skip it every time.'" },
      { scene: 3, visual: "Grandpa walking steadily in the rain.", narration: "He walked anyway.", onScreenText: "Where have you seen steadfastness this week?" },
    ],
  },
  {
    slug: "independent-tying-the-knot",
    elementName: "Independent",
    familyKey: "fortitude",
    title: "Tying the Knot",
    beginning: [
      "Every time Rosa's shoelace came undone, someone tied it for her.",
      "One day, no one was around to help.",
      "She sat down and tried it herself, slowly, three times.",
      "The fourth try held, and she stood up and kept playing.",
    ],
    growing: [
      "For weeks, every time Rosa's shoelace came loose on the playground, she'd just call over whichever grown-up was closest, and they'd tie it without her thinking twice about it.",
      "One recess, with no teacher anywhere nearby and her lace flopping loose again, she realized nobody was coming to do it for her this time.",
      "She sat down on the curb and tried it the way she remembered being shown, slowly, and it fell apart twice before she even got the loops right.",
      "The third try held for about ten steps before it came undone again. But the fourth one held all the way through recess — and she'd done it entirely on her own.",
    ],
    recognitionPrompts: standardPrompts("Independent"),
    noticeThisWeek: "This week, notice one thing you usually ask for help with, and try it on your own first.",
    storyboard: [
      { scene: 1, visual: "A playground, a kid's shoelace undone, looking around for help.", narration: "Every time Rosa's shoelace came undone, someone tied it for her." },
      { scene: 2, visual: "Rosa sitting alone on a curb, attempting the knot, failing, trying again.", narration: "She tried it herself, slowly, three times." },
      { scene: 3, visual: "Rosa standing up, lace tied, running back to play.", narration: "The fourth try held.", onScreenText: "Where have you seen independence this week?" },
    ],
  }
);

// ===========================================================================
// SELF-CONTROL
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "peace-the-loud-argument",
    elementName: "Peace",
    familyKey: "self-control",
    title: "The Loud Argument",
    beginning: [
      "Two kids were arguing loudly at the table, both getting upset.",
      "Nora felt like joining in and taking a side.",
      "Instead she just breathed slowly and stayed quiet and calm.",
      "Without a third loud voice, the argument fizzled out on its own.",
    ],
    growing: [
      "Two of Nora's friends were going back and forth at the lunch table, voices climbing, both of them sure they were right.",
      "Every part of Nora wanted to jump in, to take a side, to add her own opinion to the pile.",
      "Instead she just sat there, breathing slowly, not adding fuel to either side.",
      "Without a third voice joining the noise, the argument ran out of steam within a minute, and both kids quietly went back to eating like nothing had happened.",
    ],
    recognitionPrompts: standardPrompts("Peace"),
    noticeThisWeek: "This week, notice a moment of tension around you, and notice what happens when you don't add to it.",
    storyboard: [
      { scene: 1, visual: "Two kids arguing loudly at a lunch table.", narration: "Two kids were arguing loudly, both getting upset." },
      { scene: 2, visual: "A third kid sitting calmly, breathing, not joining in.", narration: "Nora just breathed slowly and stayed calm." },
      { scene: 3, visual: "The argument fading, everyone back to eating quietly.", narration: "The argument fizzled out on its own.", onScreenText: "Where have you seen peace this week?" },
    ],
  },
  {
    slug: "mindfulness-the-anthill",
    elementName: "Mindfulness",
    familyKey: "self-control",
    title: "The Anthill",
    beginning: [
      "On the way to school, Felix always rushed past everything.",
      "One day he stopped to actually watch an anthill for a minute.",
      "He noticed things he'd never noticed before — how organized it all was.",
      "He got to school a minute later than usual, but he'd really seen something.",
    ],
    growing: [
      "Felix walked the same route to school every single day, usually with headphones in, moving fast, barely looking at anything around him.",
      "One morning, for no particular reason, he stopped at the same anthill he must have passed a thousand times and just watched it.",
      "Ants moved in busy lines, carrying things twice their size, turning at exactly the same spot every time, and none of it had ever really registered before.",
      "He got to school a minute later than usual. But for that minute, he'd actually been present in his own morning instead of just passing through it.",
    ],
    recognitionPrompts: standardPrompts("Mindfulness"),
    noticeThisWeek: "This week, notice one ordinary moment, and actually slow down enough to be present in it.",
    storyboard: [
      { scene: 1, visual: "A kid walking fast with headphones, not looking around.", narration: "Felix always rushed past everything." },
      { scene: 2, visual: "Felix crouching down, watching an anthill closely.", narration: "One day he stopped to actually watch." },
      { scene: 3, visual: "Felix walking on, thoughtful, noticing more of his surroundings.", narration: "He'd really seen something.", onScreenText: "Where have you seen mindfulness this week?" },
    ],
  },
  {
    slug: "moderation-the-candy-bowl",
    elementName: "Moderation",
    familyKey: "self-control",
    title: "The Candy Bowl",
    beginning: [
      "There was a whole bowl of candy left over from a party.",
      "Cora could have eaten as much as she wanted.",
      "She took three pieces and put the bowl away.",
      "She still had some left to enjoy the next day too.",
    ],
    growing: [
      "The leftover candy bowl from the party sat on the counter, completely unsupervised, with nobody keeping track of how much was in it.",
      "Cora could easily have eaten handful after handful without anyone noticing or saying a word.",
      "Instead she counted out three pieces she genuinely wanted, closed the lid, and put the bowl back in the cupboard.",
      "The next afternoon, there was still candy left to enjoy — a little bit of restraint today meant there was something left to actually look forward to tomorrow.",
    ],
    recognitionPrompts: standardPrompts("Moderation"),
    noticeThisWeek: "This week, notice one thing you could have as much of as you wanted, and choose just enough instead.",
    storyboard: [
      { scene: 1, visual: "A full bowl of candy on a kitchen counter.", narration: "There was a whole bowl of candy left over." },
      { scene: 2, visual: "A kid taking exactly three pieces, closing the lid.", narration: "She took three pieces and put the bowl away." },
      { scene: 3, visual: "The same kid enjoying candy again the next day.", narration: "She still had some left to enjoy the next day too.", onScreenText: "Where have you seen moderation this week?" },
    ],
  },
  {
    slug: "awareness-the-quiet-classmate",
    elementName: "Awareness",
    familyKey: "self-control",
    title: "The Quiet Classmate",
    beginning: [
      "Every day, one classmate sat alone at recess.",
      "Most kids walked right past without really noticing.",
      "Ezra actually noticed, and started to wonder why.",
      "Noticing was the first step before he ever said a single word to her.",
    ],
    growing: [
      "Every single day at recess, without fail, the same classmate sat by herself on the same bench, and most kids walked right past on their way to the field.",
      "For weeks, Ezra was one of those kids, not unkind, just not paying attention.",
      "Then one day he actually noticed the pattern — same girl, same bench, every single day — and started wondering what her recess was actually like.",
      "He didn't march over and say anything yet. He just started paying attention to something he'd been walking past for months, which was the whole first step.",
    ],
    recognitionPrompts: standardPrompts("Awareness"),
    noticeThisWeek: "This week, notice one thing around you that you usually walk past without really seeing.",
    storyboard: [
      { scene: 1, visual: "A girl sitting alone on a bench at recess, kids walking past.", narration: "Every day, one classmate sat alone at recess." },
      { scene: 2, visual: "One kid slowing down, actually noticing the pattern.", narration: "Ezra actually noticed, and started to wonder why." },
      { scene: 3, visual: "Ezra watching thoughtfully from across the yard.", narration: "Noticing was the first step.", onScreenText: "Where have you seen awareness this week?" },
    ],
  },
  {
    slug: "fidelity-the-promise-to-water-the-plant",
    elementName: "Fidelity",
    familyKey: "self-control",
    title: "The Plant on the Windowsill",
    beginning: [
      "Leo promised his teacher he'd water the class plant every day.",
      "Some days he forgot, and had to remember later that evening.",
      "But he never let a single day pass without doing it.",
      "By the end of the year, the plant had grown twice as tall.",
    ],
    growing: [
      "When the class plant was assigned to Leo for the whole school year, it seemed like an easy promise to keep — just a little water, every day.",
      "Some days he genuinely forgot until he was already home, and had to catch a ride back or ask his mom to help him remember before bed.",
      "But he never once let a full day pass without actually keeping the promise, even when it was inconvenient or he'd rather have skipped it.",
      "By the end of the school year, the plant on the windowsill had grown twice as tall as it started — proof of a promise that got kept, quietly, all year long.",
    ],
    recognitionPrompts: standardPrompts("Fidelity"),
    noticeThisWeek: "This week, notice one small promise you've made, and notice what it takes to actually keep it.",
    storyboard: [
      { scene: 1, visual: "A small plant on a classroom windowsill, a kid watering it.", narration: "Leo promised to water the class plant every day." },
      { scene: 2, visual: "Leo remembering at home in the evening, hurrying to water it.", narration: "Some days he forgot, and remembered later." },
      { scene: 3, visual: "The plant, now tall and full, at the end of the year.", narration: "The plant had grown twice as tall.", onScreenText: "Where have you seen fidelity this week?" },
    ],
  }
);

// ===========================================================================
// LOVE
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "compassion-the-crying-kid",
    elementName: "Compassion",
    familyKey: "love",
    title: "The Crying Kid",
    beginning: [
      "A younger kid fell down and started crying on the playground.",
      "Some kids just kept playing.",
      "Aiden stopped and knelt down next to him.",
      "He didn't need to fix anything. He just needed to be there.",
    ],
    growing: [
      "The younger kid tripped hard on the blacktop and went down, and within seconds his face crumpled into real tears, knees scraped and stinging.",
      "Most of the other kids barely slowed down, already back into their game before he'd even finished falling.",
      "Aiden stopped his own game completely and knelt down next to him, not saying much, just staying close.",
      "He couldn't make the scrape stop hurting or undo the fall. But he understood, somehow, that just being there mattered on its own, separate from fixing anything.",
    ],
    recognitionPrompts: standardPrompts("Compassion"),
    noticeThisWeek: "This week, notice someone who's hurting, and just be present with them, even if you can't fix it.",
    storyboard: [
      { scene: 1, visual: "A young kid falling on a playground, crying.", narration: "A younger kid fell down and started crying." },
      { scene: 2, visual: "Other kids continuing to play; one kid stopping, kneeling beside him.", narration: "Aiden stopped and knelt down next to him." },
      { scene: 3, visual: "The two kids sitting together quietly.", narration: "He just needed to be there.", onScreenText: "Where have you seen compassion this week?" },
    ],
  },
  {
    slug: "generosity-the-extra-mitten",
    elementName: "Generosity",
    familyKey: "love",
    title: "The Extra Mitten",
    beginning: [
      "It was freezing outside, and Cara had two warm mittens.",
      "Her friend Deja had none, and her hands were red and cold.",
      "Cara gave her one mitten, and kept one for herself.",
      "They walked home together, each with one warm hand.",
    ],
    growing: [
      "It was one of the coldest days of the winter, and Cara had come prepared with a warm pair of mittens, one on each hand.",
      "Deja, walking next to her, had forgotten hers entirely, and her hands had gone red and stiff by the time they were halfway home.",
      "Cara peeled off one of her own mittens and handed it over without making a whole thing of it.",
      "They walked the rest of the way each with one bare hand tucked in a pocket and one warm mittened hand — sharing the cold, and the warmth, exactly evenly.",
    ],
    recognitionPrompts: standardPrompts("Generosity"),
    noticeThisWeek: "This week, notice something you have enough of, and share it with someone who doesn't.",
    storyboard: [
      { scene: 1, visual: "Two kids walking in the cold, one with mittens, one without.", narration: "It was freezing outside, and Cara had two warm mittens." },
      { scene: 2, visual: "Cara handing over one mitten to her cold friend.", narration: "Cara gave her one mitten, and kept one for herself." },
      { scene: 3, visual: "Both kids walking together, each with one mittened hand.", narration: "Each with one warm hand.", onScreenText: "Where have you seen generosity this week?" },
    ],
  },
  {
    slug: "forgiveness-the-borrowed-book",
    elementName: "Forgiveness",
    familyKey: "love",
    title: "The Borrowed Book",
    beginning: [
      "Mia lent her favorite book to her friend, who accidentally spilled water on it.",
      "The pages were wrinkled and some words were smudged.",
      "Mia felt upset, but her friend felt terrible too.",
      "Mia said, 'It's okay. I know you didn't mean it,' and they stayed friends.",
    ],
    growing: [
      "Mia's favorite book, the one she'd read three times already, came back from her friend Ruth with an entire chapter's pages wrinkled and warped from a spilled water bottle.",
      "For a moment, Mia felt a real flash of anger — that book mattered to her, and it would never quite look the same again.",
      "But Ruth's face was already miserable, clearly more upset about it than Mia even was, and it had obviously been a genuine accident.",
      "Mia took a breath and said it was okay, that she knew Ruth hadn't meant it — and meant it when she said it, not just to end the conversation. Their friendship didn't get a single water stain on it.",
    ],
    recognitionPrompts: standardPrompts("Forgiveness"),
    noticeThisWeek: "This week, notice a small hurt someone caused by accident, and notice what it takes to let it go.",
    storyboard: [
      { scene: 1, visual: "A wrinkled, water-stained book.", narration: "Mia's favorite book came back with wrinkled, smudged pages." },
      { scene: 2, visual: "Mia looking upset, her friend looking miserable and apologetic.", narration: "Mia felt upset, but her friend felt terrible too." },
      { scene: 3, visual: "The two friends smiling again, book in hand.", narration: "'I know you didn't mean it.'", onScreenText: "Where have you seen forgiveness this week?" },
    ],
  },
  {
    slug: "sympathy-the-lost-pet",
    elementName: "Sympathy",
    familyKey: "love",
    title: "The Lost Pet",
    beginning: [
      "Jonah's neighbor's cat went missing for three days.",
      "Jonah had never even met that cat.",
      "But he still felt sad for his neighbor, imagining how worried she must be.",
      "He helped put up 'lost cat' flyers around the block.",
    ],
    growing: [
      "Jonah barely knew his elderly neighbor Mrs. Ferris, and had honestly never even met her cat, which had gone missing three days earlier.",
      "But every time he saw her out on her porch, scanning the street, worry written all over her face, something in him ached for her.",
      "He didn't need to have lost anything himself to imagine what those three days must have felt like for her.",
      "He spent an afternoon helping her tape 'lost cat' flyers to lampposts around the block — not because he'd been asked, but because he could feel, at least a little, what she must be going through.",
    ],
    recognitionPrompts: standardPrompts("Sympathy"),
    noticeThisWeek: "This week, notice someone going through something hard, even if it's not something you've experienced yourself.",
    storyboard: [
      { scene: 1, visual: "An elderly woman on a porch looking worried, scanning the street.", narration: "Jonah's neighbor's cat went missing for three days." },
      { scene: 2, visual: "Jonah watching from his own yard, feeling for her.", narration: "He still felt sad for his neighbor." },
      { scene: 3, visual: "Jonah helping tape up flyers on a lamppost.", narration: "He helped put up 'lost cat' flyers.", onScreenText: "Where have you seen sympathy this week?" },
    ],
  },
  {
    slug: "devotion-the-same-bus-stop",
    elementName: "Devotion",
    familyKey: "love",
    title: "The Same Bus Stop",
    beginning: [
      "Every morning, rain or shine, Grandma walked Ben to the bus stop.",
      "She never once said it was too much trouble.",
      "One cold morning, Ben told her she didn't have to keep doing it.",
      "She said, 'I want to. I always will, as long as I can.'",
    ],
    growing: [
      "Every single school morning for three years, Grandma had walked Ben the four blocks to the bus stop, no matter the weather, no matter how she was feeling that day.",
      "She never once complained about it, never mentioned it as a chore, never made Ben feel like a burden for needing the walk.",
      "One particularly cold morning, feeling a little guilty, Ben told her she really didn't have to keep doing this every day.",
      "She just smiled and said she wanted to, that she always would, for as long as she was able — and something in the way she said it made clear this had never once felt like an obligation to her.",
    ],
    recognitionPrompts: standardPrompts("Devotion"),
    noticeThisWeek: "This week, notice someone who shows up for you consistently, without ever making it feel like a burden.",
    storyboard: [
      { scene: 1, visual: "Grandma and grandson walking to a bus stop in different weather, over several mornings.", narration: "Every morning, rain or shine, Grandma walked Ben to the bus stop." },
      { scene: 2, visual: "A cold morning, Ben looking at her with concern.", narration: "'You don't have to keep doing this,' he said." },
      { scene: 3, visual: "Grandma smiling warmly, continuing the walk.", narration: "'I want to. I always will.'", onScreenText: "Where have you seen devotion this week?" },
    ],
  },
  {
    slug: "sacrifice-the-last-ticket",
    elementName: "Sacrifice",
    familyKey: "love",
    title: "The Last Ticket",
    beginning: [
      "There was only one ticket left to the movie everyone wanted to see.",
      "Both Sasha and her little brother wanted to go.",
      "Sasha gave the ticket to her brother instead of keeping it for herself.",
      "She missed the movie, but his excited face made it feel worth it.",
    ],
    growing: [
      "The theater had exactly one ticket left for the movie the whole family had been talking about for weeks, and both Sasha and her little brother Theo wanted it badly.",
      "Sasha genuinely wanted to see it too — she'd been looking forward to it just as much as he had.",
      "But she handed the ticket to Theo anyway, telling him to go with their dad, and stayed home instead.",
      "She missed the movie that weekend. But watching Theo bounce out the door, grinning, practically vibrating with excitement, she found she didn't regret giving something up for him.",
    ],
    recognitionPrompts: standardPrompts("Sacrifice"),
    noticeThisWeek: "This week, notice one thing you want, and notice what it feels like to give it up for someone else.",
    storyboard: [
      { scene: 1, visual: "A movie theater ticket booth, one ticket left.", narration: "There was only one ticket left to the movie everyone wanted." },
      { scene: 2, visual: "Sasha handing the ticket to her excited little brother.", narration: "Sasha gave the ticket to her brother instead." },
      { scene: 3, visual: "Sasha waving goodbye at the door, smiling despite missing out.", narration: "His excited face made it feel worth it.", onScreenText: "Where have you seen sacrifice this week?" },
    ],
  },
  {
    slug: "cherish-the-old-photograph",
    elementName: "Cherish",
    familyKey: "love",
    title: "The Old Photograph",
    beginning: [
      "In a drawer, Layla found an old, faded photo of her mom as a kid.",
      "It was a little torn at one corner.",
      "Instead of throwing it away, Layla put it in a frame on her shelf.",
      "Every time she looked at it, she smiled, thinking about her mom.",
    ],
    growing: [
      "Layla found the photograph while digging through an old drawer for tape — faded, a little torn at one corner, of her mom as a kid about Layla's own age now.",
      "It wasn't in great shape, and nobody would have blamed her for just leaving it in the drawer.",
      "Instead, she carefully smoothed it out, found an old frame, and set it right on her shelf where she'd see it every day.",
      "Every time she caught sight of it, she thought about her mom being exactly her age once, and something about holding onto that small, imperfect photo made her feel closer to her.",
    ],
    recognitionPrompts: standardPrompts("Cherish"),
    noticeThisWeek: "This week, notice something small and imperfect that still matters deeply to you, and take care of it.",
    storyboard: [
      { scene: 1, visual: "A faded, torn old photograph found in a drawer.", narration: "Layla found an old, faded photo of her mom as a kid." },
      { scene: 2, visual: "Layla carefully placing it in a frame.", narration: "Layla put it in a frame on her shelf." },
      { scene: 3, visual: "Layla smiling at the photo on her shelf.", narration: "Every time she looked at it, she smiled.", onScreenText: "Where have you seen this kind of cherishing this week?" },
    ],
  },
  {
    slug: "nurturing-the-classroom-seedling",
    elementName: "Nurturing",
    familyKey: "love",
    title: "The Classroom Seedling",
    beginning: [
      "The class planted tiny bean seeds in little paper cups.",
      "Every day, Priya checked on hers and gave it exactly the right amount of water.",
      "Some other seeds got forgotten and dried out.",
      "Priya's seedling grew tall and strong because she paid attention to it.",
    ],
    growing: [
      "On the first day of the science unit, the whole class planted identical bean seeds in identical little paper cups lined up on the windowsill.",
      "Priya checked hers every single morning, giving it just enough water, moving it a little in the sun when it started leaning.",
      "A few other cups on the same windowsill dried out completely within a week, forgotten by classmates who'd moved on to other things.",
      "By the end of the month, Priya's seedling stood taller than almost any other in the class — not because her seed had been special, but because she'd actually paid attention to what it needed, every single day.",
    ],
    recognitionPrompts: standardPrompts("Nurturing"),
    noticeThisWeek: "This week, notice something (or someone) that grows better because you pay steady attention to it.",
    storyboard: [
      { scene: 1, visual: "A row of paper cups with bean seedlings on a windowsill.", narration: "The class planted tiny bean seeds in little paper cups." },
      { scene: 2, visual: "Priya carefully watering hers each day; other cups drying out nearby.", narration: "Priya checked on hers every day." },
      { scene: 3, visual: "Priya's seedling grown tall, clearly healthier than the others.", narration: "It grew tall and strong because she paid attention.", onScreenText: "Where have you seen nurturing this week?" },
    ],
  }
);

// ===========================================================================
// POSITIVE ATTITUDE
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "joy-the-puddle",
    elementName: "Joy",
    familyKey: "positive-attitude",
    title: "The Puddle",
    beginning: [
      "After the rain, there was one huge puddle on the sidewalk.",
      "Most people walked carefully around it.",
      "Finn jumped right in with both feet, laughing.",
      "For that one splashy moment, nothing else mattered at all.",
    ],
    growing: [
      "The rain had left one enormous puddle stretched across the sidewalk, mirror-still, reflecting the whole gray sky.",
      "Everyone walking past carefully stepped around the edges, keeping their shoes dry, keeping their eyes down.",
      "Finn looked at it for exactly one second before running straight in with both feet, sending water flying in every direction, laughing out loud at nothing in particular.",
      "His shoes were soaked for the rest of the walk home. For that one splashy moment, though, he wasn't thinking about homework or chores or anything else — just the pure, uncomplicated joy of a really good puddle.",
    ],
    recognitionPrompts: standardPrompts("Joy"),
    noticeThisWeek: "This week, notice one small chance for pure, uncomplicated fun, and actually take it.",
    storyboard: [
      { scene: 1, visual: "A large puddle on a sidewalk after rain, people walking carefully around it.", narration: "After the rain, there was one huge puddle." },
      { scene: 2, visual: "A kid jumping into it with both feet, water splashing everywhere.", narration: "Finn jumped right in with both feet, laughing." },
      { scene: 3, visual: "Finn walking home, soaked shoes, still grinning.", narration: "Nothing else mattered at all.", onScreenText: "Where have you seen joy this week?" },
    ],
  },
  {
    slug: "hope-the-empty-garden-bed",
    elementName: "Hope",
    familyKey: "positive-attitude",
    title: "The Empty Garden Bed",
    beginning: [
      "Grandad planted tiny seeds in a bed of plain brown dirt.",
      "It looked like nothing at all for two whole weeks.",
      "Every day, he still watered it, expecting something good.",
      "In the third week, tiny green sprouts finally appeared.",
    ],
    growing: [
      "Grandad knelt down and pressed tiny seeds into a garden bed that, once he stood back up, just looked like plain brown dirt — nothing to show for it at all.",
      "For two entire weeks, that's exactly what it kept looking like: dirt, nothing more, no matter how closely anyone checked.",
      "Every single day anyway, Grandad watered it carefully, genuinely expecting good things were happening under the surface even though nothing proved it yet.",
      "In the third week, tiny green sprouts finally broke through — proof, eventually, that the waiting and the watering hadn't been for nothing.",
    ],
    recognitionPrompts: standardPrompts("Hope"),
    noticeThisWeek: "This week, notice something you're waiting on, and keep tending to it even before you see results.",
    storyboard: [
      { scene: 1, visual: "An older man planting seeds in plain brown dirt.", narration: "Grandad planted tiny seeds in a bed of plain brown dirt." },
      { scene: 2, visual: "The same dirt bed, unchanged, across a two-week calendar montage, him watering it daily.", narration: "It looked like nothing at all for two whole weeks." },
      { scene: 3, visual: "Tiny green sprouts finally emerging.", narration: "Tiny green sprouts finally appeared.", onScreenText: "Where have you seen hope this week?" },
    ],
  },
  {
    slug: "optimism-the-rained-out-picnic",
    elementName: "Optimism",
    familyKey: "positive-attitude",
    title: "The Rained-Out Picnic",
    beginning: [
      "The family picnic got completely rained out.",
      "Everyone was disappointed at first.",
      "Dad said, 'Let's just have the picnic on the living room floor instead.'",
      "It turned out to be one of the most fun afternoons all summer.",
    ],
    growing: [
      "The whole family had planned the picnic for weeks, and the morning it finally arrived, it poured rain without a single break in the clouds.",
      "Everyone stood at the window, genuinely disappointed, watching the plan wash away.",
      "Dad looked at the picnic basket, looked at the rain, and suggested spreading the blanket right there on the living room floor instead.",
      "It sounded a little silly at first. But between the sandwiches, the blanket, and everyone laughing about eating a 'picnic' indoors, it turned into one of the best afternoons of the whole summer.",
    ],
    recognitionPrompts: standardPrompts("Optimism"),
    noticeThisWeek: "This week, notice a plan that falls through, and look for a good version of the day anyway.",
    storyboard: [
      { scene: 1, visual: "A family looking disappointed at rain through a window, picnic basket packed.", narration: "The family picnic got completely rained out." },
      { scene: 2, visual: "Dad spreading a picnic blanket on the living room floor.", narration: "'Let's have the picnic on the living room floor instead.'" },
      { scene: 3, visual: "The family laughing, eating sandwiches indoors on the blanket.", narration: "One of the most fun afternoons all summer.", onScreenText: "Where have you seen optimism this week?" },
    ],
  },
  {
    slug: "cheerfulness-the-grumpy-morning",
    elementName: "Cheerfulness",
    familyKey: "positive-attitude",
    title: "The Grumpy Morning",
    beginning: [
      "Everyone in the house woke up grumpy and tired one Monday.",
      "Nobody felt like talking.",
      "Ivy put on a silly, happy song while making breakfast anyway.",
      "By the time everyone sat down to eat, a few people were smiling.",
    ],
    growing: [
      "It was one of those Mondays where everyone in the house seemed to wake up on the wrong side of the bed at exactly the same time — grumbling, dragging their feet, barely speaking.",
      "Ivy felt just as tired as everyone else. But instead of adding to the grumpiness, she put on a ridiculous, upbeat song while she made toast.",
      "At first nobody reacted. Then her little brother started mouthing the words without meaning to, then tapping his foot.",
      "By the time the whole family sat down to eat, the grumpy fog hadn't completely lifted — but there were a couple of real smiles at the table that hadn't been there ten minutes earlier.",
    ],
    recognitionPrompts: standardPrompts("Cheerfulness"),
    noticeThisWeek: "This week, notice a low-energy moment, and try bringing a little lightness into it on purpose.",
    storyboard: [
      { scene: 1, visual: "A grumpy family at breakfast, everyone tired and quiet.", narration: "Everyone in the house woke up grumpy and tired." },
      { scene: 2, visual: "One kid turning on a silly happy song while making toast.", narration: "Ivy put on a silly, happy song anyway." },
      { scene: 3, visual: "The family at the table, a few genuine smiles now.", narration: "A few people were smiling.", onScreenText: "Where have you seen cheerfulness this week?" },
    ],
  },
  {
    slug: "humor-the-burnt-pancakes",
    elementName: "Humor",
    familyKey: "positive-attitude",
    title: "The Burnt Pancakes",
    beginning: [
      "Dad tried to make pancakes and burned every single one.",
      "The kitchen filled with smoke and a very bad smell.",
      "Instead of getting upset, Dad held one up and said, 'Behold, my hockey pucks.'",
      "Everyone laughed, and they ordered cereal instead.",
    ],
    growing: [
      "Dad had promised pancakes for breakfast, and somewhere between flipping the third one and answering a phone call, every single pancake in the pan turned solid black.",
      "Smoke curled up toward the ceiling, and the smell alone was enough to make everyone wrinkle their noses from the next room.",
      "Instead of getting frustrated at the ruined breakfast, Dad held up one charred, hockey-puck-flat pancake like a trophy and announced it with total seriousness.",
      "The whole family cracked up, cereal got poured instead, and the burnt pancakes became a story told at dinner for weeks afterward.",
    ],
    recognitionPrompts: standardPrompts("Humor"),
    noticeThisWeek: "This week, notice something that goes wrong in a small way, and try finding what's funny about it.",
    storyboard: [
      { scene: 1, visual: "A smoking pan of completely burnt pancakes.", narration: "Dad tried to make pancakes and burned every single one." },
      { scene: 2, visual: "Dad holding up a charred pancake like a trophy, grinning.", narration: "'Behold, my hockey pucks.'" },
      { scene: 3, visual: "The whole family laughing at the breakfast table.", narration: "Everyone laughed, and they ordered cereal instead.", onScreenText: "Where have you seen humor this week?" },
    ],
  },
  {
    slug: "faith-the-new-neighborhood",
    elementName: "Faith",
    familyKey: "positive-attitude",
    title: "The New Neighborhood",
    beginning: [
      "Aaliyah's family moved to a brand-new city where she knew no one.",
      "She didn't know if she'd ever make friends there.",
      "She kept believing good things were possible, even without proof yet.",
      "By the end of the first month, she had two real friends on her street.",
    ],
    growing: [
      "The moving truck pulled away from Aaliyah's old house for the last time, and the new city on the other end felt like a place where she knew absolutely nobody.",
      "There was no guarantee at all that she'd make a single friend there — nothing to prove it would work out.",
      "Still, she kept believing, quietly, that good things were possible even before there was any evidence of it — and that belief kept her willing to say hello to new faces instead of hiding in her room.",
      "By the end of that first month, she had two real friends living just down the street, and the new city didn't feel quite so unfamiliar anymore.",
    ],
    recognitionPrompts: standardPrompts("Faith"),
    noticeThisWeek: "This week, notice something uncertain, and notice what it feels like to keep believing good things are possible anyway.",
    storyboard: [
      { scene: 1, visual: "A moving truck pulling away from a house; a girl looking at an unfamiliar new street.", narration: "Aaliyah's family moved to a brand-new city." },
      { scene: 2, visual: "Aaliyah walking down the new street, hopeful despite not knowing anyone.", narration: "She kept believing good things were possible." },
      { scene: 3, visual: "Aaliyah laughing with two new friends on the street.", narration: "By the end of the first month, she had two real friends.", onScreenText: "Where have you seen faith this week?" },
    ],
  },
  {
    slug: "flexibility-the-changed-plan",
    elementName: "Flexibility",
    familyKey: "positive-attitude",
    title: "The Changed Plan",
    beginning: [
      "The whole class planned an outdoor field day, but it got moved inside.",
      "Some kids complained the whole time.",
      "Wren just asked, 'Okay, so what can we do in here instead?'",
      "The indoor version turned out to be its own kind of fun.",
    ],
    growing: [
      "The class had been looking forward to field day outside for weeks — relay races, the whole field to run around in — and then a surprise storm moved everything indoors at the last minute.",
      "A handful of kids spent the first ten minutes just complaining about how unfair it was and how much better it would have been outside.",
      "Wren, instead of dwelling on the plan that wasn't happening anymore, just asked the teacher plainly what they actually could do in the gym.",
      "It turned into an indoor obstacle course that ended up being its own kind of memorable — not the day anyone had planned, but a good day all the same.",
    ],
    recognitionPrompts: standardPrompts("Flexibility"),
    noticeThisWeek: "This week, notice a plan that changes unexpectedly, and try adjusting instead of just being upset about it.",
    storyboard: [
      { scene: 1, visual: "Kids looking disappointed at rain through a gym window, field day gear packed away.", narration: "The field day got moved inside." },
      { scene: 2, visual: "One kid asking the teacher what they could do instead, undeterred.", narration: "'What can we do in here instead?'" },
      { scene: 3, visual: "Kids having fun with an improvised indoor obstacle course.", narration: "The indoor version turned out to be its own kind of fun.", onScreenText: "Where have you seen flexibility this week?" },
    ],
  }
);

// ===========================================================================
// HARD WORK
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "diligence-the-spelling-list",
    elementName: "Diligence",
    familyKey: "hard-work",
    title: "The Spelling List",
    beginning: [
      "There were twenty new spelling words to learn by Friday.",
      "Instead of cramming the night before, Vera studied five a day.",
      "Some evenings she really didn't feel like it.",
      "On Friday, she knew every single word.",
    ],
    growing: [
      "Twenty new spelling words, due for a test on Friday, could easily have waited until Thursday night, crammed in all at once, the way a lot of kids did it.",
      "Vera instead broke it into five words a night, a little at a time, all week long.",
      "Some nights she really didn't want to — homework was already done, and studying felt like an extra chore nobody was forcing on her.",
      "She did it anyway, night after night, and by Friday morning, every single word was solid in her memory, no cramming required.",
    ],
    recognitionPrompts: standardPrompts("Diligence"),
    noticeThisWeek: "This week, notice one task you could do all at once at the last minute, and try a little bit each day instead.",
    storyboard: [
      { scene: 1, visual: "A list of twenty spelling words pinned to a board.", narration: "There were twenty new spelling words to learn by Friday." },
      { scene: 2, visual: "A kid studying five words each evening, over several nights.", narration: "Vera studied five a day instead of cramming." },
      { scene: 3, visual: "The kid confidently taking the Friday test.", narration: "On Friday, she knew every single word.", onScreenText: "Where have you seen diligence this week?" },
    ],
  },
  {
    slug: "determination-the-monkey-bars",
    elementName: "Determination",
    familyKey: "hard-work",
    title: "The Monkey Bars",
    beginning: [
      "Zoe couldn't make it across the monkey bars without falling.",
      "She fell on the first try. Then the second. Then the third.",
      "She kept coming back to try again every single recess.",
      "On the ninth try, two weeks later, she finally made it all the way across.",
    ],
    growing: [
      "The monkey bars had beaten Zoe every single time since the first week of school — her hands would slip, or her arms would give out halfway, and down she'd go onto the wood chips.",
      "The first try didn't work. Neither did the second, or the third, and by then most kids would have decided the monkey bars just weren't for them.",
      "Zoe kept coming back anyway, every single recess, trying again even when her palms were sore from the grip.",
      "On her ninth real attempt, nearly two weeks after she'd started, she made it all the way across for the first time — and the feeling was bigger than if she'd gotten it on the first try.",
    ],
    recognitionPrompts: standardPrompts("Determination"),
    noticeThisWeek: "This week, notice something you haven't gotten yet, and keep trying instead of giving up on it.",
    storyboard: [
      { scene: 1, visual: "A kid falling off monkey bars onto wood chips.", narration: "Zoe couldn't make it across without falling." },
      { scene: 2, visual: "Repeated attempts across several days, a small tally mark counter.", narration: "She kept coming back to try again." },
      { scene: 3, visual: "Zoe finally swinging all the way across, triumphant.", narration: "On the ninth try, she finally made it.", onScreenText: "Where have you seen determination this week?" },
    ],
  },
  {
    slug: "dedication-the-violin-case",
    elementName: "Dedication",
    familyKey: "hard-work",
    title: "The Violin Case",
    beginning: [
      "Tomas practiced violin for twenty minutes every single day.",
      "Even on days he had soccer, or was tired, or wanted to watch TV.",
      "It wasn't always his favorite twenty minutes.",
      "After a whole year, he could finally play a real, whole song.",
    ],
    growing: [
      "Every single day for a year, Tomas opened his violin case and practiced for twenty minutes, no matter what else was going on that day.",
      "Some days it competed with soccer practice, or being genuinely tired, or a favorite show he wanted to watch instead.",
      "It wasn't always the twenty minutes he was most excited about, and some days he counted down the clock more than he enjoyed it.",
      "But after a full year of showing up for it anyway, he could finally play an entire real song from start to finish — something none of the twenty-minute days alone would have told him he was building toward.",
    ],
    recognitionPrompts: standardPrompts("Dedication"),
    noticeThisWeek: "This week, notice something you keep showing up for, even on days it's not your favorite thing to do.",
    storyboard: [
      { scene: 1, visual: "A violin case opening, a kid practicing.", narration: "Tomas practiced violin for twenty minutes every single day." },
      { scene: 2, visual: "A montage of different days — tired, busy with soccer, still practicing.", narration: "Even on days he had soccer, or was tired." },
      { scene: 3, visual: "Tomas playing a full song confidently, a year later.", narration: "He could finally play a real, whole song.", onScreenText: "Where have you seen dedication this week?" },
    ],
  },
  {
    slug: "ambition-the-lemonade-stand",
    elementName: "Ambition",
    familyKey: "hard-work",
    title: "The Lemonade Stand",
    beginning: [
      "Diego wanted to save enough money to buy a new bike.",
      "He started a lemonade stand to earn some of it himself.",
      "It took many hot afternoons of selling cups of lemonade.",
      "By the end of summer, he had earned enough for half the bike.",
    ],
    growing: [
      "Diego had his eye on a specific bike at the shop downtown, one his allowance alone would take years to cover.",
      "Instead of just wishing for it, he set up a lemonade stand on the corner and started actually working toward it.",
      "It took a whole summer of hot afternoons, sticky pitchers, and plenty of days when barely anyone stopped by.",
      "By September, he'd earned enough for half the bike on his own — proof that wanting something big could turn into a real plan, one cup of lemonade at a time.",
    ],
    recognitionPrompts: standardPrompts("Ambition"),
    noticeThisWeek: "This week, notice something big you want, and think of one real step you could take toward it.",
    storyboard: [
      { scene: 1, visual: "A kid looking longingly at a bike in a shop window.", narration: "Diego wanted to save enough money to buy a new bike." },
      { scene: 2, visual: "A lemonade stand on a sunny corner, cups being sold.", narration: "He started a lemonade stand to earn some of it himself." },
      { scene: 3, visual: "Diego counting a jar of earned coins and bills, satisfied.", narration: "He had earned enough for half the bike.", onScreenText: "Where have you seen ambition this week?" },
    ],
  },
  {
    slug: "discipline-the-video-game-timer",
    elementName: "Discipline",
    familyKey: "hard-work",
    title: "The Video Game Timer",
    beginning: [
      "Marcus set a timer for himself before playing video games.",
      "When the timer went off, he really wanted to keep playing.",
      "He turned it off anyway, because he'd promised himself he would.",
      "He went outside instead, and later felt proud he'd stuck to his own plan.",
    ],
    growing: [
      "Marcus had decided, entirely on his own, that he'd play for thirty minutes and then stop, setting a timer to make sure he actually followed through.",
      "When the timer buzzed right in the middle of a really good level, every part of him wanted to just keep going a little longer.",
      "But he'd made that promise to himself, not to a parent standing over him, and he turned the console off anyway.",
      "He went outside instead, a little grumpy about it at first. Later that evening, though, he noticed something: he felt genuinely proud that he'd kept a promise nobody was making him keep but himself.",
    ],
    recognitionPrompts: standardPrompts("Discipline"),
    noticeThisWeek: "This week, notice one limit you set for yourself, and notice what it takes to actually stick to it.",
    storyboard: [
      { scene: 1, visual: "A kid setting a timer next to a video game controller.", narration: "Marcus set a timer for himself before playing video games." },
      { scene: 2, visual: "The timer buzzing mid-game; the kid reluctantly turning it off.", narration: "He turned it off anyway, because he'd promised himself." },
      { scene: 3, visual: "The kid playing outside, looking satisfied.", narration: "He felt proud he'd stuck to his own plan.", onScreenText: "Where have you seen discipline this week?" },
    ],
  },
  {
    slug: "self-reliance-the-flat-tire",
    elementName: "Self-reliance",
    familyKey: "hard-work",
    title: "The Flat Bike Tire",
    beginning: [
      "Rio's bike tire went flat halfway through the neighborhood.",
      "He could have just called someone to come get him.",
      "Instead, he remembered how his dad had shown him to patch a tube.",
      "He fixed it himself, right there on the sidewalk, and rode the rest of the way home.",
    ],
    growing: [
      "Rio's bike tire went completely flat right in the middle of the neighborhood loop, far enough from home that walking it back would take a while.",
      "His phone was right there in his pocket, and calling someone to come pick him up would have been the easy move.",
      "Instead, he thought back to the one time his dad had shown him how to find a puncture and patch an inner tube, and he still had the little repair kit clipped under his seat.",
      "Sitting right there on the sidewalk, he found the leak, patched it, and pumped the tire back up — then rode the rest of the way home on a fix he'd done entirely himself.",
    ],
    recognitionPrompts: standardPrompts("Self-reliance"),
    noticeThisWeek: "This week, notice a small problem, and try solving it yourself before asking for help.",
    storyboard: [
      { scene: 1, visual: "A bike with a flat tire on a neighborhood sidewalk.", narration: "Rio's bike tire went flat halfway through the neighborhood." },
      { scene: 2, visual: "Rio kneeling, using a small repair kit to patch the tube himself.", narration: "He fixed it himself, right there on the sidewalk." },
      { scene: 3, visual: "Rio riding home confidently on the repaired bike.", narration: "He rode the rest of the way home.", onScreenText: "Where have you seen self-reliance this week?" },
    ],
  }
);

// ===========================================================================
// INTEGRITY
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "authenticity-the-costume-party",
    elementName: "Authenticity",
    familyKey: "integrity",
    title: "The Costume Party",
    beginning: [
      "For the costume party, most kids picked whatever was popular that year.",
      "Wren really wanted to dress up as a mushroom, just because she loved mushrooms.",
      "A few kids thought it was a strange choice.",
      "Wren wore the mushroom costume anyway, and had the most fun of anyone there.",
    ],
    growing: [
      "The costume party invitation went around, and almost every kid in Wren's class was planning to dress as the same three popular characters that year.",
      "Wren, though, had been fascinated by mushrooms since a nature walk months earlier, and that's genuinely what she wanted to be.",
      "A couple of kids raised their eyebrows when she showed up in a lumpy felt mushroom cap instead of anything recognizable.",
      "But Wren had made exactly the costume she actually wanted, not the one that would blend in — and by the end of the night, she was the one everyone remembered.",
    ],
    recognitionPrompts: standardPrompts("Authenticity"),
    noticeThisWeek: "This week, notice one choice you make because it's genuinely you, even if it's not what's popular.",
    storyboard: [
      { scene: 1, visual: "Kids in matching popular costumes at a party.", narration: "Most kids picked whatever was popular that year." },
      { scene: 2, visual: "One kid in a homemade mushroom costume, standing out.", narration: "Wren really wanted to dress up as a mushroom." },
      { scene: 3, visual: "Wren having a great time, other kids drawn to her unique costume.", narration: "She had the most fun of anyone there.", onScreenText: "Where have you seen authenticity this week?" },
    ],
  },
  {
    slug: "character-the-unwatched-hallway",
    elementName: "Character",
    familyKey: "integrity",
    title: "The Unwatched Hallway",
    beginning: [
      "Nico found a twenty-dollar bill on the floor of an empty hallway.",
      "No teacher was around. No one saw him pick it up.",
      "He still walked it straight to the front office.",
      "The person who'd lost it was very relieved to get it back.",
    ],
    growing: [
      "The hallway was completely empty when Nico spotted a twenty-dollar bill lying near the lockers — no teacher in sight, no cameras he could see, nobody who would ever know if he just kept it.",
      "For a second, he thought about how far twenty dollars could go.",
      "But he picked it up and walked straight to the front office anyway, turning it in without anyone asking him to.",
      "Later that day, a clearly relieved sixth-grader came to claim it — money she'd been given for a school trip. Nico never told anyone what he'd done; he just knew he'd done it.",
    ],
    recognitionPrompts: standardPrompts("Character"),
    noticeThisWeek: "This week, notice a moment when no one would know either way, and notice what you choose to do.",
    storyboard: [
      { scene: 1, visual: "An empty school hallway, a twenty-dollar bill on the floor.", narration: "Nico found a twenty-dollar bill on the floor of an empty hallway." },
      { scene: 2, visual: "Nico walking to the front office, bill in hand.", narration: "He still walked it straight to the front office." },
      { scene: 3, visual: "A relieved student receiving the returned money.", narration: "The person who'd lost it was very relieved.", onScreenText: "Where have you seen character this week?" },
    ],
  },
  {
    slug: "genuineness-the-real-compliment",
    elementName: "Genuineness",
    familyKey: "integrity",
    title: "The Real Compliment",
    beginning: [
      "Everyone was complimenting the new kid's drawing to be polite.",
      "Sam actually looked at it closely first.",
      "He said exactly what he really thought: 'I love how you drew the shadows.'",
      "The new kid could tell Sam actually meant it, and it meant more than the other compliments.",
    ],
    growing: [
      "The new kid held up her drawing during art class, and a wave of 'nice job' and 'that's cool' went around the table, said quickly, without much thought behind it.",
      "Sam actually stopped and looked at the drawing properly before he said anything at all.",
      "What caught his eye were the shadows she'd drawn under the trees, done in a way he'd never tried himself, so that's exactly what he said.",
      "Something in how specific and real his comment was told the new kid he'd actually looked, not just said something nice to be polite — and that mattered more to her than every other compliment combined.",
    ],
    recognitionPrompts: standardPrompts("Genuineness"),
    noticeThisWeek: "This week, notice one moment you could say something quick and polite, and instead say something you actually mean.",
    storyboard: [
      { scene: 1, visual: "A kid holding up a drawing, classmates giving quick polite compliments.", narration: "Everyone was complimenting the new kid's drawing to be polite." },
      { scene: 2, visual: "One kid actually studying the drawing closely.", narration: "Sam actually looked at it closely first." },
      { scene: 3, visual: "Sam pointing out a specific detail; the new kid's face lighting up.", narration: "The new kid could tell Sam actually meant it.", onScreenText: "Where have you seen genuineness this week?" },
    ],
  },
  {
    slug: "reliability-the-promised-ride",
    elementName: "Reliability",
    familyKey: "integrity",
    title: "The Promised Ride",
    beginning: [
      "Aunt Rosa promised to pick Kenji up at exactly four o'clock.",
      "It started raining hard right around that time.",
      "At four o'clock exactly, her car pulled up anyway.",
      "Kenji had never once had to wonder if she'd really show up.",
    ],
    growing: [
      "Aunt Rosa had told Kenji, plainly, that she'd be outside the library at four o'clock sharp to pick him up after his study group.",
      "Right around that time, the sky opened up into a real downpour, the kind of weather that would have given anyone an easy excuse to be a little late.",
      "At four o'clock exactly, though, her car pulled up right in front, windshield wipers going full speed.",
      "It wasn't the first time either. Kenji had learned, over years of small moments just like this one, that when Aunt Rosa said a time, that's genuinely when she'd be there.",
    ],
    recognitionPrompts: standardPrompts("Reliability"),
    noticeThisWeek: "This week, notice someone who does exactly what they say they will, and notice what that makes possible.",
    storyboard: [
      { scene: 1, visual: "A kid waiting outside a library as rain begins.", narration: "Aunt Rosa promised to pick Kenji up at exactly four o'clock." },
      { scene: 2, visual: "Heavy rain falling; a car pulling up right on time.", narration: "At four o'clock exactly, her car pulled up anyway." },
      { scene: 3, visual: "Kenji climbing in, unsurprised, completely at ease.", narration: "He'd never once had to wonder if she'd show up.", onScreenText: "Where have you seen reliability this week?" },
    ],
  },
  {
    slug: "excellence-the-extra-coat-of-paint",
    elementName: "Excellence",
    familyKey: "integrity",
    title: "The Extra Coat of Paint",
    beginning: [
      "Mia's birdhouse project was already good enough to pass.",
      "But one side still looked a little rough.",
      "She sanded it smooth and added one more coat of paint.",
      "Nobody made her do it. She just wanted it to be genuinely good.",
    ],
    growing: [
      "By any normal grading standard, Mia's wooden birdhouse project was already finished — solid, painted, definitely good enough to turn in and get full marks.",
      "But one side, the back nobody would even really look at, still had a rough, unsanded patch where the paint had gone on unevenly.",
      "Nobody was going to check that side closely. The grade wasn't riding on it at all.",
      "Mia sanded it down and added one more careful coat anyway — not for a better grade, but because she wanted the whole thing, seen or unseen, to actually be as good as she could make it.",
    ],
    recognitionPrompts: standardPrompts("Excellence"),
    noticeThisWeek: "This week, notice something that's already 'good enough,' and notice what it takes to make it genuinely well done.",
    storyboard: [
      { scene: 1, visual: "A finished wooden birdhouse, one rough unpainted patch on the back.", narration: "Mia's birdhouse project was already good enough to pass." },
      { scene: 2, visual: "Mia sanding the rough patch carefully, adding paint.", narration: "She sanded it smooth and added one more coat." },
      { scene: 3, visual: "The finished, fully polished birdhouse.", narration: "She just wanted it to be genuinely good.", onScreenText: "Where have you seen excellence this week?" },
    ],
  }
);

// ===========================================================================
// GRATITUDE (completing the family)
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "gratefulness-the-hand-me-down-coat",
    elementName: "Gratefulness",
    familyKey: "gratitude",
    title: "The Hand-Me-Down Coat",
    beginning: [
      "Omar got his older cousin's coat instead of a brand-new one.",
      "At first he felt a little disappointed it wasn't new.",
      "Then he noticed how warm and soft and perfectly-broken-in it already was.",
      "He wore it happily all winter, patches and all.",
    ],
    growing: [
      "When the coat arrived, it was clearly his cousin's old one, a little faded at the cuffs, definitely not the shiny new one Omar had been picturing.",
      "For the first day or two, he felt a small pang of disappointment every time he put it on.",
      "But it was warmer than any new coat he'd tried on at the store, already broken in exactly to fit comfortably, soft in all the right places from years of wear.",
      "By the coldest week of winter, he'd stopped noticing it wasn't new at all — he just felt genuinely grateful to have something this warm and this comfortable.",
    ],
    recognitionPrompts: standardPrompts("Gratefulness"),
    noticeThisWeek: "This week, notice something you have that isn't new or perfect, and notice what's actually good about it.",
    storyboard: [
      { scene: 1, visual: "A slightly worn hand-me-down coat, a kid looking a little disappointed.", narration: "Omar got his older cousin's coat instead of a brand-new one." },
      { scene: 2, visual: "The kid noticing how warm and soft the coat actually is.", narration: "He noticed how warm and perfectly broken-in it already was." },
      { scene: 3, visual: "The kid happily bundled up in the coat in the snow.", narration: "He wore it happily all winter.", onScreenText: "Where have you seen gratefulness this week?" },
    ],
  },
  {
    slug: "thankfulness-the-note-to-the-bus-driver",
    elementName: "Thankfulness",
    familyKey: "gratitude",
    title: "The Note to the Bus Driver",
    beginning: [
      "Every day, the bus driver got Priya to school safely.",
      "Priya never really thought about it, the way you don't think about breathing.",
      "One day she wrote a small thank-you note and left it on the driver's seat.",
      "The driver read it and smiled the whole rest of the route.",
    ],
    growing: [
      "The bus driver had gotten Priya to school safely every single morning for two full years, through ice, through traffic, through every kind of weather, and Priya had genuinely never once thought about it.",
      "It was just background, the way the sun coming up every morning is background — always there, never really noticed.",
      "One evening, almost on a whim, she wrote a short note thanking him for always getting them there safely, and left it folded on the driver's seat before getting off the next morning.",
      "She never even saw him read it. But she found out later, from a classmate, that he'd kept it taped up by the mirror for the rest of the year.",
    ],
    recognitionPrompts: standardPrompts("Thankfulness"),
    noticeThisWeek: "This week, notice someone whose steady help you usually take for granted, and actually thank them.",
    storyboard: [
      { scene: 1, visual: "A school bus, driver focused on the road, Priya among other kids.", narration: "Every day, the bus driver got Priya to school safely." },
      { scene: 2, visual: "Priya writing a small note and leaving it on the driver's seat.", narration: "She wrote a small thank-you note." },
      { scene: 3, visual: "The note taped up by the bus mirror.", narration: "He kept it taped up by the mirror for the rest of the year.", onScreenText: "Where have you seen thankfulness this week?" },
    ],
  }
);

// ===========================================================================
// HUMILITY (completing the family)
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "modesty-the-science-fair-win",
    elementName: "Modesty",
    familyKey: "humility",
    title: "The Science Fair Win",
    beginning: [
      "Amina won first place at the science fair.",
      "She could have bragged about it all day.",
      "Instead, she thanked her partner and her teacher for their help.",
      "She was proud, quietly, without needing everyone to make a big deal of it.",
    ],
    growing: [
      "When the judges announced Amina's volcano project had taken first place, the easy thing to do would have been to celebrate loudly and remind everyone all day about it.",
      "She was genuinely proud — she'd worked hard on it, and it showed.",
      "But when people congratulated her, she kept turning the credit outward, mentioning her lab partner's idea for the eruption mixture and her teacher's help with the display board.",
      "She let the ribbon speak for itself, and felt just as proud walking home quietly as she would have felt announcing it to the whole bus.",
    ],
    recognitionPrompts: standardPrompts("Modesty"),
    noticeThisWeek: "This week, notice a moment you succeed at something, and notice what it feels like to let it speak for itself.",
    storyboard: [
      { scene: 1, visual: "A science fair, a blue first-place ribbon on a volcano project.", narration: "Amina won first place at the science fair." },
      { scene: 2, visual: "Amina thanking her partner and teacher instead of bragging.", narration: "She thanked her partner and her teacher for their help." },
      { scene: 3, visual: "Amina walking home quietly, ribbon in hand, content.", narration: "She was proud, quietly.", onScreenText: "Where have you seen modesty this week?" },
    ],
  },
  {
    slug: "sincerity-the-real-apology",
    elementName: "Sincerity",
    familyKey: "humility",
    title: "The Real Apology",
    beginning: [
      "Caleb accidentally knocked over his sister's block tower.",
      "He could have said 'sorry' quickly just to end the conversation.",
      "Instead he really looked at her and said he was truly sorry, meaning it.",
      "She could tell the difference, and forgave him right away.",
    ],
    growing: [
      "Caleb's elbow caught the edge of his little sister's block tower, sending an hour of careful building crashing to the floor in about one second.",
      "A quick 'sorry, whatever' and walking away would have technically counted as an apology.",
      "Instead, he actually stopped, knelt down next to the wreckage, and told her plainly that he really was sorry, that he knew how long she'd worked on it.",
      "His sister looked up at him and could tell right away this wasn't just a word he was saying to move on — and forgave him almost immediately because of it.",
    ],
    recognitionPrompts: standardPrompts("Sincerity"),
    noticeThisWeek: "This week, notice a moment you say 'sorry,' and notice whether you're really meaning it.",
    storyboard: [
      { scene: 1, visual: "A knocked-over block tower, blocks scattered.", narration: "Caleb accidentally knocked over his sister's block tower." },
      { scene: 2, visual: "Caleb kneeling down, looking his sister in the eye, speaking sincerely.", narration: "He really looked at her and meant his apology." },
      { scene: 3, visual: "The sister's face softening, forgiving him.", narration: "She could tell the difference.", onScreenText: "Where have you seen sincerity this week?" },
    ],
  },
  {
    slug: "meekness-the-corrected-mistake",
    elementName: "Meekness",
    familyKey: "humility",
    title: "The Corrected Mistake",
    beginning: [
      "During the group project, Fatima's answer turned out to be wrong.",
      "A teammate corrected her gently in front of everyone.",
      "Fatima could have gotten defensive or embarrassed.",
      "Instead she just said, 'Oh, good catch, thank you,' and fixed it.",
    ],
    growing: [
      "Fatima had confidently written down an answer during the group project, only for a teammate to point out, gently but clearly, that it wasn't quite right, right there in front of the whole table.",
      "It would have been easy to feel embarrassed, or to argue the point just to save face in front of everyone.",
      "Instead, she just looked at the correction, saw that her teammate was right, and said 'oh, good catch, thank you' without any edge to it at all.",
      "The group moved on within seconds, the mistake quietly fixed, and nobody thought less of Fatima for it — if anything, they respected how easily she'd taken the correction.",
    ],
    recognitionPrompts: standardPrompts("Meekness"),
    noticeThisWeek: "This week, notice a moment you're corrected, and notice what it takes to accept it without getting defensive.",
    storyboard: [
      { scene: 1, visual: "A group project table, one kid pointing out an error on a worksheet.", narration: "A teammate corrected Fatima's answer gently." },
      { scene: 2, visual: "Fatima nodding, unbothered, accepting the correction.", narration: "'Oh, good catch, thank you.'" },
      { scene: 3, visual: "The group continuing the project smoothly.", narration: "She fixed it and moved on.", onScreenText: "Where have you seen meekness this week?" },
    ],
  },
  {
    slug: "unpretentious-the-plain-backpack",
    elementName: "Unpretentious",
    familyKey: "humility",
    title: "The Plain Backpack",
    beginning: [
      "Deshawn's family could have bought him the fanciest backpack in the store.",
      "He picked the plain, simple one instead.",
      "A classmate asked why, since he could afford something flashier.",
      "Deshawn said, 'It holds my books just fine. That's really all I need.'",
    ],
    growing: [
      "At the store, Deshawn's parents told him he could pick whichever backpack he wanted, including the expensive ones with all the extra logos and lights that most kids were asking for that year.",
      "He walked past all of those and picked a plain, sturdy, unremarkable one instead, in a simple dark color.",
      "A classmate later asked why he hadn't gotten one of the flashy ones, especially since his family clearly could have afforded it.",
      "Deshawn just shrugged and said it held his books exactly fine, and that was really all a backpack needed to do — he didn't need it to say anything else about him.",
    ],
    recognitionPrompts: standardPrompts("Unpretentious"),
    noticeThisWeek: "This week, notice a moment you could show off, and notice what it feels like to just keep things simple instead.",
    storyboard: [
      { scene: 1, visual: "A store shelf of flashy backpacks, one plain simple one at the end.", narration: "Deshawn's family could have bought the fanciest backpack in the store." },
      { scene: 2, visual: "Deshawn choosing the plain backpack instead.", narration: "He picked the plain, simple one instead." },
      { scene: 3, visual: "Deshawn walking to school, backpack on, content.", narration: "'It holds my books just fine. That's really all I need.'", onScreenText: "Where have you seen this kind of simplicity this week?" },
    ],
  }
);

export function getChemistryStory(slug: string): ChemistryStory | undefined {
  return STORY_LIBRARY.find((s) => s.slug === slug);
}
