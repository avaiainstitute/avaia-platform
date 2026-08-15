import Link from "next/link";

const STAGES = [
  { key: "iap", label: "Awareness", href: "/journey/iap" },
  { key: "cat", label: "Understanding", href: "/journey/cat" },
  { key: "innercompass", label: "Agency", href: "/journey/innercompass" },
] as const;

/** Shared progress indicator for the three Journey explanation pages. Purely
 *  informational -- these are static explanation pages, not a live
 *  conversation's actual status, so every other stage stays a plain link
 *  rather than showing complete/in-progress state. */
export default function JourneyStageProgress({
  current,
}: {
  current: "iap" | "cat" | "innercompass";
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {STAGES.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          {s.key === current ? (
            <span className="font-sans text-xs font-semibold uppercase tracking-wide text-seal">
              {s.label}
            </span>
          ) : (
            <Link
              href={s.href}
              prefetch={true}
              className="font-sans text-xs uppercase tracking-wide text-muted transition-colors hover:text-seal"
            >
              {s.label}
            </Link>
          )}
          {i < STAGES.length - 1 && <span className="text-muted">→</span>}
        </li>
      ))}
    </ol>
  );
}
