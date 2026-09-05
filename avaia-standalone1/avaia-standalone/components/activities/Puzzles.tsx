import type { ElementActivitySet } from "@/lib/chemistry-activities";

const STROKE = "#1c1a16";
const W = 3.5;

export function MatchingPuzzle() {
  // Kindness -- draw a line from each small picture to the phrase it matches.
  return (
    <div>
      <p className="mb-6 text-center font-sans text-base text-[#5b5646]">
        Draw a line from each picture to the words that match it.
      </p>
      <svg viewBox="0 0 600 380" className="w-full h-auto">
        {/* row 1: empty chair -> Making Room */}
        <g>
          <rect x="20" y="20" width="120" height="90" rx="10" fill="none" stroke={STROKE} strokeWidth={W} />
          <path d="M60 100 L60 60 L100 60 L100 100" fill="none" stroke={STROKE} strokeWidth={3} />
          <line x1="60" y1="60" x2="100" y2="60" stroke={STROKE} strokeWidth={3} />
          <line x1="140" y1="65" x2="220" y2="65" stroke={STROKE} strokeWidth={2} strokeDasharray="4 8" />
          <rect x="220" y="30" width="200" height="70" rx="30" fill="none" stroke={STROKE} strokeWidth={W} />
          <text x="320" y="72" textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={700} fontSize="24" fill={STROKE}>Making Room</text>
        </g>
        {/* row 2: two hands -> Helping */}
        <g>
          <circle cx="80" cy="180" r="45" fill="none" stroke={STROKE} strokeWidth={W} />
          <path d="M60 190 Q80 165 100 190" fill="none" stroke={STROKE} strokeWidth={3} strokeLinecap="round" />
          <path d="M60 190 L70 200 M100 190 L90 200" stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" />
          <line x1="140" y1="180" x2="220" y2="180" stroke={STROKE} strokeWidth={2} strokeDasharray="4 8" />
          <rect x="220" y="145" width="150" height="70" rx="30" fill="none" stroke={STROKE} strokeWidth={W} />
          <text x="295" y="187" textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={700} fontSize="24" fill={STROKE}>Helping</text>
        </g>
        {/* row 3: smiling face -> Welcoming */}
        <g>
          <circle cx="80" cy="300" r="45" fill="none" stroke={STROKE} strokeWidth={W} />
          <circle cx="65" cy="292" r="4" fill={STROKE} />
          <circle cx="95" cy="292" r="4" fill={STROKE} />
          <path d="M62 312 Q80 328 98 312" fill="none" stroke={STROKE} strokeWidth={3} strokeLinecap="round" />
          <line x1="140" y1="300" x2="220" y2="300" stroke={STROKE} strokeWidth={2} strokeDasharray="4 8" />
          <rect x="220" y="265" width="180" height="70" rx="30" fill="none" stroke={STROKE} strokeWidth={W} />
          <text x="310" y="307" textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={700} fontSize="24" fill={STROKE}>Welcoming</text>
        </g>
      </svg>
    </div>
  );
}

export function MazePuzzle() {
  // Courage -- climb the winding ladder path from START to the high dive.
  return (
    <div>
      <p className="mb-4 text-center font-sans text-base text-[#5b5646]">
        Find the path from START up to the high dive.
      </p>
      <svg viewBox="0 0 600 460" className="w-full h-auto">
        <rect x="8" y="8" width="584" height="444" rx="18" fill="none" stroke={STROKE} strokeWidth={W} />
        {/* main winding corridor (two parallel wobbly lines = walls) */}
        <path
          d="M80 420 L80 340 L200 340 L200 260 L120 260 L120 180 L300 180 L300 260 L400 260 L400 100 L300 100"
          fill="none"
          stroke={STROKE}
          strokeWidth={4}
        />
        <path
          d="M140 420 L140 300 L260 300 L260 220 L180 220 L180 140 L340 140 L340 220 L440 220 L440 60 L300 60"
          fill="none"
          stroke={STROKE}
          strokeWidth={4}
        />
        {/* a couple of decoy dead-end stubs */}
        <path d="M200 300 L260 300" fill="none" stroke={STROKE} strokeWidth={4} />
        <path d="M400 180 L470 180 L470 260" fill="none" stroke={STROKE} strokeWidth={4} />
        <text x="105" y="452" fontFamily="'Baloo 2', sans-serif" fontWeight={700} fontSize="20" fill={STROKE}>START</text>
        <circle cx="90" cy="435" r="10" fill="none" stroke={STROKE} strokeWidth={3} />
        <path d="M320 60 L320 30 Q320 15 340 15 L370 15" fill="none" stroke={STROKE} strokeWidth={4} />
        <rect x="300" y="8" width="90" height="26" rx="6" fill="none" stroke={STROKE} strokeWidth={W} />
        <text x="345" y="26" textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={700} fontSize="16" fill={STROKE}>DIVE!</text>
      </svg>
    </div>
  );
}

export function SequencePuzzle() {
  // Patience -- number the four growth panels in order, then color them.
  const panels = [
    { label: "Seed" },
    { label: "Sprout" },
    { label: "Taller" },
    { label: "Flower" },
  ];
  return (
    <div>
      <p className="mb-6 text-center font-sans text-base text-[#5b5646]">
        These got mixed up! Write 1, 2, 3, 4 in the circles to put the seed's growing back in order. Then color them in.
      </p>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {panels.map((p, i) => (
          <div key={i} className="rounded-xl border-[3px] p-3 text-center" style={{ borderColor: STROKE }}>
            <svg viewBox="0 0 140 140" className="mx-auto h-auto w-full">
              <rect x="4" y="4" width="132" height="132" rx="10" fill="none" stroke={STROKE} strokeWidth={2.5} />
              <path d="M50 110 L60 110 L65 130 L45 130 Z" fill="none" stroke={STROKE} strokeWidth={2.5} />
              <line x1="35" y1="130" x2="105" y2="130" stroke={STROKE} strokeWidth={2.5} />
              {i === 0 && <circle cx="70" cy="118" r="6" fill="none" stroke={STROKE} strokeWidth={2.5} />}
              {i === 1 && <path d="M70 118 L70 90" stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" />}
              {i === 2 && (
                <>
                  <path d="M70 118 L70 70" stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" />
                  <path d="M70 95 Q55 88 52 72" fill="none" stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" />
                  <path d="M70 85 Q85 78 88 62" fill="none" stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" />
                </>
              )}
              {i === 3 && (
                <>
                  <path d="M70 118 L70 55" stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" />
                  <path d="M70 95 Q55 88 52 72" fill="none" stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" />
                  <path d="M70 85 Q85 78 88 62" fill="none" stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" />
                  <circle cx="70" cy="48" r="14" fill="none" stroke={STROKE} strokeWidth={2.5} />
                  {Array.from({ length: 6 }).map((_, k) => {
                    const a = (k / 6) * Math.PI * 2;
                    return <circle key={k} cx={70 + Math.cos(a) * 18} cy={48 + Math.sin(a) * 18} r="7" fill="none" stroke={STROKE} strokeWidth={2} />;
                  })}
                </>
              )}
            </svg>
            <p className="mt-1 font-sans text-sm text-[#5b5646]">{p.label}</p>
            <svg viewBox="0 0 40 40" className="mx-auto mt-1 h-10 w-10">
              <circle cx="20" cy="20" r="17" fill="none" stroke={STROKE} strokeWidth={2.5} />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardPuzzle({ elementName }: { elementName: string }) {
  // Appreciation -- a foldable thank-you card template, used for real.
  return (
    <div>
      <p className="mb-4 text-center font-sans text-base text-[#5b5646]">
        Print this page, fold it in half along the dashed line, and give it to someone.
      </p>
      <svg viewBox="0 0 600 420" className="w-full h-auto">
        <line x1="300" y1="10" x2="300" y2="410" stroke={STROKE} strokeWidth={2} strokeDasharray="6 10" />
        {/* card front (right half, what shows when folded) */}
        <rect x="310" y="20" width="270" height="380" rx="14" fill="none" stroke={STROKE} strokeWidth={W} />
        <path d="M400 130 Q445 90 490 130 Q535 90 570 130 Q555 180 490 220 Q425 180 400 130 Z" fill="none" stroke={STROKE} strokeWidth={2.5} strokeLinejoin="round" />
        <text x="445" y="290" textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={700} fontSize="26" fill={STROKE}>Thank</text>
        <text x="445" y="325" textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={700} fontSize="26" fill={STROKE}>You!</text>
        {/* card inside (left half) */}
        <rect x="20" y="20" width="270" height="380" rx="14" fill="none" stroke={STROKE} strokeWidth={W} strokeDasharray="1 0" />
        <text x="155" y="60" textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={700} fontSize="18" fill={STROKE}>Thank you for...</text>
        {[100, 140, 180, 220].map((y) => (
          <line key={y} x1="45" y1={y} x2="265" y2={y} stroke={STROKE} strokeWidth={2} strokeDasharray="4 8" />
        ))}
        <text x="155" y="270" textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={600} fontSize="16" fill={STROKE}>from,</text>
        <line x1="45" y1="310" x2="265" y2="310" stroke={STROKE} strokeWidth={2} strokeDasharray="4 8" />
      </svg>
      <p className="mt-2 text-center text-xs text-[#5b5646]">
        A real thank-you note for a real person -- like Sam's in {elementName}&apos;s story.
      </p>
    </div>
  );
}

export function puzzleFor(set: ElementActivitySet) {
  switch (set.puzzleKind) {
    case "matching":
      return <MatchingPuzzle />;
    case "maze":
      return <MazePuzzle />;
    case "sequence":
      return <SequencePuzzle />;
    case "card":
      return <CardPuzzle elementName={set.elementName} />;
  }
}
