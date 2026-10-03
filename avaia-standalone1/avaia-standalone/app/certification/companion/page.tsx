import Link from "next/link";
import { requireClassroomCandidate } from "@/lib/certification-access";
import CertificationCompanionChat from "@/components/CertificationCompanionChat";

export const metadata = { title: "Certification Companion, AVAIA" };
export const dynamic = "force-dynamic";

export default async function CertificationCompanionPage() {
  const { supabase, candidate } = await requireClassroomCandidate("/certification/companion");

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
      <p className="mb-6">
        <Link href="/certification" className="label hover:text-seal">
          ← Your Certification
        </Link>
      </p>
      <p className="label mb-3 text-muted">Certification Companion</p>
      <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">Ask about the material</h1>
      <p className="mt-4 max-w-prose text-lg leading-relaxed text-muted">
        Ask about any lesson or Practice Lab, or find your place. The Companion supports your learning. It does not replace reading
        the lessons, writing your reflections, running the Practice Labs, the Boundary Gate, the Observed Practicum, or any decision a
        person at AVAIA makes.
      </p>
      <CertificationCompanionChat initialMessages={initialMessages} initialConversationId={existingConvo?.id ?? null} />
    </div>
  );
}
