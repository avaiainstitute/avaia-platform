import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isToolkitAuthorized } from "@/lib/guide";
import { findActiveRoomForHost } from "@/lib/engine/room";
import SignOutButton from "@/components/SignOutButton";
import NavDropdown from "@/components/NavDropdown";

// /journey, /defying-grief, /workbook, and /unsung-heroes all render
// completely differently signed in vs signed out. Next prefetches links by
// default on viewport/hover, since this Nav renders on every page, that
// would cache the SIGNED-OUT render of these routes in the client-side
// Router Cache before the Host ever signs in, and later navigation to them
// (even once actually signed in) can serve that stale anonymous snapshot
// instead of refetching. prefetch={false} keeps every visit a real request.
type NavLink = { href: string; label: string };

// The 3 Programs, per the AVAIA architecture reconciliation: Defying Grief,
// Unsung Heroes, and The View From Above are what a Host actually joins and
// experiences. Everything else (Chemistry, Virtue Signature, What Still
// Needs to Be Said, Workbook, Library, Shared Room) is an AVAIA Toolkit
// tool a Program uses, not a destination in its own right, so it never
// appears inside this same grouping.
const PROGRAMS: NavLink[] = [
  { href: "/defying-grief", label: "Defying Grief" },
  { href: "/unsung-heroes", label: "Unsung Heroes" },
  { href: "/view-from-above", label: "The View from Above" },
];

// Everything a signed-in Host might reach outside the Programs themselves,
// grouped under one menu rather than each sitting at the top level. See
// this file's own history: a flat list of 8-10 equally-weighted links was
// the exact "giant list" problem the role-based navigation pass replaced.
const HOST_TOOLKIT_LINKS: NavLink[] = [
  { href: "/workbook", label: "Workbook" },
  { href: "/signature", label: "Virtue Signature" },
  { href: "/still-needs-to-be-said", label: "What Still Needs to Be Said" },
  { href: "/journey", label: "Continue Your Journey" },
];

export default async function Nav() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Phase D.3: matches app/toolkit/layout.tsx's real authorization gate
  // (guide_platform_authorizations, not profiles.role) purely for nav
  // discoverability, showing or hiding this link changes nothing about
  // who can actually reach /toolkit; someone not authorized typing the URL
  // is still redirected there exactly as before.
  let toolkitAuthorized = false;
  let isAdmin = false;
  let isOrgAdmin = false;
  let activeRoomJoinPath: string | null = null;
  if (user) {
    toolkitAuthorized = await isToolkitAuthorized(supabase, user.id);
    // Same purely-for-discoverability posture as toolkitAuthorized above,
    // /admin and its sub-pages already re-check profiles.role themselves
    // (this changes nothing about who can actually reach them). Found
    // during the admin/Guide usability pass: /admin/* existed with no link
    // into it from anywhere in the app at all.
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    isAdmin = profile?.role === "admin";
    // Same discoverability-only posture, /org-admin/* re-checks
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
    // Shared Room, Part 2: a Host is sometimes also a seated participant in
    // someone else's Room (guide_participants.linked_host_id, an existing
    // mechanism, see lib/guide.ts). Only shown when that's actually true
    // right now, see findActiveRoomForHost's own comment.
    const activeRoom = await findActiveRoomForHost(user.id);
    activeRoomJoinPath = activeRoom?.joinPath ?? null;
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
              <li>
                <Link href="/" prefetch className="label text-ink hover:text-seal transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/library" prefetch={false} className="label text-ink hover:text-seal transition-colors">
                  Library
                </Link>
              </li>
              <li>
                <NavDropdown label="Programs" links={PROGRAMS} />
              </li>
              <li>
                <NavDropdown label="My AVAIA" links={HOST_TOOLKIT_LINKS} />
              </li>
              {activeRoomJoinPath && (
                <li>
                  <Link href={activeRoomJoinPath} className="label text-ink hover:text-seal transition-colors">
                    Shared Room
                  </Link>
                </li>
              )}
            </ul>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 border-l border-rule pl-6">
              <li>
                <Link href="/membership" prefetch className="label hover:text-seal transition-colors">
                  Membership
                </Link>
              </li>
              <li>
                <Link href="/contact" prefetch className="label hover:text-seal transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/account" prefetch={false} className="label hover:text-seal transition-colors">
                  Account
                </Link>
              </li>
              {toolkitAuthorized && (
                <li>
                  <Link
                    href="/toolkit"
                    prefetch={false}
                    className="label text-seal hover:opacity-80 transition-opacity"
                  >
                    Guide Toolkit
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
            <li>
              <Link href="/" prefetch className="label hover:text-seal transition-colors">
                Home
              </Link>
            </li>
            <li>
              <Link href="/about" prefetch className="label hover:text-seal transition-colors">
                About
              </Link>
            </li>
            <li>
              <NavDropdown label="Programs" labelClassName="text-muted" links={PROGRAMS} />
            </li>
            <li>
              <Link href="/chemistry" prefetch className="label hover:text-seal transition-colors">
                The Chemistry of Virtue
              </Link>
            </li>
            <li>
              <Link href="/contact" prefetch className="label hover:text-seal transition-colors">
                Contact
              </Link>
            </li>
            <li>
              <Link href="/sign-in" prefetch className="label hover:text-seal transition-colors">
                Sign in
              </Link>
            </li>
          </ul>
        )}
      </nav>
    </header>
  );
}
