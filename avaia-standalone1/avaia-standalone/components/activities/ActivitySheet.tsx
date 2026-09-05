import { VIRTUE_FAMILIES } from "@/lib/virtues";
import type { ElementActivitySet } from "@/lib/chemistry-activities";

export default function ActivitySheet({
  set,
  pageTitle,
  instructions,
  children,
}: {
  set: ElementActivitySet;
  pageTitle: string;
  instructions?: string;
  children: React.ReactNode;
}) {
  const family = VIRTUE_FAMILIES.find((f) => f.key === set.familyKey)!;
  return (
    <div className="activity-sheet mx-auto" style={{ borderColor: family.color }}>
      <div className="flex items-center justify-between border-b-[3px] pb-3" style={{ borderColor: family.color }}>
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] font-serif text-sm font-semibold"
            style={{ borderColor: family.color, color: family.color }}
          >
            {set.symbol}
          </div>
          <div>
            <p className="font-serif text-xl leading-tight text-ink">{set.elementName}</p>
            <p className="font-sans text-[0.65rem] uppercase tracking-[0.14em]" style={{ color: family.color }}>
              {family.name} Family
            </p>
          </div>
        </div>
        <p className="font-cinzel text-[0.6rem] uppercase tracking-[0.2em] text-muted">
          Chemistry of Virtue
        </p>
      </div>

      <h1 className="mt-5 text-center font-serif text-2xl text-ink">{pageTitle}</h1>
      {instructions && <p className="mt-1 text-center font-sans text-sm text-muted">{instructions}</p>}

      <div className="mt-6">{children}</div>

      <div className="mt-auto flex items-center justify-between border-t border-rule pt-3 text-[0.65rem] text-muted">
        <span>From the story &ldquo;{set.storyTitle}&rdquo; -- Chemistry for Families &amp; Kids</span>
        <span>avaia.org</span>
      </div>
    </div>
  );
}
