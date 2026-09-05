import type { ElementActivitySet } from "@/lib/chemistry-activities";
import { VIRTUE_FAMILIES } from "@/lib/virtues";

const STROKE = "#1c1a16";

export function TracePage({ set }: { set: ElementActivitySet }) {
  const family = VIRTUE_FAMILIES.find((f) => f.key === set.familyKey)!;
  const word = set.elementName;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 py-6">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full border-4 font-serif text-2xl font-bold"
        style={{ borderColor: family.color, color: family.color }}
      >
        {set.symbol}
      </div>
      <p
        className="text-center leading-none"
        style={{
          fontFamily: "'Baloo 2', sans-serif",
          fontWeight: 800,
          fontSize: "5.2rem",
          WebkitTextStroke: `3px ${STROKE}`,
          color: "transparent",
        }}
      >
        {word}
      </p>
      {[0.85, 0.7].map((scale, i) => (
        <p
          key={i}
          className="text-center leading-none"
          style={{
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            fontSize: `${3.2 * scale}rem`,
            WebkitTextStroke: `2px ${STROKE}80`,
            color: "transparent",
          }}
        >
          {word}
        </p>
      ))}
      <p className="mt-2 text-center font-sans text-sm text-[#5b5646]">
        Trace the big letters, then color them in any way you like.
      </p>
    </div>
  );
}

export function DrawYourselfPage({ set }: { set: ElementActivitySet }) {
  const family = VIRTUE_FAMILIES.find((f) => f.key === set.familyKey)!;
  return (
    <div className="flex flex-1 flex-col items-center gap-6 py-2">
      <div
        className="flex aspect-[4/3] w-full max-w-[5.6in] items-center justify-center rounded-[28px] border-[5px] border-dashed"
        style={{ borderColor: family.color }}
      >
        <p className="px-8 text-center font-sans text-sm text-[#9a9484]">Draw your picture here</p>
      </div>
      <p className="text-center font-sans text-base text-[#5b5646]">
        A time I noticed myself showing {set.elementName.toLowerCase()} was when...
      </p>
      <div className="w-full max-w-[5.6in] space-y-6">
        <div className="border-b-2 border-dashed" style={{ borderColor: STROKE }} />
        <div className="border-b-2 border-dashed" style={{ borderColor: STROKE }} />
      </div>
    </div>
  );
}

export function NoticePage({ set }: { set: ElementActivitySet }) {
  const boxes = [
    { label: "At Home" },
    { label: "With Friends or at School" },
    { label: "Somewhere Else" },
  ];
  return (
    <div className="flex flex-1 flex-col gap-6 py-2">
      <p className="text-center font-sans text-base text-[#5b5646]">
        Notice this week -- where did you see {set.elementName.toLowerCase()}? Draw or write in each box.
      </p>
      <div className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-3">
        {boxes.map((b) => (
          <div key={b.label} className="flex flex-col rounded-2xl border-[3px] p-3" style={{ borderColor: STROKE }}>
            <p className="mb-2 text-center font-sans text-sm font-semibold text-[#5b5646]">{b.label}</p>
            <div className="flex-1 rounded-lg border-2 border-dashed" style={{ borderColor: "#c7bfa8", minHeight: "1.6in" }} />
            <div className="mt-3 border-b-2 border-dashed" style={{ borderColor: STROKE }} />
          </div>
        ))}
      </div>
    </div>
  );
}
