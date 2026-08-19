import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listGuideParticipants } from "@/lib/guide";

export const metadata = { title: "Preparation — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

/** Picks which participant to prepare for -- the same listGuideParticipants
 *  the dashboard already uses. Preparation itself lives at
 *  /toolkit/preparation/[participantId]; this page exists so "Preparation"
 *  is reachable from the tool registry without already having a
 *  participant selected. */
export default async function PreparationPickerPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const participants = await listGuideParticipants(supabase, user.id);

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Preparation</p>
      <h1 className="font-serif text-4xl text-ink">Who are you preparing for?</h1>
      <p className="mt-4 text-lg text-muted">
        Organizes what&rsquo;s already on record for a participant before a session. It never
        interprets, diagnoses, or decides what the conversation should discover -- only what has
        already, explicitly, been recorded.
      </p>

      {participants.length === 0 ? (
        <p className="mt-12 text-muted">
          No participants yet. Start a session with someone from the Dashboard first.
        </p>
      ) : (
        <div className="mt-10 space-y-2">
          {participants.map((p) => (
            <Link
              key={p.id}
              href={`/toolkit/preparation/${p.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3 transition-colors hover:border-seal"
            >
              <div>
                <p className="text-ink">{p.name}</p>
                <p className="text-xs text-muted">{p.email ?? "No email on file"}</p>
              </div>
              <span className="label text-muted">Prepare →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
