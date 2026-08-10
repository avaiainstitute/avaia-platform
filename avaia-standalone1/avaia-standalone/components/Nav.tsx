import Link from "next/link";

// /journey, /defying-grief, /workbook, and /shared-with-me all render
// completely differently signed in vs signed out. Next prefetches links by
// default on viewport/hover — since this Nav renders on every page,
// including pre-auth ones like /sign-in, that would cache the SIGNED-OUT
// render of these routes in the client-side Router Cache before the Host
// ever signs in, and later navigation to them (even once actually signed in)
// can serve that stale anonymous snapshot instead of refetching.
// prefetch={false} keeps every visit to these routes a real request.
const LINKS: { href: string; label: string; prefetch: boolean }[] = [
  { href: "/about", label: "About", prefetch: true },
  { href: "/journey", label: "Journey", prefetch: false },
  { href: "/defying-grief", label: "Defying Grief", prefetch: false },
  { href: "/workbook", label: "Workbook", prefetch: false },
  { href: "/shared-with-me", label: "Shared with Me", prefetch: false },
  { href: "/chemistry", label: "Chemistry of Virtue", prefetch: true },
];

export default function Nav() {
  return (
    <header className="rule-t border-b border-rule bg-parchment/80 backdrop-blur sticky top-0 z-10">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="font-serif text-2xl tracking-[0.18em] text-ink">AVAIA</span>
          <span className="hidden font-cinzel text-[0.6rem] uppercase tracking-[0.18em] text-phoenix sm:inline">
            Clarity Starts With Integrity
          </span>
        </Link>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                prefetch={l.prefetch}
                className="label hover:text-seal transition-colors"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
