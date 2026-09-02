import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isToolkitAuthorized } from "@/lib/guide";
import SignOutButton from "@/components/SignOutButton";

export const metadata = { title: "Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

/** Gates the entire /toolkit tree. Independent of membership_status --
 *  a certified Guide doesn't need to also be a paying AVAIA member.
 *
 *  Phase D.3: authorization now comes from guide_platform_authorizations
 *  (capability='toolkit', status='authorized') via isToolkitAuthorized(),
 *  not from profiles.role. profiles.role = 'guide' is no longer sufficient
 *  on its own to reach the Toolkit -- certification (guide_certifications)
 *  and platform authorization are separate institutional facts, and this
 *  gate now checks the authorization, the same fact Phase D.2's admin
 *  grant actually records. No admin bypass existed here before this
 *  change (an admin whose role is 'admin' was already redirected the same
 *  as anyone else, since profiles.role can only ever hold one value) --
 *  none is added now either; that stays a separate, later decision if
 *  ever wanted. */
export default async function ToolkitLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const { data: profile } = await supabase
    .from("profiles")
    .select("consent_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");
  if (!(await isToolkitAuthorized(supabase, user.id))) redirect("/");

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      {/* id="toolkit-chrome" is a print-CSS hook only -- any /toolkit/**
          print view hides this via @media print rather than escaping this
          shared layout, so every print route still inherits the ordinary
          Toolkit authorization gate above with no duplicated auth check. */}
      <div id="toolkit-chrome" className="flex items-baseline justify-between">
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
