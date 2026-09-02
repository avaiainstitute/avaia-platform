import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteYouthHostData } from "@/lib/youth-data-deletion";

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

  const hostId = String(formData.get("hostId") ?? "");
  if (formData.get("confirmText") !== "DELETE") {
    redirect(`/admin/youth-data/host/${hostId}?error=${encodeURIComponent("Type DELETE exactly to confirm.")}`);
  }

  const admin = createAdminClient();
  const counts = await deleteYouthHostData(admin, hostId);

  redirect(`/admin/youth-data?deleted=${encodeURIComponent(JSON.stringify(counts))}`);
}

export default async function AdminYouthDataHostPage({
  params,
  searchParams,
}: {
  params: { hostId: string };
  searchParams?: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/youth-data");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/toolkit");

  const admin = createAdminClient();
  const { data: userData } = await admin.auth.admin.getUserById(params.hostId);
  const email = userData?.user?.email ?? "Unknown";

  const { count: convoCount } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("host_id", params.hostId)
    .eq("program", "youth");
  const { count: consentCount } = await supabase
    .from("guardian_consents")
    .select("id", { count: "exact", head: true })
    .eq("youth_host_id", params.hostId);

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin/youth-data" className="label hover:text-seal">
          ← Back to Youth Data
        </Link>
      </p>
      <p className="label mb-3">Admin — Youth Data</p>
      <h1 className="font-serif text-4xl text-ink">{email}</h1>
      <p className="mt-2 text-muted">Self-serve Youth Host</p>

      <div className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5">
        <p className="label mb-3 text-muted">What will be deleted</p>
        <ul className="space-y-1 text-sm text-ink">
          <li>{convoCount ?? 0} Youth (program=&lsquo;youth&rsquo;) conversation(s) — and their messages, referrals, journeys</li>
          <li>{consentCount ?? 0} Guardian consent record(s)</li>
          <li>The developmental band on this account&rsquo;s profile</li>
        </ul>
        <p className="mt-3 text-xs text-muted">
          This does not delete the account itself or any non-Youth (adult/general) conversations —
          only the Youth-linked record.
        </p>
      </div>

      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {searchParams.error}
        </p>
      )}

      <form action={confirmDelete} className="mt-8 rounded-lg border border-red-500/40 bg-red-500/[0.06] p-5">
        <input type="hidden" name="hostId" value={params.hostId} />
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
          Permanently Delete Youth-Linked Data
        </button>
      </form>
    </div>
  );
}
