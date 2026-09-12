"use client";

import Link from "next/link";

/** A grouped nav entry, native <details>/<summary> rather than a hand-rolled
 *  open/close state + click-outside listener: keyboard-accessible, works
 *  with JS disabled, and needs no client-side state management at all for
 *  something this simple. Used wherever the Nav groups several related
 *  destinations under one label instead of listing each as its own
 *  top-level link, see components/Nav.tsx's own comment on why that
 *  flat-list pattern was replaced. */
export default function NavDropdown({
  label,
  labelClassName,
  links,
}: {
  label: string;
  labelClassName?: string;
  links: { href: string; label: string }[];
}) {
  return (
    <details className="group relative inline-block">
      <summary
        className={`label cursor-pointer list-none transition-colors hover:text-seal ${labelClassName ?? "text-ink"}`}
      >
        {label}
      </summary>
      <ul className="absolute left-0 top-full z-20 mt-2 min-w-[13rem] rounded-md border border-rule bg-parchment p-2 shadow-lg">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} prefetch={false} className="label block rounded px-3 py-2 text-ink hover:bg-white/[0.06] hover:text-seal">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
