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
// Coverage status: all 123 canonical elements now have a complete story
// (beginning + growing + storyboard + recognition prompts), reached across
// several passes from the original six-story pilot. Verified: 123 unique
// slugs, 123 unique elementNames, every elementName matches lib/virtues.ts
// exactly, every canonical family fully represented. If a canonical
// element is ever added to lib/virtues.ts in the future, adding its story
// here means adding one more object to STORY_LIBRARY in the same shape;
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

// ===========================================================================
// ADDITIONAL WISDOM ELEMENTS
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "change-the-kid-who-hated-reading",
    elementName: "Change",
    familyKey: "wisdom",
    title: "The Kid Who Hated Reading",
    beginning: [
      "Nora used to say she just wasn't a reading person.",
      "She kept trying anyway, a little bit most nights.",
      "By spring, she was the one asking the librarian for more.",
      "Nora had decided, on her own, to become someone different.",
    ],
    growing: [
      "For years Nora told anyone who asked that she just wasn't a reading person — books felt slow, and she'd rather be doing almost anything else.",
      "Her teacher didn't argue with her about it. She just kept putting books in front of Nora that might actually interest her, a little at a time.",
      "Nora kept trying, some nights only a page or two, without really expecting anything to change.",
      "By spring, without really noticing when it happened, she'd become the kid asking the librarian what to read next — she had changed her own mind about herself, one ordinary evening at a time.",
    ],
    recognitionPrompts: standardPrompts("Change"),
    noticeThisWeek: "This week, notice one thing you've decided to be different about, even a little, and notice the effort behind it.",
    storyboard: [
      { scene: 1, visual: "Nora pushing a book away, unimpressed.", narration: "Nora used to say she just wasn't a reading person." },
      { scene: 2, visual: "Nora reading a little each night, page by page, over a montage of seasons.", narration: "She kept trying anyway, a little bit most nights." },
      { scene: 3, visual: "Nora at the library asking for another book, genuinely excited.", narration: "She had decided, on her own, to become someone different.", onScreenText: "Where have you seen change this week?" },
    ],
  },
  {
    slug: "critical-thinking-the-rumor-at-recess",
    elementName: "Critical thinking",
    familyKey: "wisdom",
    title: "The Rumor at Recess",
    beginning: [
      "By recess, everyone was repeating the same wild story about a teacher.",
      "Ezra wondered if it was actually true.",
      "He asked a few careful questions instead of just repeating it.",
      "It turned out almost none of it had actually happened.",
    ],
    growing: [
      "By the time the bell rang for recess, the story about a teacher had already traveled through half the grade, getting a little wilder with each retelling.",
      "Ezra noticed that nobody repeating it had actually seen anything themselves — everyone had just heard it from someone else.",
      "Instead of passing it along too, he asked a couple of quiet, careful questions: who actually saw this happen, and when?",
      "By the end of recess it was clear almost none of it was true at all — and Ezra was glad he hadn't helped spread something false just because everyone else already believed it.",
    ],
    recognitionPrompts: standardPrompts("Critical thinking"),
    noticeThisWeek: "This week, notice a story you almost repeated, and ask yourself how you actually know it's true.",
    storyboard: [
      { scene: 1, visual: "A cluster of kids at recess, a wild rumor spreading mouth to mouth.", narration: "By recess, everyone was repeating the same wild story." },
      { scene: 2, visual: "Ezra pausing, thinking, then asking a classmate a careful question.", narration: "He asked a few careful questions instead of just repeating it." },
      { scene: 3, visual: "The rumor deflating as the truth comes out.", narration: "Almost none of it had actually happened.", onScreenText: "Where have you seen critical thinking this week?" },
    ],
  },
  {
    slug: "intuition-the-feeling-before-she-said-anything",
    elementName: "Intuition",
    familyKey: "wisdom",
    title: "The Feeling Before She Said Anything",
    beginning: [
      "Ana's friend seemed completely normal at lunch.",
      "But something about it felt off to Ana anyway.",
      "She asked her friend quietly if she was really okay.",
      "Her friend's eyes filled up, and she finally said no.",
    ],
    growing: [
      "At lunch, Ana's friend was laughing at all the right moments, eating normally, acting exactly like any other day.",
      "Nothing anyone could point to was actually wrong — but something about it still didn't sit right with Ana, a feeling she couldn't quite explain.",
      "Instead of ignoring it, she waited until they were alone and asked quietly, 'Are you actually okay today?'",
      "Her friend's eyes filled up almost instantly, and she admitted that no, she really wasn't — she'd just been putting on a good show.",
    ],
    recognitionPrompts: standardPrompts("Intuition"),
    noticeThisWeek: "This week, notice a feeling that something's off, even when everything looks fine, and see what happens if you check.",
    storyboard: [
      { scene: 1, visual: "Two friends at a lunch table, one laughing normally.", narration: "Ana's friend seemed completely normal at lunch." },
      { scene: 2, visual: "Ana looking closely, sensing something isn't right.", narration: "Something about it felt off to Ana anyway." },
      { scene: 3, visual: "Ana quietly asking, her friend's eyes filling with tears.", narration: "Her friend finally said no.", onScreenText: "Where has your intuition spoken up this week?" },
    ],
  },
  {
    slug: "light-the-flashlight-in-the-storm",
    elementName: "Light",
    familyKey: "wisdom",
    title: "The Flashlight in the Storm",
    beginning: [
      "The whole street went dark when the storm knocked out the power.",
      "Diego grabbed his flashlight and went to check on his elderly neighbor.",
      "She was sitting in the dark, a little scared, glad to see him.",
      "His one small light made her whole night feel less frightening.",
    ],
    growing: [
      "The storm knocked the power out for the entire street, and within minutes every house on the block had gone completely dark.",
      "Diego grabbed the flashlight from his kitchen drawer and, instead of just staying inside, walked next door to check on Mrs. Okafor, who lived alone.",
      "He found her sitting very still in her dark living room, more nervous than she wanted to admit, relieved the moment she saw his light at the window.",
      "It was one small flashlight in one big storm, but for the next hour, sitting together while the wind howled outside, it was enough light to make the whole night feel less frightening.",
    ],
    recognitionPrompts: standardPrompts("Light"),
    noticeThisWeek: "This week, notice a moment you could be a small source of light for someone in a dark or uncertain moment.",
    storyboard: [
      { scene: 1, visual: "A whole street going dark during a storm.", narration: "The whole street went dark when the storm knocked out the power." },
      { scene: 2, visual: "Diego walking next door with a flashlight, wind and rain around him.", narration: "Diego grabbed his flashlight and went to check on his elderly neighbor." },
      { scene: 3, visual: "The two of them sitting together, one small light between them.", narration: "One small light made her whole night feel less frightening.", onScreenText: "Where have you been a light for someone this week?" },
    ],
  },
  {
    slug: "logic-the-puzzle-box",
    elementName: "Logic",
    familyKey: "wisdom",
    title: "The Puzzle Box",
    beginning: [
      "The wooden puzzle box wouldn't open no matter how Malik pulled at it.",
      "He stopped yanking and looked at it piece by piece instead.",
      "Slide this, then that, then this — in exactly that order.",
      "The box finally clicked open, exactly the way he'd worked it out.",
    ],
    growing: [
      "The wooden puzzle box at his cousin's house looked simple enough, but no amount of pulling or shaking made it open.",
      "After a few frustrating tries, Malik stopped forcing it and actually looked at how the pieces fit together instead.",
      "He noticed that one panel only moved after another one slid first — so he worked out the order, step by step, testing each idea before moving to the next.",
      "When the box finally clicked open, it wasn't luck — it was exactly the sequence he'd reasoned his way through, one careful step at a time.",
    ],
    recognitionPrompts: standardPrompts("Logic"),
    noticeThisWeek: "This week, notice a problem you could work through step by step instead of just guessing.",
    storyboard: [
      { scene: 1, visual: "A wooden puzzle box, a kid pulling at it in frustration.", narration: "The wooden puzzle box wouldn't open no matter how Malik pulled at it." },
      { scene: 2, visual: "Malik examining the pieces carefully, thinking.", narration: "He stopped yanking and looked at it piece by piece instead." },
      { scene: 3, visual: "The box clicking open in his hands.", narration: "The box finally clicked open, exactly the way he'd worked it out.", onScreenText: "Where have you used logic this week?" },
    ],
  },
  {
    slug: "objectivity-both-sides-of-the-story",
    elementName: "Objectivity",
    familyKey: "wisdom",
    title: "Both Sides of the Story",
    beginning: [
      "Yuki's two best friends had a big fight and both wanted her to pick a side.",
      "She listened carefully to both of their stories instead.",
      "Neither version was the whole truth, she realized.",
      "She told them both, gently, what she'd actually noticed.",
    ],
    growing: [
      "When Yuki's two best friends stopped speaking to each other, each one pulled her aside separately to explain exactly why the other one was wrong.",
      "It would have been easy to just agree with whoever was talking to her at the time, but instead Yuki actually listened carefully to both full stories.",
      "Once she'd heard both sides, she realized neither one was telling the whole truth — each of them had left out the part where they themselves hadn't been so fair either.",
      "She told them both, as gently as she could, what she'd actually noticed from listening to both — not choosing a side, just describing what seemed true.",
    ],
    recognitionPrompts: standardPrompts("Objectivity"),
    noticeThisWeek: "This week, notice a disagreement where you could look at both sides fairly before deciding what you think.",
    storyboard: [
      { scene: 1, visual: "Two friends separately telling Yuki their side of a fight.", narration: "Yuki's two best friends had a big fight and both wanted her to pick a side." },
      { scene: 2, visual: "Yuki listening carefully to both, weighing what she hears.", narration: "She listened carefully to both of their stories instead." },
      { scene: 3, visual: "Yuki gently telling them both what she noticed.", narration: "She told them both, gently, what she'd actually noticed.", onScreenText: "Where have you seen objectivity this week?" },
    ],
  },
  {
    slug: "originality-the-only-blue-dragon",
    elementName: "Originality",
    familyKey: "wisdom",
    title: "The Only Blue Dragon",
    beginning: [
      "Every art project in the class looked almost exactly the same.",
      "Amara decided to draw something nobody else had thought of.",
      "Her dragon was bright blue, made of teacups and clouds.",
      "It was the only one in the whole room that looked like it.",
    ],
    growing: [
      "The assignment was to draw a mythical creature, and by the time Amara looked around the room, almost everyone had drawn the exact same kind of green fire-breathing dragon.",
      "She could have drawn something similar and turned it in without much trouble.",
      "Instead she thought about what she actually found interesting, and drew a bright blue dragon made of stacked teacups with cloud-shaped wings, something that had never existed anywhere before she made it up.",
      "When the projects were pinned up on the wall, hers was the only one that looked like nothing else in the room — entirely her own idea, start to finish.",
    ],
    recognitionPrompts: standardPrompts("Originality"),
    noticeThisWeek: "This week, notice a moment you could make something that's genuinely your own idea instead of copying what's easy.",
    storyboard: [
      { scene: 1, visual: "A wall of nearly identical dragon drawings.", narration: "Every art project in the class looked almost exactly the same." },
      { scene: 2, visual: "Amara sketching something completely different, a blue teacup dragon.", narration: "Amara decided to draw something nobody else had thought of." },
      { scene: 3, visual: "Her unique drawing standing out on the wall.", narration: "It was the only one in the whole room that looked like it.", onScreenText: "Where have you seen originality this week?" },
    ],
  },
  {
    slug: "percipience-the-old-shoes",
    elementName: "Percipience",
    familyKey: "wisdom",
    title: "The Old Shoes",
    beginning: [
      "Leo noticed a classmate's shoes were falling apart at the sides.",
      "Nobody else seemed to have noticed at all.",
      "Leo quietly mentioned it to the school counselor.",
      "By the next week, the classmate had a new pair, and never knew how.",
    ],
    growing: [
      "Leo happened to notice, almost by accident, that a classmate's shoes had a hole worn clean through the side, and had for weeks.",
      "Nobody else in class seemed to have noticed anything at all — the classmate never mentioned it, and always seemed to act like everything was fine.",
      "Instead of saying anything directly, which might have felt embarrassing, Leo quietly mentioned what he'd noticed to the school counselor.",
      "By the following week, the classmate showed up in a new pair of shoes, and never found out it was Leo who had noticed what almost no one else had.",
    ],
    recognitionPrompts: standardPrompts("Percipience"),
    noticeThisWeek: "This week, notice something small about someone that others might be missing entirely.",
    storyboard: [
      { scene: 1, visual: "A close-up of worn-through shoes under a school desk.", narration: "Leo noticed a classmate's shoes were falling apart at the sides." },
      { scene: 2, visual: "Leo quietly speaking with the school counselor.", narration: "Leo quietly mentioned it to the school counselor." },
      { scene: 3, visual: "The classmate wearing new shoes the next week, unaware.", narration: "The classmate never knew how.", onScreenText: "Where has your percipience noticed something this week?" },
    ],
  },
  {
    slug: "priority-the-game-that-could-wait",
    elementName: "Priority",
    familyKey: "wisdom",
    title: "The Game That Could Wait",
    beginning: [
      "Ravi was one level away from beating his favorite game.",
      "His little brother needed help with homework due tomorrow.",
      "Ravi paused the game right where it was.",
      "The level was still there an hour later. His brother's stress wasn't.",
    ],
    growing: [
      "Ravi had been chasing the final level of his favorite game for weeks, and tonight he was finally, finally one level away from beating it.",
      "Right at that moment, his little brother came in, close to tears, stuck on homework that was due the next morning.",
      "Ravi looked at the paused screen for a second, then set the controller down and went to help — the game had been waiting for weeks; his brother's homework couldn't wait until tomorrow.",
      "An hour later, homework finished, Ravi picked the controller back up. The level was exactly where he'd left it. His brother wasn't stressed anymore, which mattered more.",
    ],
    recognitionPrompts: standardPrompts("Priority"),
    noticeThisWeek: "This week, notice a moment you have to choose what actually matters more right now.",
    storyboard: [
      { scene: 1, visual: "Ravi close to finishing a video game level.", narration: "Ravi was one level away from beating his favorite game." },
      { scene: 2, visual: "His little brother, upset, holding a homework sheet.", narration: "His little brother needed help with homework due tomorrow." },
      { scene: 3, visual: "Ravi paused the game, helping his brother at the table instead.", narration: "Ravi paused the game right where it was.", onScreenText: "Where have you set the right priority this week?" },
    ],
  },
  {
    slug: "prudence-saving-for-something-better",
    elementName: "Prudence",
    familyKey: "wisdom",
    title: "Saving for Something Better",
    beginning: [
      "Chen got a little allowance every week.",
      "He could have spent all of it on snacks right away.",
      "Instead he saved a little each week toward a real telescope.",
      "By fall, he had exactly enough, and a much better night sky.",
    ],
    growing: [
      "Every week, Chen got a small allowance, and every week he was tempted to spend all of it right away on snacks and small toys, the way most of his friends did.",
      "Instead, he thought ahead to something he actually wanted more: a real telescope he'd seen at the science store, far too expensive to buy all at once.",
      "So he saved a little each week, watching the jar slowly fill, resisting plenty of smaller purchases along the way.",
      "By fall, he had exactly enough — and the first night he used it, the sky looked more detailed and amazing than he'd ever imagined it could.",
    ],
    recognitionPrompts: standardPrompts("Prudence"),
    noticeThisWeek: "This week, notice a moment you could plan ahead instead of spending or using something all at once.",
    storyboard: [
      { scene: 1, visual: "A jar of coins slowly filling over weeks.", narration: "Chen got a little allowance every week." },
      { scene: 2, visual: "Chen resisting a shelf of snacks, saving instead.", narration: "Instead he saved a little each week toward a real telescope." },
      { scene: 3, visual: "Chen looking through his new telescope at the night sky.", narration: "By fall, he had exactly enough.", onScreenText: "Where have you shown prudence this week?" },
    ],
  },
  {
    slug: "reason-the-shadow-on-the-wall",
    elementName: "Reason",
    familyKey: "wisdom",
    title: "The Shadow on the Wall",
    beginning: [
      "Sofia woke up scared of a strange shape on her wall.",
      "Instead of hiding, she thought about what could actually cause it.",
      "It was just her coat, hanging exactly where she'd left it.",
      "The streetlight through the window had made it look like something else.",
    ],
    growing: [
      "Sofia woke in the middle of the night and saw a strange, hunched shape on her wall that hadn't been there before, and her heart started pounding.",
      "Instead of pulling the covers over her head, she made herself think it through: what was actually in that corner of the room during the day?",
      "She realized it was exactly where she'd hung her coat that afternoon — nothing had moved or changed at all.",
      "The streetlight outside her window, shining through the coat at just the wrong angle, was what had turned an ordinary coat into something that looked frightening in the dark.",
    ],
    recognitionPrompts: standardPrompts("Reason"),
    noticeThisWeek: "This week, notice a moment you can think something through instead of just reacting to how it first looks.",
    storyboard: [
      { scene: 1, visual: "A dark bedroom, a strange shadow shape on the wall.", narration: "Sofia woke up scared of a strange shape on her wall." },
      { scene: 2, visual: "Sofia thinking carefully, tracing the shadow back to its source.", narration: "She thought about what could actually cause it." },
      { scene: 3, visual: "The shadow revealed to be an ordinary coat under streetlight.", narration: "It was just her coat, hanging exactly where she'd left it.", onScreenText: "Where have you used reason this week?" },
    ],
  },
  {
    slug: "simplicity-the-simple-party",
    elementName: "Simplicity",
    familyKey: "wisdom",
    title: "The Simple Party",
    beginning: [
      "Kwame's birthday plans kept growing bigger and more complicated.",
      "He stopped and asked for something much simpler instead.",
      "Just a few close friends, cake, and a backyard.",
      "It ended up being the best birthday he'd ever had.",
    ],
    growing: [
      "Kwame's birthday plans had somehow grown from a small gathering into a huge list of decorations, activities, and a guest list twice as long as he'd wanted.",
      "One evening, looking at the overwhelming plan, he told his parents he didn't actually want any of that — he just wanted something simple.",
      "They scaled it back to exactly what he'd asked for: a few close friends, a cake, and an ordinary afternoon in the backyard.",
      "It turned out to be the best birthday he could remember, precisely because there was nothing complicated getting in the way of just enjoying it.",
    ],
    recognitionPrompts: standardPrompts("Simplicity"),
    noticeThisWeek: "This week, notice a moment where the simple version of something might actually be the better one.",
    storyboard: [
      { scene: 1, visual: "An overwhelming, cluttered party-planning list.", narration: "Kwame's birthday plans kept growing bigger and more complicated." },
      { scene: 2, visual: "Kwame asking his parents for something simpler.", narration: "He stopped and asked for something much simpler instead." },
      { scene: 3, visual: "A small, happy backyard gathering with a few close friends.", narration: "It ended up being the best birthday he'd ever had.", onScreenText: "Where have you noticed simplicity this week?" },
    ],
  },
  {
    slug: "spirituality-under-all-those-stars",
    elementName: "Spirituality",
    familyKey: "wisdom",
    title: "Under All Those Stars",
    beginning: [
      "Ines lay in the grass looking up at a sky full of stars.",
      "She felt small in a way that didn't feel bad at all.",
      "Something about it made her feel connected to everything.",
      "She didn't have words for it, but she felt it completely.",
    ],
    growing: [
      "On a camping trip far from any city lights, Ines lay back in the grass and looked up at more stars than she'd ever seen at once.",
      "For a while she didn't think about anything in particular — she just felt very small, in a way that was strangely comforting rather than scary.",
      "Something about being under all of it made her feel quietly connected to something much bigger than her own ordinary day.",
      "She didn't have the words to explain it to anyone, and didn't really try to — she just lay there and let herself feel it completely.",
    ],
    recognitionPrompts: standardPrompts("Spirituality"),
    noticeThisWeek: "This week, notice a quiet moment that makes you feel connected to something bigger than yourself.",
    storyboard: [
      { scene: 1, visual: "A kid lying in grass under a sky full of stars.", narration: "Ines lay in the grass looking up at a sky full of stars." },
      { scene: 2, visual: "A wide shot emphasizing how small and quiet the moment feels.", narration: "She felt small in a way that didn't feel bad at all." },
      { scene: 3, visual: "Ines smiling quietly, still looking up.", narration: "She didn't have words for it, but she felt it completely.", onScreenText: "Where have you felt this kind of connection this week?" },
    ],
  }
);

// ===========================================================================
// ADDITIONAL JUSTICE ELEMENTS
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "acceptance-the-new-kids-lunch-table",
    elementName: "Acceptance",
    familyKey: "justice",
    title: "The New Kid's Lunch Table",
    beginning: [
      "Tomas was new, spoke differently, and didn't know anyone.",
      "He stood holding his tray, not sure where to sit.",
      "Aisha waved him over without a second thought.",
      "Nobody at that table cared that he was different. He just belonged.",
    ],
    growing: [
      "Tomas had transferred schools halfway through the year, and everything about him — his accent, his clothes, the way he said certain words — was a little different from everyone else.",
      "At lunch, he stood holding his tray for a long moment, unsure where he'd even be allowed to sit.",
      "Aisha noticed him standing there and waved him over to her table without a second thought, the same way she would have for anyone.",
      "Nobody at that table treated him like he needed to prove anything to belong there. He just did, exactly as he was.",
    ],
    recognitionPrompts: standardPrompts("Acceptance"),
    noticeThisWeek: "This week, notice someone who might feel like they don't quite belong, and include them without conditions.",
    storyboard: [
      { scene: 1, visual: "A new kid standing alone with a lunch tray, looking uncertain.", narration: "Tomas was new, spoke differently, and didn't know anyone." },
      { scene: 2, visual: "Aisha waving him over to her table.", narration: "Aisha waved him over without a second thought." },
      { scene: 3, visual: "Tomas laughing and relaxed at the table with new friends.", narration: "Nobody at that table cared that he was different.", onScreenText: "Where have you shown acceptance this week?" },
    ],
  },
  {
    slug: "benignity-easy-on-the-substitute",
    elementName: "Benignity",
    familyKey: "justice",
    title: "Easy on the Substitute",
    beginning: [
      "The substitute teacher was clearly nervous and unsure of the material.",
      "Some kids saw a chance to cause trouble.",
      "Noah stayed calm, quiet, and patient instead.",
      "By the end of class, the substitute looked noticeably more relaxed.",
    ],
    growing: [
      "The substitute teacher clearly hadn't taught this subject before, and kept losing her place in the lesson, glancing nervously at her notes.",
      "A few kids in the back started whispering and testing how much they could get away with, sensing an easy day.",
      "Noah didn't join in. He kept his voice down, answered when she asked questions, and gave her a little extra patience instead of piling on.",
      "By the end of the period, the substitute looked visibly less tense than when she'd walked in — a small kindness that cost Noah nothing but made her whole day easier.",
    ],
    recognitionPrompts: standardPrompts("Benignity"),
    noticeThisWeek: "This week, notice someone who's having a hard time, and go a little easier on them than you might otherwise.",
    storyboard: [
      { scene: 1, visual: "A nervous substitute teacher glancing at notes.", narration: "The substitute teacher was clearly nervous and unsure of the material." },
      { scene: 2, visual: "A few kids whispering, testing the limits.", narration: "Some kids saw a chance to cause trouble." },
      { scene: 3, visual: "Noah being calm and patient, the teacher relaxing.", narration: "By the end of class, the substitute looked noticeably more relaxed.", onScreenText: "Where have you shown benignity this week?" },
    ],
  },
  {
    slug: "chivalry-carrying-the-box",
    elementName: "Chivalry",
    familyKey: "justice",
    title: "Carrying the Box",
    beginning: [
      "Grace was struggling to carry a huge box of books to the library.",
      "Owen noticed and offered to carry half of it.",
      "She said thanks, and they carried it together.",
      "It wasn't a big moment, just an easier walk for both of them.",
    ],
    growing: [
      "Grace was hauling an enormous box of donated books across the parking lot toward the library, stopping every few steps to adjust her grip.",
      "Owen was nearby and noticed her struggling, so he walked over and simply asked if she wanted help carrying it.",
      "She said thanks, genuinely relieved, and they split the load between them for the rest of the walk.",
      "It wasn't a dramatic moment — just one kid noticing another one struggling, and making an ordinary walk easier for both of them.",
    ],
    recognitionPrompts: standardPrompts("Chivalry"),
    noticeThisWeek: "This week, notice a moment you could offer to help carry something heavy, literally or otherwise.",
    storyboard: [
      { scene: 1, visual: "Grace struggling with a heavy box across a parking lot.", narration: "Grace was struggling to carry a huge box of books to the library." },
      { scene: 2, visual: "Owen walking over, offering to help.", narration: "Owen noticed and offered to carry half of it." },
      { scene: 3, visual: "The two of them carrying the box together, walking side by side.", narration: "It wasn't a big moment, just an easier walk for both of them.", onScreenText: "Where have you seen this kind of chivalry this week?" },
    ],
  },
  {
    slug: "civility-disagreeing-nicely",
    elementName: "Civility",
    familyKey: "justice",
    title: "Disagreeing Nicely",
    beginning: [
      "Mateo and Felix disagreed about the rules of their own game.",
      "Both of them wanted to win the argument, not just the game.",
      "They kept their voices calm and actually listened.",
      "They agreed on a fair rule and kept playing, still friends.",
    ],
    growing: [
      "Mateo and Felix were in the middle of a backyard game when they hit a real disagreement about whether a rule had actually been broken.",
      "For a second it looked like it might turn into shouting, the way these things sometimes do.",
      "Instead, both of them took a breath, kept their voices even, and actually listened to what the other one was saying instead of just repeating their own point louder.",
      "They landed on a rule that felt fair to both of them, picked the game back up, and neither one walked away upset.",
    ],
    recognitionPrompts: standardPrompts("Civility"),
    noticeThisWeek: "This week, notice a disagreement you could have politely instead of loudly.",
    storyboard: [
      { scene: 1, visual: "Two kids mid-argument over a backyard game rule.", narration: "Mateo and Felix disagreed about the rules of their own game." },
      { scene: 2, visual: "Both calming down, speaking evenly instead of shouting.", narration: "They kept their voices calm and actually listened." },
      { scene: 3, visual: "The two of them shaking on a fair rule, resuming play.", narration: "They agreed on a fair rule and kept playing, still friends.", onScreenText: "Where have you shown civility this week?" },
    ],
  },
  {
    slug: "honor-keeping-his-word-to-mr-alvarez",
    elementName: "Honor",
    familyKey: "justice",
    title: "Keeping His Word to Mr. Alvarez",
    beginning: [
      "Nadia promised her elderly neighbor she'd water his plants every day.",
      "Halfway through the week, a much more fun trip came up.",
      "She still went and watered the plants before she left.",
      "Mr. Alvarez never had to wonder if she'd keep her word.",
    ],
    growing: [
      "Before Mr. Alvarez left for a week to visit his daughter, Nadia promised him she'd water his plants every single day while he was gone.",
      "Halfway through the week, her family got invited on a spontaneous overnight trip that sounded like a lot more fun than watering someone else's plants.",
      "Before she left, though, she still walked over, watered every single plant carefully, and made sure everything was fine.",
      "Mr. Alvarez came home to a house full of healthy plants and never had to wonder, even once, whether Nadia would actually do what she'd said she would.",
    ],
    recognitionPrompts: standardPrompts("Honor"),
    noticeThisWeek: "This week, notice a promise you kept even when it would have been easier not to.",
    storyboard: [
      { scene: 1, visual: "Nadia promising Mr. Alvarez she'll water his plants.", narration: "Nadia promised her elderly neighbor she'd water his plants every day." },
      { scene: 2, visual: "A tempting trip invitation arriving, Nadia hesitating.", narration: "A much more fun trip came up halfway through the week." },
      { scene: 3, visual: "Nadia watering the plants carefully before leaving anyway.", narration: "Mr. Alvarez never had to wonder if she'd keep her word.", onScreenText: "Where have you shown honor this week?" },
    ],
  },
  {
    slug: "impartial-the-fair-ref",
    elementName: "Impartial",
    familyKey: "justice",
    title: "The Fair Ref",
    beginning: [
      "Zainab's best friend was playing in the game she was reffing.",
      "A close call went right in front of her.",
      "She called it exactly as she saw it, against her own friend.",
      "Her friend was disappointed, but respected her for it.",
    ],
    growing: [
      "Zainab had agreed to referee a school soccer match, and it just so happened her best friend was playing on one of the teams.",
      "Late in the game, a close call happened right in front of her — a call that, if she leaned even slightly toward her friend, nobody would really question.",
      "She called it exactly as she'd actually seen it, which happened to go against her own friend's team.",
      "Her friend was disappointed in the moment, but afterward told Zainab she respected that she hadn't played favorites, even for someone she cared about.",
    ],
    recognitionPrompts: standardPrompts("Impartial"),
    noticeThisWeek: "This week, notice a moment you could be fair even when it's harder because someone you care about is involved.",
    storyboard: [
      { scene: 1, visual: "Zainab reffing a soccer game, her friend on the field.", narration: "Zainab's best friend was playing in the game she was reffing." },
      { scene: 2, visual: "A close call happening right in front of her.", narration: "A close call went right in front of her." },
      { scene: 3, visual: "Zainab making the fair call, her friend nodding respectfully.", narration: "Her friend was disappointed, but respected her for it.", onScreenText: "Where have you been impartial this week?" },
    ],
  }
);

// ===========================================================================
// ADDITIONAL FORTITUDE ELEMENTS
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "assertive-speaking-up-in-group-work",
    elementName: "Assertive",
    familyKey: "fortitude",
    title: "Speaking Up in Group Work",
    beginning: [
      "Owen's group was about to turn in a plan he thought was unfair.",
      "He almost stayed quiet, the way he usually did.",
      "Instead he calmly said what he actually thought.",
      "The group listened, and the plan got better because he spoke.",
    ],
    growing: [
      "Owen's group project team had agreed on a plan that quietly gave two people almost all of the easy parts and left Owen with the hardest section, and no one seemed to notice but him.",
      "His first instinct was to just go along with it, the way he usually did when something felt unfair but small.",
      "This time, he took a breath and said clearly, without being harsh, that he thought the work should be split more evenly.",
      "The rest of the group actually listened, rearranged the plan, and the project — and Owen's week — ended up fairer because he'd said something instead of staying quiet.",
    ],
    recognitionPrompts: standardPrompts("Assertive"),
    noticeThisWeek: "This week, notice a moment you could speak up calmly instead of staying quiet about something unfair.",
    storyboard: [
      { scene: 1, visual: "A group project chart, Owen's section clearly overloaded.", narration: "Owen's group was about to turn in a plan he thought was unfair." },
      { scene: 2, visual: "Owen hesitating, then speaking up calmly.", narration: "Instead he calmly said what he actually thought." },
      { scene: 3, visual: "The group revising the plan together, more evenly split.", narration: "The plan got better because he spoke.", onScreenText: "Where have you been assertive this week?" },
    ],
  },
  {
    slug: "fearlessness-first-to-raise-a-hand",
    elementName: "Fearlessness",
    familyKey: "fortitude",
    title: "First to Raise a Hand",
    beginning: [
      "Nobody wanted to ask the question everyone was thinking.",
      "It felt embarrassing, like it might be a dumb question.",
      "Layla raised her hand and asked it anyway.",
      "Half the class was quietly grateful she had.",
    ],
    growing: [
      "The teacher had just explained something confusing, and Layla could tell from the silence that almost nobody actually understood it, including her.",
      "Nobody wanted to be the one to ask, worried it might sound like a dumb question in front of everyone.",
      "Layla felt that same worry too, but raised her hand and asked the question plainly anyway.",
      "The teacher explained it again more clearly, and afterward two classmates quietly told her they'd been wondering the exact same thing and were glad she'd asked.",
    ],
    recognitionPrompts: standardPrompts("Fearlessness"),
    noticeThisWeek: "This week, notice a moment you could go first even though it feels a little scary.",
    storyboard: [
      { scene: 1, visual: "A confused classroom, silence after a hard explanation.", narration: "Nobody wanted to ask the question everyone was thinking." },
      { scene: 2, visual: "Layla hesitating, then raising her hand.", narration: "Layla raised her hand and asked it anyway." },
      { scene: 3, visual: "Classmates nodding gratefully afterward.", narration: "Half the class was quietly grateful she had.", onScreenText: "Where have you shown fearlessness this week?" },
    ],
  },
  {
    slug: "magnanimity-no-grudge",
    elementName: "Magnanimity",
    familyKey: "fortitude",
    title: "No Grudge",
    beginning: [
      "Hiro's team won the championship after a tough season.",
      "The losing team's captain had trash-talked him all year.",
      "Hiro walked over and shook his hand anyway.",
      "He meant it. There was nothing left to hold onto.",
    ],
    growing: [
      "After a whole season of hard games, Hiro's team finally won the championship, and the celebration on the field was loud and immediate.",
      "The captain of the losing team had spent most of the season trash-talking Hiro specifically, and part of him wanted to enjoy this moment without acknowledging that at all.",
      "Instead, once things quieted down, Hiro walked over and shook his hand, telling him it had been a genuinely good season and a hard-fought game.",
      "He meant every word of it — winning had settled whatever there was to settle, and he didn't need to carry anything else forward.",
    ],
    recognitionPrompts: standardPrompts("Magnanimity"),
    noticeThisWeek: "This week, notice a moment you could let go of a grudge instead of holding onto it.",
    storyboard: [
      { scene: 1, visual: "A team celebrating a championship win.", narration: "Hiro's team won the championship after a tough season." },
      { scene: 2, visual: "The rival captain standing apart, having trash-talked all year.", narration: "The losing team's captain had trash-talked him all year." },
      { scene: 3, visual: "Hiro shaking his hand warmly and genuinely.", narration: "There was nothing left to hold onto.", onScreenText: "Where have you shown magnanimity this week?" },
    ],
  },
  {
    slug: "valor-getting-help",
    elementName: "Valor",
    familyKey: "fortitude",
    title: "Getting Help",
    beginning: [
      "Mei's little cousin slipped near the deep end of the pool.",
      "Mei was scared, but she didn't freeze.",
      "She shouted for the lifeguard immediately and pointed exactly where.",
      "Her cousin was pulled out safely within seconds.",
    ],
    growing: [
      "At the crowded community pool, Mei's little cousin slipped near the deep end and went under for a moment longer than she should have.",
      "Mei felt a jolt of real fear, the kind that makes it hard to think — but she didn't freeze, and she didn't just jump in blindly either.",
      "She shouted for the lifeguard as loudly as she could and pointed exactly where her cousin had gone under, giving him everything he needed to move fast.",
      "Within seconds, the lifeguard had her cousin safely out of the water — Mei's clear-headed courage in that moment had mattered as much as anything else.",
    ],
    recognitionPrompts: standardPrompts("Valor"),
    noticeThisWeek: "This week, notice a moment that calls for real courage, and notice what it takes to act clearly instead of freezing.",
    storyboard: [
      { scene: 1, visual: "A crowded pool, a small child slipping near the deep end.", narration: "Mei's little cousin slipped near the deep end of the pool." },
      { scene: 2, visual: "Mei shouting and pointing urgently toward the lifeguard.", narration: "She shouted for the lifeguard immediately and pointed exactly where." },
      { scene: 3, visual: "The lifeguard pulling the cousin safely from the water.", narration: "Her cousin was pulled out safely within seconds.", onScreenText: "Where have you shown valor this week?" },
    ],
  }
);

// ===========================================================================
// ADDITIONAL LOVE ELEMENTS
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "admiration-watching-her-practice",
    elementName: "Admiration",
    familyKey: "love",
    title: "Watching Her Practice",
    beginning: [
      "Sienna's older sister practiced piano every single day.",
      "Even on days she didn't feel like it, she still sat down and played.",
      "Sienna started to notice how much that mattered to her.",
      "She decided she wanted to be that dedicated about something too.",
    ],
    growing: [
      "Every afternoon, whether she felt inspired or not, Sienna's older sister sat down at the piano and worked through the same scales and pieces, sometimes for over an hour.",
      "Sienna used to think it looked boring, the same songs over and over, day after day.",
      "But watching her sister keep showing up, even on the days she clearly didn't feel like it, Sienna started to notice something she genuinely respected.",
      "She found herself wanting that same kind of steady dedication in something of her own — not because anyone told her to, but because she'd watched what it looked like up close.",
    ],
    recognitionPrompts: standardPrompts("Admiration"),
    noticeThisWeek: "This week, notice someone whose dedication you genuinely admire, and notice what about it makes you want to be more like that.",
    storyboard: [
      { scene: 1, visual: "An older sister practicing piano daily, a montage of ordinary afternoons.", narration: "Sienna's older sister practiced piano every single day." },
      { scene: 2, visual: "Sienna watching quietly from the doorway.", narration: "Sienna started to notice how much that mattered to her." },
      { scene: 3, visual: "Sienna starting her own practice of something new.", narration: "She decided she wanted to be that dedicated too.", onScreenText: "Where have you felt admiration this week?" },
    ],
  },
  {
    slug: "adoration-grandmas-kitchen",
    elementName: "Adoration",
    familyKey: "love",
    title: "Grandma's Kitchen",
    beginning: [
      "Every Sunday, Marcus went to his grandmother's house.",
      "He didn't care what they did — just being in her kitchen was enough.",
      "She'd hum while she cooked, and he'd sit and just watch her.",
      "He loved her so much it didn't need a reason.",
    ],
    growing: [
      "Every Sunday afternoon, Marcus's parents dropped him off at his grandmother's house, and it was, without question, his favorite part of the week.",
      "It didn't matter what they actually did together — most of the time it was just her cooking while he sat at the counter doing homework or nothing at all.",
      "She hummed old songs under her breath while she worked, and he never got tired of just being near that sound, in that kitchen.",
      "He couldn't have explained exactly why he loved her so much. It wasn't about anything she'd done for him that day — it just was, completely, without needing a reason.",
    ],
    recognitionPrompts: standardPrompts("Adoration"),
    noticeThisWeek: "This week, notice someone you simply adore, without needing a specific reason why.",
    storyboard: [
      { scene: 1, visual: "A cozy kitchen, a grandmother cooking, a boy at the counter.", narration: "Every Sunday, Marcus went to his grandmother's house." },
      { scene: 2, visual: "The grandmother humming while she cooks.", narration: "She'd hum while she cooked, and he'd sit and just watch her." },
      { scene: 3, visual: "Marcus smiling, completely content.", narration: "He loved her so much it didn't need a reason.", onScreenText: "Where have you felt adoration this week?" },
    ],
  },
  {
    slug: "benevolence-the-anonymous-pencil-case",
    elementName: "Benevolence",
    familyKey: "love",
    title: "The Anonymous Pencil Case",
    beginning: [
      "Ivy noticed a classmate never had the right school supplies.",
      "She bought an extra pencil case and filled it herself.",
      "She left it on his desk without saying it was from her.",
      "She never told anyone, and never needed him to know either.",
    ],
    growing: [
      "Ivy had noticed for weeks that a classmate always seemed to be borrowing pencils, missing a ruler, never quite having what everyone else had.",
      "One weekend she used some of her own savings to buy a pencil case and fill it with exactly the supplies he seemed to need.",
      "Before class on Monday, she quietly set it on his desk and walked away before he even got there.",
      "She never told him it was her, and never told anyone else either — she hadn't done it to be thanked, just because he needed it and she was able to help.",
    ],
    recognitionPrompts: standardPrompts("Benevolence"),
    noticeThisWeek: "This week, notice a chance to do something generous without needing anyone to know it was you.",
    storyboard: [
      { scene: 1, visual: "A classmate quietly borrowing supplies again.", narration: "Ivy noticed a classmate never had the right school supplies." },
      { scene: 2, visual: "Ivy filling a pencil case at home.", narration: "She bought an extra pencil case and filled it herself." },
      { scene: 3, visual: "Ivy setting it on his desk and walking away unnoticed.", narration: "She never told anyone, and never needed him to know either.", onScreenText: "Where have you shown benevolence this week?" },
    ],
  },
  {
    slug: "charity-the-coat-drive",
    elementName: "Charity",
    familyKey: "love",
    title: "The Coat Drive",
    beginning: [
      "Wyatt's family sorted old coats to give to the shelter.",
      "He found his favorite coat, one he'd outgrown but still loved.",
      "He almost kept it just to have it in his closet.",
      "Instead he added it to the pile, thinking of who might need it more.",
    ],
    growing: [
      "Every year around this time, Wyatt's family went through the closets looking for coats they'd outgrown to donate to the winter coat drive at the shelter downtown.",
      "This year, Wyatt found his favorite coat from two winters ago, too small for him now, but he still loved the color and the way it looked.",
      "Part of him wanted to just keep it folded in his closet anyway, even though he'd never wear it again.",
      "Instead he thought about a kid his size who might not have a warm coat at all this winter, and put it in the donation pile without any hesitation.",
    ],
    recognitionPrompts: standardPrompts("Charity"),
    noticeThisWeek: "This week, notice something you could give away to someone who needs it more than you do.",
    storyboard: [
      { scene: 1, visual: "A family sorting old coats into a donation pile.", narration: "Wyatt's family sorted old coats to give to the shelter." },
      { scene: 2, visual: "Wyatt holding his favorite old coat, hesitating.", narration: "He almost kept it just to have it in his closet." },
      { scene: 3, visual: "Wyatt placing it into the donation box.", narration: "Instead he added it to the pile, thinking of who might need it more.", onScreenText: "Where have you shown charity this week?" },
    ],
  },
  {
    slug: "helpfulness-too-many-books",
    elementName: "Helpfulness",
    familyKey: "love",
    title: "Too Many Books",
    beginning: [
      "Nadia saw a classmate drop half his books in the hallway.",
      "He was trying to carry way too many at once.",
      "She knelt down and helped him gather everything.",
      "Then she carried half of them to his next class with him.",
    ],
    growing: [
      "In the crowded hallway between classes, Nadia watched a classmate try to balance an enormous stack of books, folders, and a water bottle all at once — right before half of it slid to the floor.",
      "Nobody around him stopped, everyone rushing to their own next class.",
      "Nadia knelt down without a second thought and helped him gather everything back into a manageable pile.",
      "Instead of just walking off once it was picked up, she carried half the stack all the way to his next classroom, since it was on her way anyway.",
    ],
    recognitionPrompts: standardPrompts("Helpfulness"),
    noticeThisWeek: "This week, notice a small, unplanned moment you could just help without being asked.",
    storyboard: [
      { scene: 1, visual: "A hallway, books spilling out of a classmate's arms.", narration: "Nadia saw a classmate drop half his books in the hallway." },
      { scene: 2, visual: "Nadia kneeling to help gather everything.", narration: "She knelt down and helped him gather everything." },
      { scene: 3, visual: "The two of them walking together, books split between them.", narration: "She carried half of them to his next class with him.", onScreenText: "Where have you shown helpfulness this week?" },
    ],
  },
  {
    slug: "hospitality-dinner-for-the-new-neighbors",
    elementName: "Hospitality",
    familyKey: "love",
    title: "Dinner for the New Neighbors",
    beginning: [
      "A new family moved in next door, knowing no one nearby.",
      "Cole's family invited them over for dinner that first week.",
      "They didn't have to. Nobody would have thought less of them.",
      "By dessert, the new family didn't feel like strangers anymore.",
    ],
    growing: [
      "When a new family moved in next door, unpacking boxes late into the evening, they didn't know a single person in the whole neighborhood yet.",
      "Cole's family could have just waved hello from the driveway and left it at that, the way most neighbors do.",
      "Instead, before the week was even over, they invited the new family over for dinner, even though the house was a little messy and they hadn't planned much of a menu.",
      "By the time dessert came around, everyone was laughing at the table, and the new family didn't feel quite so much like strangers in an unfamiliar place anymore.",
    ],
    recognitionPrompts: standardPrompts("Hospitality"),
    noticeThisWeek: "This week, notice someone new or unfamiliar you could welcome in, even in a small way.",
    storyboard: [
      { scene: 1, visual: "A moving truck outside a new house, boxes everywhere.", narration: "A new family moved in next door, knowing no one nearby." },
      { scene: 2, visual: "Cole's family walking over to extend an invitation.", narration: "Cole's family invited them over for dinner that first week." },
      { scene: 3, visual: "Both families laughing together around a dinner table.", narration: "The new family didn't feel like strangers anymore.", onScreenText: "Where have you shown hospitality this week?" },
    ],
  },
  {
    slug: "loyalty-still-sitting-with-her",
    elementName: "Loyalty",
    familyKey: "love",
    title: "Still Sitting With Her",
    beginning: [
      "After a rumor spread, most kids stopped sitting with Priya.",
      "Fatima knew the rumor wasn't even true.",
      "She kept sitting with Priya at lunch anyway, every single day.",
      "It cost her a little popularity. She didn't care.",
    ],
    growing: [
      "After an unkind, mostly made-up rumor started going around about Priya, Fatima noticed most of the lunch table quietly stopped sitting near her within a matter of days.",
      "Fatima happened to know for a fact that most of the rumor wasn't even true — she'd actually been there for the thing it was based on.",
      "Instead of drifting away like everyone else, she kept sitting with Priya at lunch every day, the same as always.",
      "It cost her a little bit of her own popularity for a while, since some kids assumed she must be involved somehow too. She didn't care — Priya was still her friend, and that hadn't changed.",
    ],
    recognitionPrompts: standardPrompts("Loyalty"),
    noticeThisWeek: "This week, notice a friend it might be easier to quietly drift away from, and notice what it means to stay instead.",
    storyboard: [
      { scene: 1, visual: "A lunch table, most kids drifting away from one girl.", narration: "After a rumor spread, most kids stopped sitting with Priya." },
      { scene: 2, visual: "Fatima sitting down next to her anyway.", narration: "Fatima kept sitting with Priya at lunch anyway, every single day." },
      { scene: 3, visual: "The two of them talking and laughing, unbothered by the empty seats around them.", narration: "It cost her a little popularity. She didn't care.", onScreenText: "Where have you shown loyalty this week?" },
    ],
  },
  {
    slug: "thoughtfulness-the-snack-she-remembered",
    elementName: "Thoughtfulness",
    familyKey: "love",
    title: "The Snack She Remembered",
    beginning: [
      "Weeks ago, Anya mentioned loving a specific kind of fruit snack.",
      "Elena remembered, even though it was a tiny detail.",
      "On a day Anya seemed down, Elena brought her exactly that snack.",
      "Anya couldn't believe she'd actually remembered something so small.",
    ],
    growing: [
      "Weeks earlier, in an entirely unrelated conversation, Anya had mentioned offhand that a specific brand of fruit snack was her favorite thing in the world.",
      "Elena hadn't thought much of it at the time, but the detail had stuck somewhere in the back of her mind.",
      "When Anya showed up to school clearly having a hard day, Elena reached into her bag and handed her exactly that snack, the one from weeks ago.",
      "Anya just stared at it for a second, genuinely surprised that anyone had actually remembered something that small — and it ended up being exactly what she needed that day.",
    ],
    recognitionPrompts: standardPrompts("Thoughtfulness"),
    noticeThisWeek: "This week, notice a small detail someone mentioned in passing, and see if you can remember it for them later.",
    storyboard: [
      { scene: 1, visual: "A casual conversation, one kid mentioning a favorite snack.", narration: "Weeks ago, Anya mentioned loving a specific kind of fruit snack." },
      { scene: 2, visual: "Elena noticing Anya looks down, then reaching into her bag.", narration: "On a day Anya seemed down, Elena brought her exactly that snack." },
      { scene: 3, visual: "Anya's surprised, grateful smile.", narration: "Anya couldn't believe she'd actually remembered something so small.", onScreenText: "Where have you shown thoughtfulness this week?" },
    ],
  },
  {
    slug: "yearning-the-letters-to-chicago",
    elementName: "Yearning",
    familyKey: "love",
    title: "The Letters to Chicago",
    beginning: [
      "Tariq's best friend moved far away over the summer.",
      "He missed him more than he expected to.",
      "Instead of just feeling sad about it, he started writing letters.",
      "Every letter was a way of holding onto something he missed.",
    ],
    growing: [
      "When Tariq's best friend moved to Chicago over the summer, the first few weeks of school without him felt strange in a way Tariq hadn't expected.",
      "He found himself missing ordinary things — the walk home, a specific joke, just having someone who already understood him without explaining.",
      "Instead of letting that feeling just sit there, he started writing his friend actual letters, describing everything happening at school as if he were still around to hear it.",
      "Each letter was its own small way of staying connected to someone he missed — the longing itself became something he could actually do something with.",
    ],
    recognitionPrompts: standardPrompts("Yearning"),
    noticeThisWeek: "This week, notice someone or something you miss, and notice what it feels like to really let yourself feel that.",
    storyboard: [
      { scene: 1, visual: "A moving truck pulling away, two friends waving goodbye.", narration: "Tariq's best friend moved far away over the summer." },
      { scene: 2, visual: "Tariq sitting alone at the old meeting spot, missing him.", narration: "He missed him more than he expected to." },
      { scene: 3, visual: "Tariq writing a letter at his desk, mailing it.", narration: "Every letter was a way of holding onto something he missed.", onScreenText: "Where have you felt yearning this week?" },
    ],
  }
);

// ===========================================================================
// ADDITIONAL POSITIVE ATTITUDE ELEMENTS
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "adaptability-plan-b",
    elementName: "Adaptability",
    familyKey: "positive-attitude",
    title: "Plan B",
    beginning: [
      "Rain ruined Felix's plan for an outdoor birthday party.",
      "For a second he felt like the whole day was wrecked.",
      "Then he came up with an indoor scavenger hunt instead.",
      "It turned out to be more fun than the original plan.",
    ],
    growing: [
      "Felix had been planning an outdoor birthday party for weeks — games, a piñata, the whole backyard set up exactly how he wanted it.",
      "The morning of the party, it started pouring rain and showed no sign of stopping, and for a minute Felix felt like the whole day was ruined.",
      "Instead of staying upset about it, he grabbed his mom and quickly came up with an indoor scavenger hunt through the house instead, hiding clues in every room.",
      "By the end of the party, everyone agreed the scavenger hunt had actually been more fun than the original outdoor plan would have been.",
    ],
    recognitionPrompts: standardPrompts("Adaptability"),
    noticeThisWeek: "This week, notice a plan that doesn't go the way you expected, and notice what it's like to adjust instead of staying stuck.",
    storyboard: [
      { scene: 1, visual: "Rain pouring down on an outdoor party setup.", narration: "Rain ruined Felix's plan for an outdoor birthday party." },
      { scene: 2, visual: "Felix's disappointed face turning thoughtful.", narration: "For a second he felt like the whole day was wrecked." },
      { scene: 3, visual: "Kids running through the house on an indoor scavenger hunt, laughing.", narration: "It turned out to be more fun than the original plan.", onScreenText: "Where have you shown adaptability this week?" },
    ],
  },
  {
    slug: "beauty-the-frost-on-the-window",
    elementName: "Beauty",
    familyKey: "positive-attitude",
    title: "The Frost on the Window",
    beginning: [
      "On a freezing morning, ice patterns covered the window.",
      "Most people just complained about the cold.",
      "Dara stopped and really looked at the delicate patterns.",
      "She noticed something beautiful in a thing everyone else ignored.",
    ],
    growing: [
      "On one of the coldest mornings of the winter, thick frost had spread across the inside of the kitchen window overnight, in delicate branching patterns.",
      "Everyone else in the house just grumbled about how cold it was and hurried past to get breakfast started.",
      "Dara stopped for a moment and actually looked closely at the patterns, tracing one with her finger before it melted under her touch.",
      "She found herself noticing real beauty in something everyone else had walked straight past without a second glance.",
    ],
    recognitionPrompts: standardPrompts("Beauty"),
    noticeThisWeek: "This week, notice something ordinary or overlooked that's actually beautiful if you really look at it.",
    storyboard: [
      { scene: 1, visual: "A window covered in intricate frost patterns.", narration: "On a freezing morning, ice patterns covered the window." },
      { scene: 2, visual: "Family members hurrying past, complaining about the cold.", narration: "Most people just complained about the cold." },
      { scene: 3, visual: "Dara pausing, tracing a frost pattern with her finger.", narration: "She noticed something beautiful in a thing everyone else ignored.", onScreenText: "Where have you noticed beauty this week?" },
    ],
  },
  {
    slug: "reverence-the-old-oak-tree",
    elementName: "Reverence",
    familyKey: "positive-attitude",
    title: "The Old Oak Tree",
    beginning: [
      "Owen's grandfather showed him a tree over 300 years old.",
      "Standing under it, Owen suddenly felt very quiet.",
      "It had been there long before anyone in his family was born.",
      "He felt a kind of respect he didn't quite have words for.",
    ],
    growing: [
      "On a walk through the old part of the park, Owen's grandfather stopped in front of an enormous oak tree and told him it was over three hundred years old.",
      "Standing underneath its huge, spreading branches, Owen suddenly found himself talking in a quieter voice, almost without deciding to.",
      "He thought about everything that tree had already lived through, long before his grandfather, or his grandfather's grandfather, had even been born.",
      "He didn't have the exact words for what he felt standing there, but it was a kind of deep respect — for the tree, and for how small his own small slice of time actually was next to it.",
    ],
    recognitionPrompts: standardPrompts("Reverence"),
    noticeThisWeek: "This week, notice something that makes you feel a quiet sense of respect for how old, vast, or enduring it is.",
    storyboard: [
      { scene: 1, visual: "A grandfather and grandson standing beneath a massive old oak tree.", narration: "Owen's grandfather showed him a tree over 300 years old." },
      { scene: 2, visual: "Owen looking up in quiet awe.", narration: "Standing under it, Owen suddenly felt very quiet." },
      { scene: 3, visual: "The two of them sitting beneath it together, saying little.", narration: "He felt a kind of respect he didn't quite have words for.", onScreenText: "Where have you felt reverence this week?" },
    ],
  },
  {
    slug: "serenity-the-quiet-corner",
    elementName: "Serenity",
    familyKey: "positive-attitude",
    title: "The Quiet Corner",
    beginning: [
      "The house was loud with siblings, TV, and noise all evening.",
      "Kaia found a small corner by the fish tank instead.",
      "Just watching the fish swim slowly calmed her right down.",
      "She didn't need anything to change. She just needed that corner.",
    ],
    growing: [
      "Most evenings at Kaia's house were loud — the TV blaring, her younger siblings arguing over something, everyone talking over each other at once.",
      "Instead of getting swept up in the noise, Kaia had found a small spot by the fish tank in the hallway where she could sit and just be still for a few minutes.",
      "Watching the fish drift slowly back and forth, with no particular hurry to be anywhere, had a way of calming her down almost immediately.",
      "Nothing about the loud house actually changed while she sat there — she'd just found her own small, quiet corner inside of it.",
    ],
    recognitionPrompts: standardPrompts("Serenity"),
    noticeThisWeek: "This week, notice a small quiet space or moment you could return to when things around you feel loud.",
    storyboard: [
      { scene: 1, visual: "A loud, chaotic living room full of noise and siblings.", narration: "The house was loud with siblings, TV, and noise all evening." },
      { scene: 2, visual: "Kaia sitting quietly by a fish tank in the hallway.", narration: "Kaia found a small corner by the fish tank instead." },
      { scene: 3, visual: "Kaia's calm, peaceful expression watching the fish.", narration: "She didn't need anything to change. She just needed that corner.", onScreenText: "Where have you found serenity this week?" },
    ],
  },
  {
    slug: "zeal-starting-before-the-bell-rang",
    elementName: "Zeal",
    familyKey: "positive-attitude",
    title: "Starting Before the Bell Rang",
    beginning: [
      "Samuel got an idea for his science project during class.",
      "He could barely wait for school to end.",
      "The second he got home, he started building it immediately.",
      "His excitement carried him through the whole afternoon.",
    ],
    growing: [
      "Halfway through science class, an idea for his project suddenly clicked into place in Samuel's head, and he could hardly focus on anything else for the rest of the day.",
      "He kept sketching bits of the design in the margin of his notebook, counting down the minutes until the final bell.",
      "The moment he got home, he dropped his backpack and went straight to the garage to start building, not even stopping for a snack first.",
      "His own excitement about the idea carried him through hours of work that afternoon, without needing anyone to push him to keep going.",
    ],
    recognitionPrompts: standardPrompts("Zeal"),
    noticeThisWeek: "This week, notice an idea that genuinely excites you enough to want to start on it right away.",
    storyboard: [
      { scene: 1, visual: "A classroom, Samuel's eyes lighting up mid-lesson.", narration: "Samuel got an idea for his science project during class." },
      { scene: 2, visual: "Samuel watching the clock, eager for the day to end.", narration: "He could barely wait for school to end." },
      { scene: 3, visual: "Samuel building enthusiastically in the garage.", narration: "His excitement carried him through the whole afternoon.", onScreenText: "Where have you felt zeal this week?" },
    ],
  }
);

// ===========================================================================
// ADDITIONAL HARD WORK ELEMENTS
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "community-the-saturday-cleanup",
    elementName: "Community",
    familyKey: "hard-work",
    title: "The Saturday Cleanup",
    beginning: [
      "The neighborhood park had gotten covered in litter.",
      "One neighbor put up a sign: Saturday cleanup, 9am.",
      "Bailey almost skipped it to sleep in instead.",
      "She showed up anyway, and so did a dozen other neighbors.",
    ],
    growing: [
      "Over a few months, the little park at the end of the block had slowly filled up with litter that nobody in particular seemed responsible for.",
      "One neighbor finally put up a handwritten sign at the entrance: Saturday morning cleanup, 9am, bring gloves if you have them.",
      "Bailey almost talked herself out of going, since sleeping in on a Saturday sounded a lot more appealing.",
      "She went anyway, and was surprised to find a dozen neighbors already there, working together to make the park usable again for everyone who shared it.",
    ],
    recognitionPrompts: standardPrompts("Community"),
    noticeThisWeek: "This week, notice a chance to show up for something shared with your neighborhood or community, even a small one.",
    storyboard: [
      { scene: 1, visual: "A neighborhood park covered in scattered litter.", narration: "The neighborhood park had gotten covered in litter." },
      { scene: 2, visual: "A handwritten sign announcing a Saturday cleanup.", narration: "One neighbor put up a sign: Saturday cleanup, 9am." },
      { scene: 3, visual: "A dozen neighbors working together, the park looking clean again.", narration: "She showed up anyway, and so did a dozen other neighbors.", onScreenText: "Where have you shown up for community this week?" },
    ],
  },
  {
    slug: "endurance-the-last-mile",
    elementName: "Endurance",
    familyKey: "hard-work",
    title: "The Last Mile",
    beginning: [
      "Miguel's legs felt done by the last mile of the race.",
      "Everything in him wanted to stop and walk.",
      "He kept his legs moving anyway, one step at a time.",
      "He crossed the finish line, tired but still running.",
    ],
    growing: [
      "By the last mile of the school fun run, Miguel's legs felt like they were made of lead, and his breathing had gone ragged a while ago.",
      "Every part of him wanted to just slow to a walk — nobody would have blamed him, plenty of other runners already had.",
      "Instead, he focused on just keeping his legs moving, one small step after another, without thinking about the whole mile still ahead.",
      "When he finally crossed the finish line, he wasn't fast and he wasn't first, but he had run the entire way, all the way to the end.",
    ],
    recognitionPrompts: standardPrompts("Endurance"),
    noticeThisWeek: "This week, notice something difficult you kept going through instead of stopping partway.",
    storyboard: [
      { scene: 1, visual: "A tired runner in the last mile of a race, legs heavy.", narration: "Miguel's legs felt done by the last mile of the race." },
      { scene: 2, visual: "Other runners slowing to a walk around him.", narration: "Everything in him wanted to stop and walk." },
      { scene: 3, visual: "Miguel crossing the finish line, exhausted but upright.", narration: "He crossed the finish line, tired but still running.", onScreenText: "Where have you shown endurance this week?" },
    ],
  },
  {
    slug: "passion-chess-at-recess",
    elementName: "Passion",
    familyKey: "hard-work",
    title: "Chess at Recess",
    beginning: [
      "Most kids spent recess on the playground or with a ball.",
      "Noor spent every recess playing chess instead.",
      "She read chess books at home just for fun.",
      "Nobody made her care this much about it. She just did.",
    ],
    growing: [
      "While most of the school spent recess running around the playground or playing whatever ball game was popular that week, Noor headed straight for the chess table by the library every single day.",
      "At home, instead of watching a show before bed, she'd often read through chess books, studying openings and endgames just because she found them genuinely fascinating.",
      "Nobody had ever pushed her into caring this much about a board game — no parent signing her up for lessons, no team requiring practice.",
      "It was entirely her own passion, the kind that made hours disappear without her noticing, simply because she loved it.",
    ],
    recognitionPrompts: standardPrompts("Passion"),
    noticeThisWeek: "This week, notice something you genuinely love doing for its own sake, without anyone requiring it of you.",
    storyboard: [
      { scene: 1, visual: "A busy playground, most kids playing ball games.", narration: "Most kids spent recess on the playground or with a ball." },
      { scene: 2, visual: "Noor deeply focused over a chessboard at a quiet table.", narration: "Noor spent every recess playing chess instead." },
      { scene: 3, visual: "Noor reading a chess book at home, completely absorbed.", narration: "Nobody made her care this much about it. She just did.", onScreenText: "Where have you felt passion this week?" },
    ],
  },
  {
    slug: "persistence-learning-to-ride",
    elementName: "Persistence",
    familyKey: "hard-work",
    title: "Learning to Ride",
    beginning: [
      "Ezekiel fell off his bike more times than he could count.",
      "Every single time, he picked the bike back up.",
      "Week after week, he kept practicing in the driveway.",
      "One ordinary afternoon, he just didn't fall anymore.",
    ],
    growing: [
      "Learning to ride his bike without training wheels, Ezekiel fell more times over the course of a month than he could bother counting anymore.",
      "Every single time, scraped knee or not, he picked the bike back up off the ground and climbed on again.",
      "Week after week, he kept practicing in the driveway after school, even on days he was frustrated enough to want to quit entirely.",
      "Then, on an afternoon that started out no different from any other, he simply rode all the way down the driveway and back without falling once — the month of trying had finally added up to something.",
    ],
    recognitionPrompts: standardPrompts("Persistence"),
    noticeThisWeek: "This week, notice something you're still working toward over weeks, not just one try.",
    storyboard: [
      { scene: 1, visual: "A kid falling off a bike in a driveway, over and over across a montage.", narration: "Ezekiel fell off his bike more times than he could count." },
      { scene: 2, visual: "Ezekiel picking the bike back up each time, undeterred.", narration: "Every single time, he picked the bike back up." },
      { scene: 3, visual: "Ezekiel riding smoothly down the driveway, delighted.", narration: "One ordinary afternoon, he just didn't fall anymore.", onScreenText: "Where have you shown persistence this week?" },
    ],
  },
  {
    slug: "tenacity-not-backing-down-about-the-group",
    elementName: "Tenacity",
    familyKey: "hard-work",
    title: "Not Backing Down About the Group",
    beginning: [
      "Ruby's group wanted to leave out a quiet classmate.",
      "She kept insisting they include him anyway.",
      "The group pushed back on her more than once.",
      "She held her ground until they finally agreed.",
    ],
    growing: [
      "When Ruby's project group was picking teammates, a few kids made it clear they wanted to skip over a quiet classmate nobody really knew well.",
      "Ruby insisted from the start that they include him, since he was just as capable as anyone else, only quieter about it.",
      "The rest of the group pushed back more than once, suggesting other names, hoping she'd just drop it.",
      "She didn't drop it, bringing it up again each time, until the group finally agreed to include him — and he ended up doing some of the best work in the whole project.",
    ],
    recognitionPrompts: standardPrompts("Tenacity"),
    noticeThisWeek: "This week, notice something you believe in enough to keep holding onto, even when others push back.",
    storyboard: [
      { scene: 1, visual: "A group of kids picking teammates, one quiet classmate left out.", narration: "Ruby's group wanted to leave out a quiet classmate." },
      { scene: 2, visual: "Ruby arguing her point firmly, the group pushing back.", narration: "The group pushed back on her more than once." },
      { scene: 3, visual: "The quiet classmate now included, contributing confidently.", narration: "She held her ground until they finally agreed.", onScreenText: "Where have you shown tenacity this week?" },
    ],
  },
  {
    slug: "thrift-fixing-it-instead-of-replacing-it",
    elementName: "Thrift",
    familyKey: "hard-work",
    title: "Fixing It Instead of Replacing It",
    beginning: [
      "Amir's backpack got a small tear near the zipper.",
      "He could have just asked for a brand-new one.",
      "Instead he asked his mom to help him sew it up.",
      "The old backpack lasted him the whole rest of the year.",
    ],
    growing: [
      "A few weeks into the school year, Amir noticed a small tear starting near the main zipper of his backpack, right where it always caught on the doorframe.",
      "It would have been easy enough to ask for a brand-new one — plenty of his friends replaced their backpacks over far less.",
      "Instead, he asked his mom to show him how to sew the tear up himself, sitting at the kitchen table with a needle and thread for the first time.",
      "The repaired backpack ended up lasting him the whole rest of the year, and he felt a small, real pride every time he used it.",
    ],
    recognitionPrompts: standardPrompts("Thrift"),
    noticeThisWeek: "This week, notice something you could fix or make last a little longer instead of replacing it right away.",
    storyboard: [
      { scene: 1, visual: "A backpack with a small tear near the zipper.", narration: "Amir's backpack got a small tear near the zipper." },
      { scene: 2, visual: "Amir and his mom sewing the tear at the kitchen table.", narration: "He asked his mom to help him sew it up." },
      { scene: 3, visual: "Amir wearing the repaired backpack to school, proud.", narration: "The old backpack lasted him the whole rest of the year.", onScreenText: "Where have you shown thrift this week?" },
    ],
  },
  {
    slug: "time-making-the-saturday-count",
    elementName: "Time",
    familyKey: "hard-work",
    title: "Making the Saturday Count",
    beginning: [
      "Harper had chores, homework, and a whole free Saturday.",
      "She could have wasted the morning and scrambled later.",
      "Instead she planned out when each thing would happen.",
      "By evening, everything was done, and she'd still had fun too.",
    ],
    growing: [
      "Harper woke up on Saturday with a list of chores, a math worksheet due Monday, and an entire day otherwise free to do whatever she wanted.",
      "In past weekends, she'd usually wasted the whole morning and ended up scrambling to finish everything right before bed, stressed and rushed.",
      "This time, she sat down for a few minutes first and roughly planned out when she'd do chores, when she'd do homework, and when she'd actually have time to relax.",
      "By that evening, everything on her list was actually finished, and she'd still had plenty of real time to enjoy the day — because she'd respected how much time each thing would actually take.",
    ],
    recognitionPrompts: standardPrompts("Time"),
    noticeThisWeek: "This week, notice a day you could plan out ahead of time instead of letting it just happen to you.",
    storyboard: [
      { scene: 1, visual: "Harper looking at a to-do list and a whole free Saturday ahead.", narration: "Harper had chores, homework, and a whole free Saturday." },
      { scene: 2, visual: "Harper writing out a simple plan for her day.", narration: "She planned out when each thing would happen." },
      { scene: 3, visual: "Harper relaxing happily in the evening, everything finished.", narration: "Everything was done, and she'd still had fun too.", onScreenText: "Where have you made good use of your time this week?" },
    ],
  }
);

// ===========================================================================
// ADDITIONAL SELF-CONTROL ELEMENTS
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "long-suffering-every-time-he-borrows-it",
    elementName: "Long-suffering",
    familyKey: "self-control",
    title: "Every Time He Borrows It",
    beginning: [
      "Delilah's little brother kept borrowing her stuff and breaking it.",
      "It had happened more times than she wanted to count.",
      "She felt frustrated, but she didn't explode at him again.",
      "She talked to him calmly, the same patient way, one more time.",
    ],
    growing: [
      "Delilah's little brother had a habit of borrowing her things without asking, and somehow, more often than not, something ended up broken or lost afterward.",
      "This had happened enough times now that she genuinely couldn't remember the exact count anymore.",
      "She felt the same flash of frustration she always did, and for a second wanted to yell the way she sometimes had before.",
      "Instead, she took a breath and talked to him calmly again, the same patient way she had the last several times, even though her patience had been tested plenty already.",
    ],
    recognitionPrompts: standardPrompts("Long-suffering"),
    noticeThisWeek: "This week, notice a repeated frustration where staying patient, again, is harder than it sounds.",
    storyboard: [
      { scene: 1, visual: "A little brother holding a broken toy, looking sheepish.", narration: "Delilah's little brother kept borrowing her stuff and breaking it." },
      { scene: 2, visual: "Delilah's frustrated expression, catching herself before reacting.", narration: "She felt frustrated, but she didn't explode at him again." },
      { scene: 3, visual: "Delilah talking calmly with her brother, patient despite everything.", narration: "She talked to him calmly, the same patient way, one more time.", onScreenText: "Where have you shown long-suffering patience this week?" },
    ],
  },
  {
    slug: "mercy-not-telling-on-her",
    elementName: "Mercy",
    familyKey: "self-control",
    title: "Not Telling on Her",
    beginning: [
      "Genevieve's friend accidentally broke her favorite necklace.",
      "She easily could have gotten her friend in real trouble.",
      "Instead she just said it was okay and let it go.",
      "Her friend never even had to feel that guilty about it.",
    ],
    growing: [
      "While messing around at Genevieve's house, her friend accidentally snapped the clasp on a necklace that had actually meant a lot to her.",
      "Genevieve could have made a big deal out of it, told her parents exactly what happened, and let her friend feel the full weight of it.",
      "Instead, seeing how upset her friend already looked, she just said it was okay, that it could probably be fixed, and let the whole thing go.",
      "Her friend never had to carry around the guilt of a bigger conversation about it — Genevieve had quietly chosen not to make her pay for an honest accident.",
    ],
    recognitionPrompts: standardPrompts("Mercy"),
    noticeThisWeek: "This week, notice a moment you could let something go instead of making someone pay for a mistake.",
    storyboard: [
      { scene: 1, visual: "A necklace's clasp breaking accidentally, a friend looking horrified.", narration: "Genevieve's friend accidentally broke her favorite necklace." },
      { scene: 2, visual: "Genevieve pausing, deciding not to make a big deal of it.", narration: "She easily could have gotten her friend in real trouble." },
      { scene: 3, visual: "Genevieve reassuring her friend warmly.", narration: "Her friend never even had to feel that guilty about it.", onScreenText: "Where have you shown mercy this week?" },
    ],
  },
  {
    slug: "obedience-when-the-whistle-blew",
    elementName: "Obedience",
    familyKey: "self-control",
    title: "When the Whistle Blew",
    beginning: [
      "Julian wanted to swim further out past the roped-off area.",
      "The lifeguard blew a whistle and waved him back in.",
      "He didn't love it, but he turned around right away.",
      "Later, he learned there'd been a strong current out there.",
    ],
    growing: [
      "At the lake that afternoon, Julian really wanted to swim out past the roped-off swimming area, where the water looked calm and inviting.",
      "The moment he crossed the rope, the lifeguard blew a sharp whistle and waved him back toward shore.",
      "Julian didn't love being called back in front of everyone, but he turned around immediately anyway, trusting that the rule was there for a reason even if he couldn't see it.",
      "Later that day, he overheard the lifeguard mention a strong undertow out past that exact spot — the rule he'd grumbled about had actually kept him safe.",
    ],
    recognitionPrompts: standardPrompts("Obedience"),
    noticeThisWeek: "This week, notice a rule you followed even though you didn't love it in the moment, and think about why it might exist.",
    storyboard: [
      { scene: 1, visual: "A kid swimming toward a roped-off boundary at a lake.", narration: "Julian wanted to swim further out past the roped-off area." },
      { scene: 2, visual: "A lifeguard blowing a whistle, waving him back.", narration: "The lifeguard blew a whistle and waved him back in." },
      { scene: 3, visual: "Julian back on shore, later realizing why the rule mattered.", narration: "Later, he learned there'd been a strong current out there.", onScreenText: "Where have you shown obedience this week?" },
    ],
  },
  {
    slug: "purity-helping-for-no-reason-at-all",
    elementName: "Purity",
    familyKey: "self-control",
    title: "Helping for No Reason At All",
    beginning: [
      "Beatrice could have helped her neighbor for a reward.",
      "Instead she almost didn't mention she'd helped at all.",
      "She raked the leaves simply because it needed doing.",
      "She wanted nothing back from it, and meant that completely.",
    ],
    growing: [
      "Beatrice noticed her elderly neighbor's yard was completely covered in fallen leaves, and knew he sometimes paid neighborhood kids a few dollars for yard work.",
      "She caught herself thinking about mentioning it to him first, so he'd know to pay her — then stopped and decided against it.",
      "She raked his whole yard simply because it needed doing and she was able to do it, without saying anything about it to him at all.",
      "When he found out later and tried to pay her anyway, she genuinely didn't want anything for it — she'd done it clean, without any reward attached from the start.",
    ],
    recognitionPrompts: standardPrompts("Purity"),
    noticeThisWeek: "This week, notice a moment you could help with a completely clean intention, wanting nothing back at all.",
    storyboard: [
      { scene: 1, visual: "A yard covered in fallen leaves next door.", narration: "Beatrice could have helped her neighbor for a reward." },
      { scene: 2, visual: "Beatrice raking quietly, telling no one.", narration: "She raked the leaves simply because it needed doing." },
      { scene: 3, visual: "The neighbor trying to pay her, Beatrice declining warmly.", narration: "She wanted nothing back from it, and meant that completely.", onScreenText: "Where have you shown this kind of purity this week?" },
    ],
  },
  {
    slug: "temperance-just-one-slice",
    elementName: "Temperance",
    familyKey: "self-control",
    title: "Just One Slice",
    beginning: [
      "The holiday dessert table had every kind of treat imaginable.",
      "Xavier could have piled his plate as high as he wanted.",
      "He took one slice of pie and one cookie instead.",
      "He still enjoyed every single bite, without feeling sick after.",
    ],
    growing: [
      "At the big family holiday gathering, the dessert table stretched the whole length of the counter, covered in pies, cookies, and cakes of every kind.",
      "Xavier could easily have piled his plate as high as it would go, the way a couple of his cousins did.",
      "Instead, he took one slice of the pie he actually loved most and one cookie, and left it at that.",
      "He genuinely enjoyed every bite of what he chose, without the uncomfortable, overstuffed feeling some of his cousins ended up complaining about later.",
    ],
    recognitionPrompts: standardPrompts("Temperance"),
    noticeThisWeek: "This week, notice a moment you could enjoy something in a moderate amount instead of overdoing it.",
    storyboard: [
      { scene: 1, visual: "An enormous dessert table piled with every kind of treat.", narration: "The holiday dessert table had every kind of treat imaginable." },
      { scene: 2, visual: "Cousins piling their plates high with sweets.", narration: "Xavier could have piled his plate as high as he wanted." },
      { scene: 3, visual: "Xavier happily enjoying his one slice of pie and cookie.", narration: "He still enjoyed every single bite, without feeling sick after.", onScreenText: "Where have you shown temperance this week?" },
    ],
  }
);

// ===========================================================================
// ADDITIONAL INTEGRITY ELEMENTS
// ===========================================================================
STORY_LIBRARY.push(
  {
    slug: "ethical-the-loophole-he-didnt-use",
    elementName: "Ethical",
    familyKey: "integrity",
    title: "The Loophole He Didn't Use",
    beginning: [
      "Theodore found a way to win the game that broke no rules.",
      "It technically wasn't cheating, but it didn't feel right either.",
      "He decided not to use it, even though he could have.",
      "He won or lost fairly instead, and felt better about it.",
    ],
    growing: [
      "While setting up for the class tournament, Theodore noticed a loophole in the game's rules that would let him win almost automatically, without technically breaking anything written down.",
      "He sat with the idea for a minute, and the more he thought about it, the more it felt like exactly the kind of thing that was allowed but still wrong.",
      "He decided not to use it, even though nobody would have caught him and nothing in the rulebook actually forbade it.",
      "He played the game the honest way instead, win or lose, and felt a lot better walking away from it than he would have with a hollow win.",
    ],
    recognitionPrompts: standardPrompts("Ethical"),
    noticeThisWeek: "This week, notice a technically-allowed shortcut you could choose not to take because it doesn't feel right.",
    storyboard: [
      { scene: 1, visual: "Theodore noticing a loophole in a game's rules.", narration: "Theodore found a way to win the game that broke no rules." },
      { scene: 2, visual: "Theodore thinking it over, uneasy despite it being 'allowed.'", narration: "It technically wasn't cheating, but it didn't feel right either." },
      { scene: 3, visual: "Theodore playing it straight, shaking hands after a fair game.", narration: "He won or lost fairly instead, and felt better about it.", onScreenText: "Where has being ethical mattered this week?" },
    ],
  },
  {
    slug: "individuality-not-matching-everyone-else",
    elementName: "Individuality",
    familyKey: "integrity",
    title: "Not Matching Everyone Else",
    beginning: [
      "Everyone at school seemed to dress and act the same way lately.",
      "Penelope liked things that weren't really part of that trend.",
      "She kept wearing and liking what she actually liked anyway.",
      "Eventually, being herself just felt normal to her again.",
    ],
    growing: [
      "For a while, it seemed like almost everyone at school had settled into the exact same style, the exact same shows, the exact same way of talking.",
      "Penelope genuinely liked different things — an older style of music, clothes nobody else really wore, hobbies that didn't quite fit the trend.",
      "For a bit she felt a little self-conscious about it, but she kept wearing and liking what she actually liked instead of switching to match everyone else.",
      "Over time, being herself stopped feeling like something to explain or defend — it just felt like the most natural, comfortable way to be.",
    ],
    recognitionPrompts: standardPrompts("Individuality"),
    noticeThisWeek: "This week, notice something genuinely yours that's different from what everyone around you is doing.",
    storyboard: [
      { scene: 1, visual: "A hallway of students dressed and acting almost identically.", narration: "Everyone at school seemed to dress and act the same way lately." },
      { scene: 2, visual: "Penelope wearing her own distinct style, standing out slightly.", narration: "Penelope liked things that weren't really part of that trend." },
      { scene: 3, visual: "Penelope confident and at ease, fully herself.", narration: "Eventually, being herself just felt normal to her again.", onScreenText: "Where have you shown your own individuality this week?" },
    ],
  },
  {
    slug: "innocence-what-the-kindergartner-said",
    elementName: "Innocence",
    familyKey: "integrity",
    title: "What the Kindergartner Said",
    beginning: [
      "A little kindergartner asked a teacher a totally honest question.",
      "The adults nearby went quiet, a little embarrassed.",
      "The kid had no hidden reason for asking. He just wondered.",
      "His simple honesty ended up teaching the adults something.",
    ],
    growing: [
      "During a school assembly, a kindergartner named Milo raised his hand and asked the visiting speaker a completely blunt, completely honest question that nobody else in the room would have dared to ask out loud.",
      "A few of the adults nearby went a little quiet, slightly embarrassed on the speaker's behalf.",
      "Milo hadn't asked it to embarrass anyone or make a point — he genuinely just wondered, the way small kids wonder about things without any filter yet.",
      "The speaker actually laughed, answered honestly, and later told a teacher that the simple, unguarded question had been the most useful one all day.",
    ],
    recognitionPrompts: standardPrompts("Innocence"),
    noticeThisWeek: "This week, notice a moment of simple, unguarded honesty — yours or someone else's — that cuts straight through.",
    storyboard: [
      { scene: 1, visual: "A kindergartner raising his hand during an assembly.", narration: "A little kindergartner asked a teacher a totally honest question." },
      { scene: 2, visual: "Nearby adults exchanging slightly embarrassed glances.", narration: "The adults nearby went quiet, a little embarrassed." },
      { scene: 3, visual: "The speaker laughing warmly, answering the question honestly.", narration: "His simple honesty ended up teaching the adults something.", onScreenText: "Where have you seen this kind of innocence this week?" },
    ],
  },
  {
    slug: "morality-the-twenty-dollars-on-the-sidewalk",
    elementName: "Morality",
    familyKey: "integrity",
    title: "The Twenty Dollars on the Sidewalk",
    beginning: [
      "Isaiah found a twenty-dollar bill on an empty sidewalk.",
      "No one was around. No one would have ever known.",
      "He still turned it in at the corner store nearby instead.",
      "It took real thought to decide that was the right thing.",
    ],
    growing: [
      "Walking home from school, Isaiah spotted a twenty-dollar bill lying on an otherwise empty stretch of sidewalk.",
      "He looked around, and there was genuinely no one nearby — no one would have ever known if he'd simply pocketed it and kept walking.",
      "He actually thought about it for a minute, turning the decision over, before deciding to bring it into the corner store and ask if anyone had reported losing money.",
      "It wasn't an easy or obvious choice in the moment — twenty dollars is real money — but he decided that doing the right thing mattered more than what he could get away with.",
    ],
    recognitionPrompts: standardPrompts("Morality"),
    noticeThisWeek: "This week, notice a real decision between what's easy and what's right, especially when no one would ever know the difference.",
    storyboard: [
      { scene: 1, visual: "A twenty-dollar bill lying on an empty sidewalk.", narration: "Isaiah found a twenty-dollar bill on an empty sidewalk." },
      { scene: 2, visual: "Isaiah looking around, genuinely alone, thinking hard.", narration: "No one was around. No one would have ever known." },
      { scene: 3, visual: "Isaiah handing the bill to a store clerk.", narration: "He still turned it in at the corner store nearby instead.", onScreenText: "Where has your own sense of right and wrong mattered this week?" },
    ],
  },
  {
    slug: "nobility-helping-him-save-face",
    elementName: "Nobility",
    familyKey: "integrity",
    title: "Helping Him Save Face",
    beginning: [
      "A classmate got an easy answer embarrassingly wrong out loud.",
      "Some kids started to laugh at him.",
      "Adaeze quickly asked a question that changed the subject.",
      "Nobody even remembered the wrong answer by the end of class.",
    ],
    growing: [
      "When the teacher called on him, a classmate confidently gave an answer that was completely, obviously wrong, and a couple of kids nearby started snickering.",
      "His face went red, and for a second it looked like the whole class might pile on.",
      "Adaeze, sitting nearby, quickly raised her hand and asked an unrelated question about the lesson, smoothly pulling everyone's attention away from him.",
      "By the end of class, the moment had been completely forgotten — nobody even remembered the wrong answer, because Adaeze had quietly given him room to recover.",
    ],
    recognitionPrompts: standardPrompts("Nobility"),
    noticeThisWeek: "This week, notice a moment you could help someone save face instead of letting them stay embarrassed.",
    storyboard: [
      { scene: 1, visual: "A classmate answering incorrectly, a few kids starting to laugh.", narration: "A classmate got an easy answer embarrassingly wrong out loud." },
      { scene: 2, visual: "Adaeze raising her hand, redirecting attention smoothly.", narration: "Adaeze quickly asked a question that changed the subject." },
      { scene: 3, visual: "The class moving on, the classmate visibly relieved.", narration: "Nobody even remembered the wrong answer by the end of class.", onScreenText: "Where have you shown nobility this week?" },
    ],
  },
  {
    slug: "principles-his-one-rule",
    elementName: "Principles",
    familyKey: "integrity",
    title: "His One Rule",
    beginning: [
      "Damian had one personal rule: never leave a teammate out.",
      "During a game, it would have been easier to ignore it.",
      "He stuck to his rule anyway, even when it cost his team a bit.",
      "He never once regretted holding onto that one rule.",
    ],
    growing: [
      "For as long as he could remember playing team sports, Damian had one personal rule he never broke: never leave a teammate out of the play just because they weren't the strongest player.",
      "During a close game, it would have been easier and probably more effective to just stop passing to a struggling teammate and carry the team himself.",
      "He stuck to his rule anyway, kept including that teammate in the plays, even though it may have cost his team a little bit of an edge that game.",
      "Looking back on it afterward, he never once regretted holding onto that one rule, no matter what the scoreboard said.",
    ],
    recognitionPrompts: standardPrompts("Principles"),
    noticeThisWeek: "This week, notice a personal rule you hold onto even when it would be easier to bend it.",
    storyboard: [
      { scene: 1, visual: "Damian stating his rule to a friend: never leave a teammate out.", narration: "Damian had one personal rule: never leave a teammate out." },
      { scene: 2, visual: "A tense game moment where ignoring the rule would be easier.", narration: "During a game, it would have been easier to ignore it." },
      { scene: 3, visual: "Damian passing to the struggling teammate anyway.", narration: "He stuck to his rule anyway, even when it cost his team a bit.", onScreenText: "Where have your own principles guided you this week?" },
    ],
  },
  {
    slug: "probity-too-much-change",
    elementName: "Probity",
    familyKey: "integrity",
    title: "Too Much Change",
    beginning: [
      "The cashier accidentally gave Naomi too much change back.",
      "She noticed it right away, walking out of the store.",
      "She went back inside and pointed out the mistake.",
      "No one would have ever known if she'd just kept walking.",
    ],
    growing: [
      "At the corner store, the cashier miscounted while making change and handed Naomi several dollars more than she was actually owed.",
      "She noticed it almost the moment she stepped outside, feeling the extra weight of coins in her hand.",
      "Instead of just walking home with the extra money, she turned around, went back inside, and told the cashier exactly what had happened.",
      "The cashier thanked her, clearly relieved — and Naomi knew that if she'd just kept walking, absolutely no one would have ever known the difference.",
    ],
    recognitionPrompts: standardPrompts("Probity"),
    noticeThisWeek: "This week, notice a small honest correction you could make that no one would ever catch if you didn't.",
    storyboard: [
      { scene: 1, visual: "A cashier handing over change, miscounting slightly.", narration: "The cashier accidentally gave Naomi too much change back." },
      { scene: 2, visual: "Naomi noticing the extra money outside the store.", narration: "She noticed it right away, walking out of the store." },
      { scene: 3, visual: "Naomi returning the extra change to a relieved cashier.", narration: "No one would have ever known if she'd just kept walking.", onScreenText: "Where have you shown this kind of honesty this week?" },
    ],
  },
  {
    slug: "vulnerability-admitting-she-was-scared",
    elementName: "Vulnerability",
    familyKey: "integrity",
    title: "Admitting She Was Scared",
    beginning: [
      "Everyone assumed Camille wasn't nervous about the recital.",
      "She'd been pretending to be totally fine all week.",
      "Finally, she told her best friend the truth: she was terrified.",
      "Saying it out loud made her feel closer to her friend, not weaker.",
    ],
    growing: [
      "In the days leading up to the piano recital, Camille kept telling everyone, including herself, that she wasn't nervous at all.",
      "She'd been putting on a calm, confident front all week, even though her stomach had been in knots the entire time.",
      "The night before, she finally told her best friend the truth — that she was genuinely terrified of messing up in front of everyone.",
      "Saying it out loud, instead of hiding it, didn't make her feel weak the way she'd feared it would. It actually made her feel closer to her friend than she had all week.",
    ],
    recognitionPrompts: standardPrompts("Vulnerability"),
    noticeThisWeek: "This week, notice something you've been hiding that might actually bring you closer to someone if you admitted it.",
    storyboard: [
      { scene: 1, visual: "Camille putting on a confident face in front of others, visibly tense.", narration: "Everyone assumed Camille wasn't nervous about the recital." },
      { scene: 2, visual: "Camille alone, clearly anxious, the mask slipping.", narration: "She'd been pretending to be totally fine all week." },
      { scene: 3, visual: "Camille confiding in her best friend, both of them closer for it.", narration: "Saying it out loud made her feel closer to her friend, not weaker.", onScreenText: "Where have you shown vulnerability this week?" },
    ],
  }
);

export function getChemistryStory(slug: string): ChemistryStory | undefined {
  return STORY_LIBRARY.find((s) => s.slug === slug);
}
