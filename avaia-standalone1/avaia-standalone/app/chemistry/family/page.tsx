"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STORY_LIBRARY, type ReadingLevel } from "@/lib/chemistry-stories";
import { VIRTUE_FAMILIES, VIRTUES, type VirtueFamilyKey } from "@/lib/virtues";
import SpeakButton from "@/components/SpeakButton";

/** Chemistry for Families & Kids -- the first real architecture for
 *  parents and children to learn the language of virtue together.
 *  Deliberately NOT gated by Youth guardian-consent architecture: this
 *  page is free reading material, the same as a Library entry -- no
 *  AVAIA conversation opens here. The consent-gated boundary stays
 *  exactly where it already was: a family that wants to go further, into
 *  an actual private Youth AVAIA conversation, is pointed at the
 *  existing Youth Unsung Heroes path (a Certified Guide's Toolkit tool,
 *  already guardian-consent-gated, already developmental-band-aware) --
 *  nothing new invented there, and Chemistry for Kids never becomes a
 *  second Unsung Heroes.
 *
 *  Governing rule stated plainly for parents, not just engineers: a
 *  child is never told they lack a virtue, and no story implies a
 *  specific problem requires a specific element. Every element is
 *  already available to every child; a story just makes one visible.
 *
 *  "Listen to the Story" reuses SpeakButton (components/SpeakButton.tsx)
 *  as-is -- the same on-device browser speech synthesis already used for
 *  Journey chat, not a new or fake audio feature. A future animated
 *  series (see lib/chemistry-stories.ts's own `storyboard` field, built
 *  per story) would use real recorded/voice-acted narration instead;
 *  this is the real, currently-available "listen" capability in the
 *  meantime, not a placeholder standing in for one. */
export default function ChemistryFamilyPage() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [level, setLevel] = useState<ReadingLevel>("beginning");
  const [activeFamily, setActiveFamily] = useState<VirtueFamilyKey | null>(null);
  const [search, setSearch] = useState("");

  const story = STORY_LIBRARY.find((s) => s.slug === selectedSlug) ?? null;

  const familyCoverage = useMemo(() => {
    const map = new Map<VirtueFamilyKey, number>();
    for (const s of STORY_LIBRARY) map.set(s.familyKey, (map.get(s.familyKey) ?? 0) + 1);
    return map;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return STORY_LIBRARY.filter((s) => {
      if (activeFamily && s.familyKey !== activeFamily) return false;
      if (q && !s.elementName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activeFamily, search]);

  const totalElements = VIRTUES.length;
  const storyText = story ? (level === "beginning" ? story.beginning : story.growing).join(" ") : "";

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">Chemistry of Virtue</p>
      <h1 className="font-serif text-4xl text-ink leading-tight">
        Chemistry for Families & Kids
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        A shared language for noticing virtue together — not a way to grade your child's
        character, and not a way to produce "good kids." It's a way to help a family recognize
        something that's already there.
      </p>

      <section className="rule-t mt-14 border-t border-rule pt-10">
        <p className="label mb-2 text-muted">What It Is</p>
        <p className="text-muted">
          Chemistry of Virtue is AVAIA's language for virtue — {totalElements} words like Kindness,
          Courage, Honesty, and Patience, organized into 10 families. Chemistry for Kids is the
          same language, told through short original stories a child can read, or listen to, with
          a few simple questions afterward.
        </p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-10">
        <p className="label mb-2 text-muted">What It Does</p>
        <p className="text-muted">
          It doesn't ask a child to memorize a definition or score their own character. It gives
          them a word, shows them what that word can look like in an ordinary moment, and asks
          them to notice it — in the story, in themselves, in the people around them.
        </p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-10">
        <p className="label mb-2 text-muted">What Becomes Possible</p>
        <p className="text-muted">
          A family that has words for what they're already noticing in each other. A child who
          can name what they saw a friend do, or what they felt themselves do, without needing an
          adult to tell them whether it counted. Nothing here is graded, ranked, or diagnostic —
          every child already has access to all of it.
        </p>
      </section>

      <section className="rule-t mt-14 border-t border-rule pt-10">
        <p className="label mb-2 text-muted">Try It Together</p>
        <p className="text-sm text-muted">
          Search or browse by family, choose an element, pick a reading level, and read (or
          listen to) the story together.
        </p>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search an element (e.g. Courage, Patience)…"
          className="mt-4 w-full rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveFamily(null)}
            className={`rounded-full border px-3 py-1 font-sans text-xs font-medium transition-colors ${
              activeFamily === null ? "border-seal bg-seal text-[#05060b]" : "border-rule text-muted hover:border-seal"
            }`}
          >
            All Families
          </button>
          {VIRTUE_FAMILIES.map((f) => {
            const count = familyCoverage.get(f.key) ?? 0;
            if (count === 0) return null;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFamily(activeFamily === f.key ? null : f.key)}
                className="rounded-full border px-3 py-1 font-sans text-xs font-medium transition-all"
                style={{
                  borderColor: f.color,
                  backgroundColor: activeFamily === f.key ? f.color : "transparent",
                  color: activeFamily === f.key ? "#fff" : f.color,
                }}
              >
                {f.name} ({count})
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {filtered.length === 0 && (
            <p className="text-sm text-muted">
              No story yet for that search — try another element, or browse by family above.
            </p>
          )}
          {filtered.map((s) => {
            const fam = VIRTUE_FAMILIES.find((f) => f.key === s.familyKey)!;
            return (
              <button
                key={s.slug}
                onClick={() => setSelectedSlug(s.slug)}
                className="rounded-full border px-4 py-2 font-sans text-sm font-medium transition-all"
                style={{
                  borderColor: fam.color,
                  backgroundColor: selectedSlug === s.slug ? fam.color : "transparent",
                  color: selectedSlug === s.slug ? "#fff" : fam.color,
                }}
              >
                {s.elementName}
              </button>
            );
          })}
        </div>

        {story && (
          <div className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label text-muted">{story.elementName}</p>
                <h3 className="font-serif text-2xl text-ink">{story.title}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 rounded-md border border-rule p-1">
                  <button
                    onClick={() => setLevel("beginning")}
                    className={`rounded px-3 py-1 text-xs font-sans font-medium ${
                      level === "beginning" ? "bg-seal text-[#05060b]" : "text-muted"
                    }`}
                  >
                    Beginning Reader
                  </button>
                  <button
                    onClick={() => setLevel("growing")}
                    className={`rounded px-3 py-1 text-xs font-sans font-medium ${
                      level === "growing" ? "bg-seal text-[#05060b]" : "text-muted"
                    }`}
                  >
                    Growing Reader
                  </button>
                </div>
                <SpeakButton text={storyText} />
              </div>
            </div>

            <div className="mt-5 space-y-3 text-ink">
              {(level === "beginning" ? story.beginning : story.growing).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            <div className="mt-8 rounded-md border border-rule bg-white/[0.03] px-4 py-4">
              <p className="label mb-2 text-muted">Talk About It</p>
              <ul className="space-y-2 text-sm text-ink">
                {story.recognitionPrompts.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>

            <div className="mt-4 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-4">
              <p className="label mb-1 text-muted">Notice This Week</p>
              <p className="text-sm text-ink">{story.noticeThisWeek}</p>
            </div>
          </div>
        )}
      </section>

      <section className="rule-t mt-14 border-t border-rule pt-10">
        <p className="label mb-2 text-muted">With the Physical Cards</p>
        <p className="text-muted">
          Every story here is built on the same {totalElements}-element table as the Chemistry of
          Virtue card deck being developed. Once a physical card for an element is in hand, the
          same element's story is meant to be found here — pick up the card, then read (or
          listen to) its story together.
        </p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-10">
        <p className="label mb-2 text-muted">Going Further</p>
        <p className="text-muted">
          If your family wants to go further — recognizing a real moment where your child saw or
          practiced virtue themselves — Unsung Heroes is AVAIA's short guided conversation for
          exactly that, available for adults and, with a Certified Guide and guardian consent, for
          Youth as well.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/unsung-heroes"
            className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Explore Unsung Heroes
          </Link>
          <Link
            href="/chemistry"
            className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Explore the Full Chemistry Table
          </Link>
        </div>
      </section>
    </div>
  );
}
