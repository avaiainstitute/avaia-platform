"use client";

import { useState } from "react";
import { familyByName } from "@/lib/virtues";
import { IDENTITY_FIRST_RING, type VirtueSignatureEntry } from "@/lib/virtue-signature";

type Node = { family: string; element: string | null; entryId?: string };

// AVAIA Noble Gas / Identity visual -- source-based, from the recovered
// VIRTUOUS NOBLE GAS.pptx (center "YOU," a first ring of two, growing
// outer rings) and Dorian's own Atom video transcript: "that nucleus is
// the identity of that atom. It doesn't change." / "those two are
// protecting our identity... the two elements of integrity that keep us
// who we are." Outer rings are NOT a fixed inventory implying what's
// missing -- the transcript is explicit that every capacity is already
// available to "wake up," so an empty or sparse outer ring reads as
// "not yet added," never as absence.
//
// Ring capacity loosely echoes the transcript's own electron-shell
// figures (first ring 2, second ring up to 8, third ring larger) as a
// thematic nod, not a literal chemistry rule enforced anywhere else in
// the app.
const RING_CAPACITY = [2, 8, 12, 16];

function ringsFor(nodes: Node[]): Node[][] {
  const rings: Node[][] = [];
  let i = 0;
  let ringIndex = 0;
  while (i < nodes.length) {
    const capacity = RING_CAPACITY[Math.min(ringIndex, RING_CAPACITY.length - 1)];
    rings.push(nodes.slice(i, i + capacity));
    i += capacity;
    ringIndex++;
  }
  return rings;
}

export default function VirtueSignatureVisual({
  entries,
  hostLabel = "YOU",
}: {
  entries: VirtueSignatureEntry[];
  hostLabel?: string;
}) {
  const [hovered, setHovered] = useState<Node | null>(null);

  const outerNodes: Node[] = entries.map((e) => ({ family: e.family, element: e.element, entryId: e.id }));
  const firstRing: Node[] = IDENTITY_FIRST_RING.map((r) => ({ family: r.family, element: r.element }));
  const outerRings = ringsFor(outerNodes);

  const size = 520;
  const center = size / 2;
  const baseRadius = 70;
  const ringGap = 62;

  function positionsFor(ring: Node[], radius: number): { x: number; y: number }[] {
    return ring.map((_, i) => {
      const angle = (2 * Math.PI * i) / ring.length - Math.PI / 2;
      return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
    });
  }

  const firstRingPositions = positionsFor(firstRing, baseRadius);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[520px]">
        {/* Ring guides */}
        <circle cx={center} cy={center} r={baseRadius} fill="none" stroke="currentColor" className="text-rule" strokeWidth={1} />
        {outerRings.map((_, ri) => (
          <circle
            key={ri}
            cx={center}
            cy={center}
            r={baseRadius + ringGap * (ri + 1)}
            fill="none"
            stroke="currentColor"
            className="text-rule"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        ))}

        {/* Center -- Identity */}
        <circle cx={center} cy={center} r={44} fill="#c1502e" opacity={0.15} stroke="#c1502e" strokeWidth={1.5} />
        <text x={center} y={center + 5} textAnchor="middle" className="fill-current text-ink" fontSize={16} fontWeight={600}>
          {hostLabel}
        </text>

        {/* First ring -- fixed: Vulnerability + Authenticity */}
        {firstRing.map((node, i) => {
          const pos = firstRingPositions[i];
          const color = familyByName(node.family)?.color ?? "#e08a1e";
          return (
            <g
              key={`first-${i}`}
              onMouseEnter={() => setHovered(node)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              <circle cx={pos.x} cy={pos.y} r={22} fill={color} opacity={0.85} />
              <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize={9} fill="#05060b" fontWeight={600}>
                {node.element}
              </text>
            </g>
          );
        })}

        {/* Outer rings -- the Host's own living entries */}
        {outerRings.map((ring, ri) => {
          const radius = baseRadius + ringGap * (ri + 1);
          const positions = positionsFor(ring, radius);
          return ring.map((node, i) => {
            const pos = positions[i];
            const color = familyByName(node.family)?.color ?? "#e08a1e";
            const label = node.element ?? node.family;
            return (
              <g
                key={`${ri}-${i}`}
                onMouseEnter={() => setHovered(node)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer"
              >
                <circle cx={pos.x} cy={pos.y} r={18} fill={color} opacity={0.85} />
                <text x={pos.x} y={pos.y + 3.5} textAnchor="middle" fontSize={8} fill="#05060b" fontWeight={600}>
                  {label.length > 10 ? label.slice(0, 9) + "…" : label}
                </text>
              </g>
            );
          });
        })}
      </svg>

      <div className="mt-2 min-h-[1.5rem] text-sm text-muted">
        {hovered ? (hovered.element ? `${hovered.family} — ${hovered.element}` : hovered.family) : "Hover an element"}
      </div>

      {outerNodes.length === 0 && (
        <p className="mt-2 max-w-sm text-center text-sm text-muted">
          The first ring — Vulnerability and Authenticity — is always here, protecting identity.
          Everything else is already inside you, waiting to be recognized. Nothing outside this
          center ring is missing; it just hasn&rsquo;t been added yet.
        </p>
      )}
    </div>
  );
}
