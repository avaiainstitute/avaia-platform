import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConsentForm from "@/components/ConsentForm";

export const metadata = { title: "Welcome — AVAIA" };
// Every other server-rendered page that reads profiles.consent_at
// (journey, workbook, shared-with-me) has this — this one didn't. cookies()
// usage forces per-request rendering regardless, but that's a separate
// mechanism from Next's Data Cache, which still applies to the individual
// fetch() calls the Supabase client makes unless a route is force-dynamic.
// Without it, this page's read of consent_at could serve a stale cached
// result while /journey's (already force-dynamic) read stayed fresh — the
// two pages' redirect() calls are exact opposites of the same fact, so any
// disagreement between them bounces forever: ERR_TOO_MANY_REDIRECTS.
export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("consent_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.consent_at) redirect("/journey");

  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      <p className="label mb-3">Welcome</p>
      <h1 className="font-serif text-4xl text-ink">One thing before we begin</h1>
      <p className="mt-4 text-lg text-muted">
        AVAIA is a guided, virtue-centered conversation — not therapy. Please read
        this and confirm you understand.
      </p>
      <ConsentForm />
    </div>
  );
}
