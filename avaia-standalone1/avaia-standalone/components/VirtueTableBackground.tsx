"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { VIRTUES, familyOf } from "@/lib/virtues";
import { VIRTUE_POS, GRID_COLS, GRID_ROWS } from "@/lib/virtue-layout";
import type { ResolvedFocus } from "@/lib/virtue-focus";

/**
 * A rendering of the Chemistry of Virtue table sitting behind the content as an
 * ambient reference layer, mounted alongside (not in place of) ChemistryBackground
 * so the floating elements and drifting reactions still play.
 *
 * A horizontal mask fades the table out of the centre column and leaves it
 * visible in the side margins — so while the Host reads a centred conversation,
 * the periodic table stays legible on the sides for immediate reference.
 *
 * When the Guide names a virtue, the journey chat broadcasts an `avaia:focus`
 * event: the named family's colour region brightens, the specific virtue gets a
 * contrasting outline, and everything else dims — a widening cue, not a verdict.
 */
export default function VirtueTableBackground() {
  const [focus, setFocus] = useState<ResolvedFocus | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const onFocus = (e: Event) => {
      setFocus((e as CustomEvent<ResolvedFocus | null>).detail ?? null);
    };
    window.addEventListener("avaia:focus", onFocus);
    return () => window.removeEventListener("avaia:focus", onFocus);
  }, []);

  // The Chemistry of Virtue tab IS the full table — no ambient copy behind it.
  if (pathname === "/chemistry") return null;

  const active = focus !== null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 flex items-center justify-center overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, black 0%, black 13%, transparent 30%, transparent 70%, black 87%, black 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, black 0%, black 13%, transparent 30%, transparent 70%, black 87%, black 100%)",
      }}
    >
      <div
        className="grid gap-[3px] transition-opacity duration-700"
        style={{
          width: "min(1240px, 96vw)",
          gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${GRID_ROWS}, auto)`,
          opacity: active ? 0.7 : 0.42,
        }}
      >
        {VIRTUES.map((v) => {
          const pos = VIRTUE_POS[v.name];
          if (!pos) return null;
          const fam = familyOf(v.family);

          const inFamily = active && v.family === focus!.familyKey;
          const isVirtue = active && v.name === focus!.virtueName;
          // Dim everything outside the focused family; keep the family bright.
          const tileOpacity = !active ? 1 : inFamily ? 1 : 0.14;

          return (
            <div
              key={v.name}
              className="flex aspect-square flex-col justify-between overflow-hidden rounded-[3px] p-1 text-white transition-all duration-500"
              style={{
                gridRow: pos[0],
                gridColumn: pos[1],
                backgroundColor: fam.color,
                opacity: tileOpacity,
                outline: isVirtue ? "2px solid #f6d98a" : "none",
                outlineOffset: "1px",
                boxShadow: isVirtue
                  ? `0 0 14px 2px ${fam.color}`
                  : inFamily
                    ? `0 0 10px ${fam.color}`
                    : "none",
                transform: isVirtue ? "scale(1.1)" : "none",
                zIndex: isVirtue ? 2 : inFamily ? 1 : "auto",
              }}
            >
              <span className="font-sans text-[0.62rem] font-bold leading-none">
                {v.symbol}
              </span>
              <span className="font-sans text-[0.44rem] leading-[1.05] tracking-tight text-white/85">
                {v.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
