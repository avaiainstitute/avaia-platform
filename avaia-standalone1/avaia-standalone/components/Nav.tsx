import Link from "next/link";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/journey", label: "Journey" },
  { href: "/workbook", label: "Workbook" },
  { href: "/chemistry", label: "Chemistry of Virtue" },
  { href: "/library", label: "Library" },
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
