"use client";

import { useState } from "react";
import { virtuesForName, familyOf, QUALITY_WORD } from "@/lib/virtues";

/** Types a name, gets each letter mapped to a real Chemistry of Virtue
 *  element -- a self-definition, not a game score. Purely a deterministic
 *  lookup (see lib/virtues.ts's virtueForLetter), so the same name always
 *  spells the same thing. No sign-in, nothing saved -- same public posture
 *  as the rest of this page. */
export default function VirtueNameAcronym() {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const letters = trimmed ? virtuesForName(trimmed) : [];

  return (
    <div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Type a name..."
        maxLength={40}
        className="w-full max-w-sm rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
      />

      {letters.length > 0 && (
        <div className="mt-6 space-y-2">
          {letters.map((l, i) => (
            <div key={i} className="flex items-baseline gap-3">
              <span className="w-6 shrink-0 font-serif text-xl text-ink">{l.letter}</span>
              {l.kind === "virtue" ? (
                <span>
                  <span
                    className="font-serif text-lg"
                    style={{ color: familyOf(l.virtue.family).color }}
                  >
                    {l.virtue.name}
                  </span>
                  <span className="ml-2 text-sm text-muted">{familyOf(l.virtue.family).name}</span>
                </span>
              ) : l.kind === "quality" ? (
                <span>
                  <span className="font-serif text-lg text-ink">{QUALITY_WORD}</span>
                  <span className="ml-2 text-sm text-muted">
                    not one of the 123 official elements — a seat at the table anyway
                  </span>
                </span>
              ) : (
                <span className="text-sm text-muted">no letter to show</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
