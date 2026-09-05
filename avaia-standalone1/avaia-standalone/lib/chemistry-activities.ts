import type { VirtueFamilyKey } from "@/lib/virtues";

// Chemistry for Kids -- Printable Activity system.
//
// This is a PILOT covering 4 of 123 canonical elements, chosen because
// each already has a completed children's story in lib/chemistry-stories.ts.
// The architecture (this file + components/activities/*) is built to scale
// to all 123 without changing shape: adding an element later means adding
// one more ElementActivitySet here, plus one coloring-scene component.
//
// Every activity is meant to be printed and used by hand -- colored,
// traced, drawn on, filled in. None of it is scored, graded, or used to
// assess a child's character. A child never needs to already "have" the
// element to do any of these; every activity works the same for every
// child, the same way every element is already available to everyone.
//
// Each element's five activities are designed to chain directly off its
// story: READ -> LISTEN -> WATCH (future animation) -> COLOR/CREATE -> NOTICE.

export type ActivityKind = "coloring" | "trace" | "draw-yourself" | "notice" | "puzzle";
export type AgeBand = "younger" | "older" | "both";

export type ActivityPageMeta = {
  id: string;
  kind: ActivityKind;
  title: string;
  ageBand: AgeBand;
  blurb: string;
};

export type ElementActivitySet = {
  elementSlug: string; // matches ChemistryStory.slug in lib/chemistry-stories.ts
  elementName: string;
  familyKey: VirtueFamilyKey;
  symbol: string;
  storyTitle: string;
  sceneCaption: string;
  puzzleTitle: string;
  puzzleKind: "matching" | "maze" | "sequence" | "card";
  pages: ActivityPageMeta[];
};

function standardPages(elementName: string, puzzleTitle: string): ActivityPageMeta[] {
  return [
    {
      id: "coloring",
      kind: "coloring",
      title: `Color the Story`,
      ageBand: "both",
      blurb: `A scene from ${elementName}'s story, ready to color in.`,
    },
    {
      id: "trace",
      kind: "trace",
      title: `Trace & Color ${elementName}`,
      ageBand: "younger",
      blurb: `Big bubble letters to trace, then color in.`,
    },
    {
      id: "draw-yourself",
      kind: "draw-yourself",
      title: `Draw Yourself Using ${elementName}`,
      ageBand: "both",
      blurb: `A blank frame to draw a picture of yourself.`,
    },
    {
      id: "notice",
      kind: "notice",
      title: `Where Did You Notice ${elementName}?`,
      ageBand: "both",
      blurb: `Draw or write about where you saw it this week.`,
    },
    {
      id: "puzzle",
      kind: "puzzle",
      title: puzzleTitle,
      ageBand: "both",
      blurb: `A hands-on activity built around this element.`,
    },
  ];
}

export const ACTIVITY_PILOT: ElementActivitySet[] = [
  {
    elementSlug: "kindness-the-extra-seat",
    elementName: "Kindness",
    familyKey: "love",
    symbol: "Kd",
    storyTitle: "The Extra Seat",
    sceneCaption: "Mara made room at her table for Theo.",
    puzzleTitle: "Match the Kind Action",
    puzzleKind: "matching",
    pages: standardPages("Kindness", "Match the Kind Action"),
  },
  {
    elementSlug: "courage-the-high-dive",
    elementName: "Courage",
    familyKey: "fortitude",
    symbol: "Cg",
    storyTitle: "The High Dive",
    sceneCaption: "Jonah stood at the edge of the high dive.",
    puzzleTitle: "Climb to the High Dive",
    puzzleKind: "maze",
    pages: standardPages("Courage", "Climb to the High Dive"),
  },
  {
    elementSlug: "patience-the-slow-seed",
    elementName: "Patience",
    familyKey: "self-control",
    symbol: "Pn",
    storyTitle: "The Slow Seed",
    sceneCaption: "Oliver waited and watered his seed every day.",
    puzzleTitle: "Put the Seed's Growing in Order",
    puzzleKind: "sequence",
    pages: standardPages("Patience", "Put the Seed's Growing in Order"),
  },
  {
    elementSlug: "appreciation-the-thank-you-note",
    elementName: "Appreciation",
    familyKey: "gratitude",
    symbol: "Ap",
    storyTitle: "The Thank-You Note",
    sceneCaption: "Sam handed the driver a thank-you card.",
    puzzleTitle: "Make Your Own Thank-You Card",
    puzzleKind: "card",
    pages: standardPages("Appreciation", "Make Your Own Thank-You Card"),
  },
];

export function getActivitySet(slug: string): ElementActivitySet | null {
  return ACTIVITY_PILOT.find((a) => a.elementSlug === slug) ?? null;
}
