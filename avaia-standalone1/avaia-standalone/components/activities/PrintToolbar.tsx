"use client";

import Link from "next/link";

export default function PrintToolbar({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className="no-print mx-auto mb-6 flex max-w-[8.5in] flex-wrap items-center justify-between gap-3 px-2">
      <Link href={backHref} className="font-sans text-sm text-muted hover:text-seal">
        ← {backLabel}
      </Link>
      <button
        onClick={() => window.print()}
        className="rounded-md bg-seal px-5 py-2 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
