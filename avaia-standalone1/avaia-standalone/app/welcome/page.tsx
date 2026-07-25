import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConsentForm from "@/components/ConsentForm";

export const metadata = { title: "Welcome — AVAIA" };

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
