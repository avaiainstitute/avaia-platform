"use client";

import { useRouter } from "next/navigation";

/** The only interactive pieces of a Defying Grief print page -- a format
 *  switcher (facilitator packet only) and the Print button. Everything
 *  else on these pages is a plain Server Component; this exists solely
 *  because Server Components can't hold onChange/onClick handlers. */
export function PrintFormatSelect({
  formats,
  selectedFormatId,
}: {
  formats: { id: string; title: string }[];
  selectedFormatId: string | null;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="format" className="label text-muted">
        Format
      </label>
      <select
        id="format"
        defaultValue={selectedFormatId ?? ""}
        onChange={(e) => router.push(`?format=${encodeURIComponent(e.target.value)}`)}
        className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink"
      >
        {formats.map((f) => (
          <option key={f.id} value={f.id} className="bg-[#05060b] text-ink">
            {f.title}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
    >
      {label}
    </button>
  );
}
