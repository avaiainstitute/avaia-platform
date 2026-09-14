import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EXPERIENCE_LABEL, GROUP_TYPE_LABEL, type ExperienceType, type GroupType } from "@/lib/experiences-agent";

export const metadata = { title: "Programs & Experiences Inquiries, AVAIA Admin" };
export const dynamic = "force-dynamic";

// Agent 8 (Programs & Experiences) inbound: everyone who has asked to
// bring an established AVAIA offering to their group via /contact's
// "Bring a Program/Experience to My Group" reason (components/
// ContactForm.tsx, posting to app/api/experiences/inquiry -- the former
// standalone /experiences page now redirects there, consolidated into the
// site's single Contact doorway). Same admin-role-gated-then-service-role
// posture as app/admin/opportunities, for the same reason:
// avaia_experience_inquiries carries zero RLS policies for any signed-in role.

const STATUSES = ["new", "acknowledged", "in_progress", "scheduled", "completed", "not_a_fit"] as const;

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/programs");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
}

async function updateInquiry(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    redirect("/admin/programs?error=invalid");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("avaia_experience_inquiries")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("Admin programs: update failed:", error.message);
    redirect("/admin/programs?error=update_failed");
  }
  redirect("/admin/programs?updated=1");
}

export default async function AdminProgramsPage({
  searchParams,
}: {
  searchParams: { error?: string; updated?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/programs");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const { data: inquiries } = await admin
    .from("avaia_experience_inquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(150);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin" className="label hover:text-seal">
          ← Back to Admin
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">Programs & Experiences Inquiries</h1>
      <p className="mt-4 text-lg text-muted">
        Inbound requests to bring an established AVAIA Program or Experience to a group,
        submitted through{" "}
        <Link href="/contact" className="underline">
          /contact
        </Link>{" "}
        (reason: &ldquo;Bring a Program/Experience to My Group&rdquo;).
      </p>

      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          Something went wrong. Please try again.
        </p>
      )}
      {searchParams?.updated && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">Saved.</p>
      )}

      {!inquiries || inquiries.length === 0 ? (
        <p className="mt-10 text-muted">No inquiries yet.</p>
      ) : (
        <div className="mt-10 space-y-3">
          {inquiries.map((i) => (
            <details key={i.id} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <span className="text-ink">
                  {i.name}
                  {i.organization_name ? <span className="ml-2 text-xs text-muted">({i.organization_name})</span> : null}
                </span>
                <span className="label text-seal">{i.status.replace(/_/g, " ")}</span>
              </summary>
              <div className="mt-3 space-y-1 text-sm text-muted">
                <p>Email: {i.email}</p>
                {i.phone && <p>Phone: {i.phone}</p>}
                <p>Group type: {GROUP_TYPE_LABEL[i.group_type as GroupType] ?? i.group_type}</p>
                {i.approx_group_size && <p>Approx. group size: {i.approx_group_size}</p>}
                {i.location && <p>Location: {i.location}</p>}
                <p>Interested in: {EXPERIENCE_LABEL[i.experience_interest as ExperienceType] ?? i.experience_interest}</p>
                {i.request_details && <p style={{ whiteSpace: "pre-wrap" }}>Details: {i.request_details}</p>}
                <p>Received: {new Date(i.created_at).toLocaleString()}</p>
              </div>
              <form action={updateInquiry} className="mt-4 flex items-center gap-3">
                <input type="hidden" name="id" value={i.id} />
                <select
                  name="status"
                  defaultValue={i.status}
                  className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-[#05060b] text-ink">
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-md bg-seal px-4 py-2 text-sm font-semibold text-[#05060b] hover:opacity-90"
                >
                  Save
                </button>
              </form>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
