import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveCandidateForHost } from "@/lib/certification";
import CertificationCompanionChat from "@/components/CertificationCompanionChat";

export const metadata = { title: "Certification Companion — AVAIA" };
export const dynamic = "force-dynamic";

export default async function CertificationCompanionPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/certification/companion");

  const candidate = await getActiveCandidateForHost(supabase, user.id);
  if (!candidate) {
    return (
      <div>
        <p className="label mb-3">Certification Companion</p>
        <h1 className="font-serif text-4xl text-ink">Not currently available</h1>
        <p className="mt-4 text-lg text-muted">
          The Certification Companion is available to candidates with an open AVAIA Guide
          Certification candidacy. If you believe this is a mistake, reach out to AVAIA directly.
        </p>
      </div>
    );
  }

  const { data: existingConvo } = await supabase
    .from("certification_companion_conversations")
    .select("id")
    .eq("candidate_id", candidate.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let initialMessages: { role: "candidate" | "companion"; content: string }[] = [];
  if (existingConvo) {
    const { data: rows } = await supabase
      .from("certification_companion_messages")
      .select("role, content")
      .eq("conversation_id", existingConvo.id)
      .order("created_at", { ascending: true });
    initialMessages = (rows ?? []) as { role: "candidate" | "companion"; content: string }[];
  }

  return (
    <div>
      <p className="label mb-3">Certification Companion</p>
      <h1 className="font-serif text-4xl text-ink">Welcome back.</h1>
      <p className="mt-4 text-lg text-muted">
        Ask about any lesson or Practice Lab, check where you left off, or pick back up on your
        AVAIA Guide Certification work. Candidacy status: <span className="text-ink">{candidate.status}</span>.
      </p>
      <CertificationCompanionChat
        initialMessages={initialMessages}
        initialConversationId={existingConvo?.id ?? null}
      />
    </div>
  );
}
