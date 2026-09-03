import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Organization Administrators — Admin — AVAIA" };
export const dynamic = "force-dynamic";

/** Grants Organization Administrator authorization -- platform-admin-only,
 *  matching every other authorization grant in this schema (guide
 *  certification, toolkit authorization). Not self-service, not
 *  Guide-granted. Finds the target account by email (same
 *  page-through-listUsers pattern already used elsewhere in this app)
 *  rather than requiring a raw id. */
async function grant(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/organization-admins");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/toolkit");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!email || !organizationId) {
    redirect(`/admin/organization-admins?error=${encodeURIComponent("Email and organization are both required.")}`);
  }

  const admin = createAdminClient();
  let targetId: string | null = null;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) {
      targetId = match.id;
      break;
    }
    if (data.users.length < 1000) break;
  }
  if (!targetId) {
    redirect(`/admin/organization-admins?error=${encodeURIComponent("No AVAIA account found for that email.")}`);
  }

  const { error } = await admin.from("organization_admins").upsert(
    {
      organization_id: organizationId,
      host_id: targetId,
      status: "authorized",
      granted_by: user.id,
      granted_at: new Date().toISOString(),
      status_changed_by: user.id,
      status_changed_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,host_id" }
  );
  if (error) {
    redirect(`/admin/organization-admins?error=${encodeURIComponent("Could not grant authorization.")}`);
  }

  redirect("/admin/organization-admins?granted=1");
}

async function revoke(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/organization-admins");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/toolkit");

  const id = String(formData.get("id") ?? "");
  const admin = createAdminClient();
  await admin
    .from("organization_admins")
    .update({ status: "revoked", status_changed_by: user.id, status_changed_at: new Date().toISOString() })
    .eq("id", id);

  redirect("/admin/organization-admins?revoked=1");
}

export default async function AdminOrganizationAdminsPage({
  searchParams,
}: {
  searchParams?: { error?: string; granted?: string; revoked?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/organization-admins");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/toolkit");

  const admin = createAdminClient();
  const { data: orgs } = await admin.from("organizations").select("id, name").order("name");
  const { data: grants } = await admin
    .from("organization_admins")
    .select("id, organization_id, host_id, status, granted_at")
    .order("granted_at", { ascending: false });

  const orgNameById = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const emailByHost = new Map<string, string>();
  for (const g of grants ?? []) {
    if (!emailByHost.has(g.host_id)) {
      const { data: u } = await admin.auth.admin.getUserById(g.host_id);
      emailByHost.set(g.host_id, u?.user?.email ?? g.host_id);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin" className="label hover:text-seal">
          ← Back to Admin
        </Link>
      </p>
      <p className="label mb-3">Admin</p>
      <h1 className="font-serif text-4xl text-ink">Organization Administrators</h1>
      <p className="mt-3 text-muted">
        Grants operational access to one organization&rsquo;s programs, Guides, and roster status.
        Never Guide access, never platform admin, never Host story content.
      </p>

      {searchParams?.granted && <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">Granted.</p>}
      {searchParams?.revoked && <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">Revoked.</p>}
      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {searchParams.error}
        </p>
      )}

      <form action={grant} className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5">
        <p className="label mb-3 text-muted">Grant</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            name="email"
            type="email"
            required
            placeholder="Account email"
            className="rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-sm text-ink outline-none focus:border-seal"
          />
          <select
            name="organizationId"
            required
            className="rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-sm text-ink outline-none focus:border-seal"
          >
            <option value="" className="bg-[#05060b]">
              — Select organization —
            </option>
            {(orgs ?? []).map((o) => (
              <option key={o.id} value={o.id} className="bg-[#05060b]">
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="mt-4 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Grant Organization Administrator
        </button>
      </form>

      <section className="mt-10">
        <p className="label mb-3 text-muted">Current grants</p>
        {(grants ?? []).length === 0 ? (
          <p className="text-muted">None yet.</p>
        ) : (
          <div className="space-y-2">
            {(grants ?? []).map((g) => (
              <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
                <div>
                  <p className="text-sm text-ink">
                    {emailByHost.get(g.host_id) ?? g.host_id} — {orgNameById.get(g.organization_id) ?? g.organization_id}
                  </p>
                  <p className="text-xs text-muted">{g.status}</p>
                </div>
                {g.status === "authorized" && (
                  <form action={revoke}>
                    <input type="hidden" name="id" value={g.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-rule px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/60 hover:text-red-300"
                    >
                      Revoke
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
