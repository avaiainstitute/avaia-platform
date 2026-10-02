import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isGuideToolkitAuthorized } from "@/lib/guide";
import SignOutButton from "@/components/SignOutButton";

export const metadata = { title: "Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

/** Gates the entire /toolkit tree. Independent of membership_status --
 *  a certified Guide doesn't need to also be a paying AVAIA member. Not
 *  linked from the global Nav in this build; reachable only by URL, the
 *  same way an admin area would be before it's ready to advertise.
 *
 *  Guide Operations Agent correction: this previously redirected only on
 *  `profile.role !== "guide"` -- a pure role check. An audit found a live
 *  profiles row with role='guide' and no guide_certifications record at
 *  all, which that check alone would have let into the entire Toolkit.
 *  isGuideToolkitAuthorized additionally requires active certification
 *  standing and an explicit, currently-authorized 'toolkit' platform
 *  authorization -- the smallest additive correction, not a new policy:
 *  both of those already-established records existed in the schema and
 *  were simply never read here. */
export default async function ToolkitLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const { data: profile } = await supabase
    .from("profiles")
    .select("consent_at, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");
  if (!(await isGuideToolkitAuthorized(supabase, user.id))) redirect("/");

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <div className="flex items-baseline justify-between">
        <Link href="/toolkit" className="flex items-baseline gap-2.5">
          <span className="font-serif text-xl tracking-[0.16em] text-ink">AVAIA</span>
          <span className="label text-muted">Guide Toolkit</span>
        </Link>
        <SignOutButton />
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
