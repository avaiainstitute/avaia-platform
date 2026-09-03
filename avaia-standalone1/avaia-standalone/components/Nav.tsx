import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isToolkitAuthorized } from "@/lib/guide";
import SignOutButton from "@/components/SignOutButton";

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
// this Nav being auth-aware instead of one static list. Left completely
// unchanged by the role-based navigation pass below.
const PUBLIC_LINKS: NavLink[] = [
  { href: "/", label: "Home", prefetch: true },
  { href: "/about", label: "About", prefetch: true },
  { href: "/defying-grief", label: "Defying Grief", prefetch: false },
  { href: "/chemistry", label: "Chemistry of Virtue", prefetch: true },
  { href: "/unsung-heroes", label: "Unsung Heroes", prefetch: false },
  { href: "/membership", label: "Membership", prefetch: true },
  { href: "/contact", label: "Contact", prefetch: true },
  { href: "/sign-in", label: "Sign in", prefetch: true },
];

// Signed-in Host navigation, split into two visual tiers rather than one
// flat list of equal weight. Primary = continuity/participation (what the
// returning-member reconciliation was about); secondary = the same public/
// program destinations as before, still one click away, just no longer
// competing visually with Home/Journey/Workbook/Library. Both tiers still
// render as ordinary flex-wrap lists -- the same responsive mechanism the
// Nav already used, not a new dropdown/menu component. Shared with Me isn't
// here -- it's reachable from Workbook instead (where the sharing feature
// itself lives), not as a top-level destination.
const HOST_PRIMARY_LINKS: NavLink[] = [
  { href: "/", label: "Home", prefetch: true },
  { href: "/journey", label: "Journey", prefetch: false },
  { href: "/workbook", label: "Workbook", prefetch: false },
  { href: "/library", label: "Library", prefetch: false },
];

const HOST_SECONDARY_LINKS: NavLink[] = [
  { href: "/defying-grief", label: "Defying Grief", prefetch: false },
  { href: "/chemistry", label: "Chemistry of Virtue", prefetch: true },
  { href: "/signature", label: "Virtue Signature", prefetch: false },
  { href: "/unsung-heroes", label: "Unsung Heroes", prefetch: false },
  { href: "/membership", label: "Membership", prefetch: true },
  { href: "/contact", label: "Contact", prefetch: true },
];

export default async function Nav() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Phase D.3: matches app/toolkit/layout.tsx's real authorization gate
  // (guide_platform_authorizations, not profiles.role) purely for nav
  // discoverability -- showing or hiding this link changes nothing about
  // who can actually reach /toolkit; someone not authorized typing the URL
  // is still redirected there exactly as before.
  let toolkitAuthorized = false;
  let isAdmin = false;
  let isOrgAdmin = false;
  if (user) {
    toolkitAuthorized = await isToolkitAuthorized(supabase, user.id);
    // Same purely-for-discoverability posture as toolkitAuthorized above --
    // /admin and its sub-pages already re-check profiles.role themselves
    // (this changes nothing about who can actually reach them). Found
    // during the admin/Guide usability pass: /admin/* existed with no link
    // into it from anywhere in the app at all.
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    isAdmin = profile?.role === "admin";
    // Same discoverability-only posture -- /org-admin/* re-checks
    // organization_admins itself. A cheap existence check (not which/how
    // many organizations) is enough to decide whether to show the link.
    const { data: orgAdminRow } = await supabase
      .from("organization_admins")
      .select("id")
      .eq("host_id", user.id)
      .eq("status", "authorized")
      .limit(1)
      .maybeSingle();
    isOrgAdmin = !!orgAdminRow;
  }

  return (
    <header className="rule-t border-b border-rule bg-parchment/80 backdrop-blur sticky top-0 z-10">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="font-serif text-2xl tracking-[0.18em] text-ink">AVAIA</span>
          <span className="hidden font-cinzel text-[0.6rem] uppercase tracking-[0.18em] text-phoenix sm:inline">
            Clarity Starts With Integrity
          </span>
        </Link>

        {user ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {HOST_PRIMARY_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    prefetch={l.prefetch}
                    className="label text-ink hover:text-seal transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 border-l border-rule pl-6">
              {HOST_SECONDARY_LINKS.map((l) => (
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
              {toolkitAuthorized && (
                <li>
                  <Link
                    href="/toolkit"
                    prefetch={false}
                    className="label text-seal hover:opacity-80 transition-opacity"
                  >
                    Guide
                  </Link>
                </li>
              )}
              {isOrgAdmin && (
                <li>
                  <Link
                    href="/org-admin"
                    prefetch={false}
                    className="label text-seal hover:opacity-80 transition-opacity"
                  >
                    Org Admin
                  </Link>
                </li>
              )}
              {isAdmin && (
                <li>
                  <Link
                    href="/admin"
                    prefetch={false}
                    className="label text-seal hover:opacity-80 transition-opacity"
                  >
                    Admin
                  </Link>
                </li>
              )}
              <li>
                <SignOutButton />
              </li>
            </ul>
          </div>
        ) : (
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {PUBLIC_LINKS.map((l) => (
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
        )}
      </nav>
    </header>
  );
}
