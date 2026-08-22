import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// /journey, /defying-grief, /workbook, and /unsung-heroes all render
// completely differently signed in vs signed out. Next prefetches links by
// default on viewport/hover — since this Nav renders on every page, that
// would cache the SIGNED-OUT render of these routes in the client-side
// Router Cache before the Host ever signs in, and later navigation to them
// (even once actually signed in) can serve that stale anonymous snapshot
// instead of refetching. prefetch={false} keeps every visit a real request.
type NavLink = { href: string; label: string; prefetch: boolean };

// Signed-out visitors only need enough to understand AVAIA, understand
// Defying Grief, and begin -- not the full signed-in toolset (Workbook,
// Shared with Me) sitting in front of them before they've done anything.
// Unsung Heroes belongs here now that its signed-out page (see
// UnsungHeroesIntro.tsx) actually explains what it is, instead of being a
// bare "sign in to begin" stub. That distinction is the whole point of
// this Nav being auth-aware instead of one static list.
const PUBLIC_LINKS: NavLink[] = [
  { href: "/about", label: "About", prefetch: true },
  { href: "/defying-grief", label: "Defying Grief", prefetch: false },
  { href: "/chemistry", label: "Chemistry of Virtue", prefetch: true },
  { href: "/unsung-heroes", label: "Unsung Heroes", prefetch: false },
  { href: "/contact", label: "Contact", prefetch: true },
  { href: "/sign-in", label: "Sign in", prefetch: true },
];

// Shared with Me isn't here -- it's reachable from Workbook instead (where
// the sharing feature itself lives), not as a top-level destination.
const SIGNED_IN_LINKS: NavLink[] = [
  { href: "/journey", label: "Journey", prefetch: false },
  { href: "/defying-grief", label: "Defying Grief", prefetch: false },
  { href: "/workbook", label: "Workbook", prefetch: false },
  { href: "/library", label: "Library", prefetch: false },
  { href: "/chemistry", label: "Chemistry of Virtue", prefetch: true },
  { href: "/unsung-heroes", label: "Unsung Heroes", prefetch: false },
  { href: "/contact", label: "Contact", prefetch: true },
];

export default async function Nav() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const links = user ? SIGNED_IN_LINKS : PUBLIC_LINKS;

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
          {links.map((l) => (
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
