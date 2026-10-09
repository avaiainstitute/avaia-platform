import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isActivelyCertified, isCoordinationSupportAuthorized } from "@/lib/guide";
import { isGuideCoordinationEnabled } from "@/lib/ops/coordination-guide";
import SignOutButton from "@/components/SignOutButton";

export const metadata = { title: "Guide coordination, AVAIA" };
export const dynamic = "force-dynamic";

/** Gates the entire /guided-coordination tree, deliberately its own route, separate from /guided-journeys
 *  and /toolkit. Coordination support is an independent capability: nesting it under Guided Journeys would
 *  silently require Journey-facilitation authorization, which this does not. This gate checks the two
 *  account-level conditions (active certification and the coordination_support capability). The remaining
 *  conditions (an active, unexpired Host grant, and the item or entry inside that grant's scope) are checked
 *  by the database on every call, never here. The whole area stays closed until COORDINATION_GUIDE_ENABLED
 *  is exactly "true". */
export default async function GuidedCoordinationLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/guided-coordination");

  const { data: profile } = await supabase.from("profiles").select("consent_at").eq("id", user.id).maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");

  const [certified, authorized] = await Promise.all([
    isActivelyCertified(supabase, user.id),
    isCoordinationSupportAuthorized(supabase, user.id),
  ]);
  if (!certified || !authorized) redirect("/");

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <div className="flex items-baseline justify-between">
        <Link href="/guided-coordination" className="flex items-baseline gap-2.5">
          <span className="font-serif text-xl tracking-[0.16em] text-ink">AVAIA</span>
          <span className="label text-muted">Guide coordination</span>
        </Link>
        <SignOutButton />
      </div>
      <div className="mt-8">
        {isGuideCoordinationEnabled() ? (
          children
        ) : (
          <div>
            <h1 className="font-serif text-4xl text-ink">Guide coordination isn&rsquo;t open yet</h1>
            <p className="mt-4 text-lg text-muted">Nothing is available here yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
