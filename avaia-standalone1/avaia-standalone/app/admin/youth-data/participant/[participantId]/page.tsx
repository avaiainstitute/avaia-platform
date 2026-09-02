import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteYouthParticipantData } from "@/lib/youth-data-deletion";

export const dynamic = "force-dynamic";

async function confirmDelete(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/youth-data");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/toolkit");

  const participantId = String(formData.get("participantId") ?? "");
  if (formData.get("confirmText") !== "DELETE") {
    redirect(`/admin/youth-data/participant/${participantId}?error=${encodeURIComponent('Type DELETE exactly to confirm.')}`);
  }

  const admin = createAdminClient();
  const counts = await deleteYouthParticipantData(admin, participantId);

  redirect(`/admin/youth-data?deleted=${encodeURIComponent(JSON.stringify(counts))}`);
}

export default async function AdminYouthDataParticipantPage({
  params,
  searchParams,
}: {
  params: { participantId: string };
  searchParams?: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/youth-data");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/toolkit");

  const { data: participant } = await supabase
    .from("guide_participants")
    .select("id, name, email, developmental_band, created_at")
    .eq("id", params.participantId)
    .maybeSingle();
  if (!participant) notFound();

  const [{ count: sessionCount }, { count: consentCount }, { count: programCount }] = await Promise.all([
    supabase.from("guide_sessions").select("id", { count: "exact", head: true }).eq("participant_id", participant.id),
    supabase
      .from("guardian_consents")
      .select("id", { count: "exact", head: true })
      .eq("guide_participant_id", participant.id),
    supabase
      .from("youth_program_participants")
      .select("id", { count: "exact", head: true })
      .eq("participant_id", participant.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin/youth-data" className="label hover:text-seal">
          ← Back to Youth Data
        </Link>
      </p>
      <p className="label mb-3">Admin — Youth Data</p>
      <h1 className="font-serif text-4xl text-ink">{participant.name}</h1>
      <p className="mt-2 text-muted">
        {participant.email ?? "No email on file"} · Band: {participant.developmental_band ?? "not set"} · On record
        since {new Date(participant.created_at).toLocaleDateString()}
      </p>

      <div className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5">
        <p className="label mb-3 text-muted">What will be deleted</p>
        <ul className="space-y-1 text-sm text-ink">
          <li>{sessionCount ?? 0} Guide session(s) — and every conversation, message, and referral they reached</li>
          <li>{consentCount ?? 0} Guardian consent record(s)</li>
          <li>{programCount ?? 0} Program registration(s)</li>
          <li>The participant record itself</li>
        </ul>
      </div>

      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {searchParams.error}
        </p>
      )}

      <form action={confirmDelete} className="mt-8 rounded-lg border border-red-500/40 bg-red-500/[0.06] p-5">
        <input type="hidden" name="participantId" value={participant.id} />
        <p className="mb-3 text-sm text-ink">This cannot be undone. Type DELETE to confirm.</p>
        <input
          name="confirmText"
          type="text"
          required
          className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-red-400"
        />
        <button
          type="submit"
          className="mt-4 rounded-md bg-red-600 px-5 py-2.5 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Permanently Delete
        </button>
      </form>
    </div>
  );
}
