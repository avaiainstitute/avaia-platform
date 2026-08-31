import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isActivelyCertified, isGuidedJourneyFacilitationAuthorized } from "@/lib/guide";
import SignOutButton from "@/components/SignOutButton";

export const metadata = { title: "Guided Journeys — AVAIA" };
export const dynamic = "force-dynamic";

/** Gates the entire /guided-journeys tree -- deliberately its own route,
 *  separate from /toolkit. Toolkit authorization and Guided Journey
 *  Facilitation authorization are independent professional capabilities
 *  (see lib/guide.ts); nesting this under /toolkit would have silently
 *  added a fourth, unintended requirement (Toolkit access) on top of the
 *  three the Phase E.4 architecture actually specifies. This gate checks
 *  exactly the two account-level conditions those RLS policies
 *  (0029_guide_journey_read_access.sql) also require -- active
 *  certification and authorized guided_journey_facilitation -- nothing
 *  about Toolkit. The third condition (an active Host invitation for one
 *  specific Journey) is necessarily per-journey and is checked by that
 *  Journey's own RLS-protected query in app/guided-journeys/[journeyId]/,
 *  not here. */
export default async function GuidedJourneysLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/guided-journeys");

  const { data: profile } = await supabase
    .from("profiles")
    .select("consent_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");

  const [certified, authorized] = await Promise.all([
    isActivelyCertified(supabase, user.id),
    isGuidedJourneyFacilitationAuthorized(supabase, user.id),
  ]);
  if (!certified || !authorized) redirect("/");

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <div className="flex items-baseline justify-between">
        <Link href="/guided-journeys" className="flex items-baseline gap-2.5">
          <span className="font-serif text-xl tracking-[0.16em] text-ink">AVAIA</span>
          <span className="label text-muted">Guided Journeys</span>
        </Link>
        <SignOutButton />
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
