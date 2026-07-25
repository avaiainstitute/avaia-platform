import type { Pending } from "@/lib/institution";

/**
 * Renders an author-facing marker for content the source documents reference
 * but have not yet supplied. Making the gap visible (rather than fabricating
 * the institution's canon) is intentional.
 */
export default function PendingNote({ pending }: { pending: Pending }) {
  return (
    <div className="rounded-md border border-dashed border-rule bg-white/[0.04] backdrop-blur-sm px-4 py-3">
      <p className="label mb-1 text-seal">Awaiting source material</p>
      <p className="text-sm text-ink">{pending.need}</p>
      <p className="mt-1 text-xs text-muted">Referenced in: {pending.referencedIn}</p>
    </div>
  );
}
