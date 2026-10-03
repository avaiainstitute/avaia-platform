/** A calm, accessible progress bar for the certification classroom. Purely
 *  presentational. */
export default function CertificationProgressBar({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}) {
  const pct = total === 0 ? 0 : Math.min(100, Math.round((done / total) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
    >
      <div className="h-full rounded-full bg-seal transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
