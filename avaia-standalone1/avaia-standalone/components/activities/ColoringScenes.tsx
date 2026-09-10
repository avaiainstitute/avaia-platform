// Hand-authored line-art coloring scenes, one per pilot element, each built
// directly from that element's story in lib/chemistry-stories.ts. Deliberately
// thick, simple, high-contrast outlines (real coloring-book construction:
// bold strokes, big shapes, lots of white space to fill in), not
// illustrative detail. Adding a new element later means adding one more
// scene component here in the same style.

const STROKE = "#1c1a16";
const W = 3.5;

export function KindnessScene() {
  return (
    <svg viewBox="0 0 600 460" className="w-full h-auto" aria-label="Two children at a lunch table, one waving the other over to an empty seat">
      <rect x="8" y="8" width="584" height="444" rx="18" fill="none" stroke={STROKE} strokeWidth={W} />
      {/* table */}
      <ellipse cx="300" cy="330" rx="220" ry="46" fill="none" stroke={STROKE} strokeWidth={W} />
      <line x1="120" y1="330" x2="120" y2="400" stroke={STROKE} strokeWidth={W} />
      <line x1="480" y1="330" x2="480" y2="400" stroke={STROKE} strokeWidth={W} />
      {/* trays */}
      <rect x="150" y="300" width="80" height="46" rx="8" fill="none" stroke={STROKE} strokeWidth={W} />
      <rect x="370" y="300" width="80" height="46" rx="8" fill="none" stroke={STROKE} strokeWidth={W} />
      {/* seated child (left, waving) */}
      <circle cx="190" cy="200" r="46" fill="none" stroke={STROKE} strokeWidth={W} />
      <circle cx="174" cy="192" r="5" fill={STROKE} />
      <circle cx="206" cy="192" r="5" fill={STROKE} />
      <path d="M172 214 Q190 228 208 214" fill="none" stroke={STROKE} strokeWidth={W} strokeLinecap="round" />
      <path d="M190 246 L190 300" stroke={STROKE} strokeWidth={W} />
      <path d="M190 260 L130 220" stroke={STROKE} strokeWidth={W} strokeLinecap="round" />
      <path d="M190 270 L250 270" stroke={STROKE} strokeWidth={W} strokeLinecap="round" />
      {/* empty stool with sparkle inviting */}
      <path d="M420 300 L420 250" stroke={STROKE} strokeWidth={W} strokeDasharray="2 10" strokeLinecap="round" />
      <ellipse cx="420" cy="250" rx="34" ry="14" fill="none" stroke={STROKE} strokeWidth={W} />
      <g stroke={STROKE} strokeWidth={2.5} strokeLinecap="round">
        <path d="M420 190 L420 210" />
        <path d="M400 200 L410 205" />
        <path d="M440 200 L430 205" />
      </g>
      <text x="300" y="60" textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={700} fontSize="26" fill={STROKE}>
        Come sit here!
      </text>
    </svg>
  );
}

export function CourageScene() {
  return (
    <svg viewBox="0 0 600 460" className="w-full h-auto" aria-label="A child standing at the top of a high dive above wavy pool water">
      <rect x="8" y="8" width="584" height="444" rx="18" fill="none" stroke={STROKE} strokeWidth={W} />
      {/* sun */}
      <circle cx="500" cy="80" r="30" fill="none" stroke={STROKE} strokeWidth={W} />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <line key={i} x1={500 + Math.cos(a) * 40} y1={80 + Math.sin(a) * 40} x2={500 + Math.cos(a) * 54} y2={80 + Math.sin(a) * 54} stroke={STROKE} strokeWidth={W} strokeLinecap="round" />
        );
      })}
      {/* ladder + platform */}
      <line x1="140" y1="400" x2="140" y2="140" stroke={STROKE} strokeWidth={W} />
      <line x1="170" y1="400" x2="170" y2="140" stroke={STROKE} strokeWidth={W} />
      {Array.from({ length: 7 }).map((_, i) => (
        <line key={i} x1="140" y1={160 + i * 34} x2="170" y2={160 + i * 34} stroke={STROKE} strokeWidth={W} />
      ))}
      <rect x="140" y="120" width="140" height="20" rx="4" fill="none" stroke={STROKE} strokeWidth={W} />
      {/* child at edge, arms out */}
      <circle cx="240" cy="90" r="26" fill="none" stroke={STROKE} strokeWidth={W} />
      <circle cx="230" cy="86" r="3.5" fill={STROKE} />
      <circle cx="250" cy="86" r="3.5" fill={STROKE} />
      <path d="M228 100 Q240 90 252 100" fill="none" stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M240 116 L240 150" stroke={STROKE} strokeWidth={W} />
      <path d="M240 125 L200 105" stroke={STROKE} strokeWidth={W} strokeLinecap="round" />
      <path d="M240 125 L280 105" stroke={STROKE} strokeWidth={W} strokeLinecap="round" />
      {/* water */}
      <path
        d="M20 400 Q60 385 100 400 T180 400 T260 400 T340 400 T420 400 T500 400 T580 400"
        fill="none"
        stroke={STROKE}
        strokeWidth={W}
        strokeLinecap="round"
      />
      <path
        d="M20 425 Q60 410 100 425 T180 425 T260 425 T340 425 T420 425 T500 425 T580 425"
        fill="none"
        stroke={STROKE}
        strokeWidth={W}
        strokeLinecap="round"
      />
      <text x="410" y="200" textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={700} fontSize="24" fill={STROKE}>
        Jump anyway!
      </text>
    </svg>
  );
}

export function PatienceScene() {
  return (
    <svg viewBox="0 0 600 460" className="w-full h-auto" aria-label="A small pot with a sprout on a windowsill, a watering can beside it">
      <rect x="8" y="8" width="584" height="444" rx="18" fill="none" stroke={STROKE} strokeWidth={W} />
      {/* windowsill */}
      <line x1="60" y1="360" x2="540" y2="360" stroke={STROKE} strokeWidth={W} />
      {/* pot */}
      <path d="M240 300 L260 380 L340 380 L360 300 Z" fill="none" stroke={STROKE} strokeWidth={W} strokeLinejoin="round" />
      <line x1="234" y1="300" x2="366" y2="300" stroke={STROKE} strokeWidth={W} />
      {/* sprout */}
      <path d="M300 300 L300 220" stroke={STROKE} strokeWidth={W} strokeLinecap="round" />
      <path d="M300 260 Q260 240 250 200" fill="none" stroke={STROKE} strokeWidth={W} strokeLinecap="round" />
      <path d="M300 240 Q340 220 350 180" fill="none" stroke={STROKE} strokeWidth={W} strokeLinecap="round" />
      {/* watering can */}
      <path d="M420 340 L420 300 Q420 285 440 285 L460 285 Q475 285 480 270" fill="none" stroke={STROKE} strokeWidth={W} strokeLinecap="round" />
      <rect x="390" y="330" width="70" height="40" rx="10" fill="none" stroke={STROKE} strokeWidth={W} />
      <path d="M405 330 L405 305 Q405 295 415 295 L440 295" fill="none" stroke={STROKE} strokeWidth={W} strokeLinecap="round" />
      <g stroke={STROKE} strokeWidth={2.5} strokeLinecap="round">
        <path d="M485 265 L493 273" />
        <path d="M490 260 L500 262" />
        <path d="M480 255 L486 247" />
      </g>
      {/* three days passing, sun/moon */}
      <circle cx="120" cy="90" r="20" fill="none" stroke={STROKE} strokeWidth={W} />
      <path d="M240 90 a20 20 0 1 0 20 -28 a16 16 0 1 1 -20 28" fill="none" stroke={STROKE} strokeWidth={W} />
      <circle cx="380" cy="90" r="20" fill="none" stroke={STROKE} strokeWidth={W} />
      <line x1="180" y1="90" x2="210" y2="90" stroke={STROKE} strokeWidth={2.5} strokeDasharray="3 8" strokeLinecap="round" />
      <line x1="290" y1="90" x2="330" y2="90" stroke={STROKE} strokeWidth={2.5} strokeDasharray="3 8" strokeLinecap="round" />
      <text x="300" y="150" textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={700} fontSize="20" fill={STROKE}>
        Wait... and water.
      </text>
    </svg>
  );
}

export function AppreciationScene() {
  return (
    <svg viewBox="0 0 600 460" className="w-full h-auto" aria-label="A school bus with the driver waving, a child handing over a thank-you card">
      <rect x="8" y="8" width="584" height="444" rx="18" fill="none" stroke={STROKE} strokeWidth={W} />
      {/* bus body */}
      <rect x="90" y="180" width="380" height="140" rx="24" fill="none" stroke={STROKE} strokeWidth={W} />
      <rect x="120" y="205" width="70" height="50" rx="8" fill="none" stroke={STROKE} strokeWidth={W} />
      <rect x="210" y="205" width="70" height="50" rx="8" fill="none" stroke={STROKE} strokeWidth={W} />
      <rect x="300" y="205" width="70" height="50" rx="8" fill="none" stroke={STROKE} strokeWidth={W} />
      <circle cx="170" cy="330" r="28" fill="none" stroke={STROKE} strokeWidth={W} />
      <circle cx="390" cy="330" r="28" fill="none" stroke={STROKE} strokeWidth={W} />
      {/* driver waving through window */}
      <circle cx="430" cy="225" r="20" fill="none" stroke={STROKE} strokeWidth={W} />
      <path d="M450 210 L468 195" stroke={STROKE} strokeWidth={W} strokeLinecap="round" />
      <g stroke={STROKE} strokeWidth={2.5} strokeLinecap="round">
        <path d="M468 185 L474 195" />
        <path d="M478 190 L474 200" />
      </g>
      {/* card being handed up */}
      <rect x="40" y="250" width="60" height="46" rx="6" fill="none" stroke={STROKE} strokeWidth={W} />
      <path d="M50 265 L90 265 M50 278 L80 278" stroke={STROKE} strokeWidth={2} strokeLinecap="round" />
      <path d="M70 296 Q70 250 120 235" fill="none" stroke={STROKE} strokeWidth={2.5} strokeDasharray="4 8" strokeLinecap="round" />
      <text x="300" y="410" textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={700} fontSize="22" fill={STROKE}>
        Thank you for driving us!
      </text>
    </svg>
  );
}

/** The scalable fallback: a decorative page for any element that doesn't
 *  (yet) have a hand-authored story scene above. Built entirely from the
 *  element's own name and symbol, so it works for all 123 without any
 *  per-element art, honestly labeled "Color the Word" rather than
 *  "Color the Story" wherever this renders, since there's no story scene
 *  behind it. */
export function GenericColoringPage({ elementName, symbol }: { elementName: string; symbol: string }) {
  const dots = 16;
  return (
    <svg viewBox="0 0 600 460" className="w-full h-auto" aria-label={`Decorative coloring page for the word ${elementName}`}>
      <rect x="8" y="8" width="584" height="444" rx="18" fill="none" stroke={STROKE} strokeWidth={W} />
      <rect x="26" y="26" width="548" height="408" rx="10" fill="none" stroke={STROKE} strokeWidth={2} strokeDasharray="1 10" strokeLinecap="round" />
      {Array.from({ length: dots }).map((_, i) => {
        const t = i / dots;
        const x = 60 + t * 480;
        return (
          <g key={`t${i}`}>
            <circle cx={x} cy="55" r="6" fill="none" stroke={STROKE} strokeWidth={2} />
            <circle cx={x} cy="405" r="6" fill="none" stroke={STROKE} strokeWidth={2} />
          </g>
        );
      })}
      <circle cx="300" cy="130" r="46" fill="none" stroke={STROKE} strokeWidth={W} />
      <text x="300" y="143" textAnchor="middle" fontFamily="'Fraunces', serif" fontWeight={700} fontSize="34" fill={STROKE}>
        {symbol}
      </text>
      <text
        x="300"
        y="270"
        textAnchor="middle"
        fontFamily="'Baloo 2', sans-serif"
        fontWeight={800}
        fontSize={elementName.length > 10 ? "48" : "64"}
        fill="none"
        stroke={STROKE}
        strokeWidth={2.5}
      >
        {elementName}
      </text>
      <path d="M180 330 Q300 360 420 330" fill="none" stroke={STROKE} strokeWidth={2.5} strokeDasharray="3 9" strokeLinecap="round" />
    </svg>
  );
}

export function sceneFor(slug: string) {
  switch (slug) {
    case "kindness-the-extra-seat":
      return KindnessScene;
    case "courage-the-high-dive":
      return CourageScene;
    case "patience-the-slow-seed":
      return PatienceScene;
    case "appreciation-the-thank-you-note":
      return AppreciationScene;
    default:
      return null;
  }
}
