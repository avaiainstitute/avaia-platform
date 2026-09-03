import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAdministeredOrganizationIds } from "@/lib/organization-admin";

export const metadata = { title: "My Organizations — AVAIA" };
export const dynamic = "force-dynamic";

/** "MY ORGANIZATIONS" -- the top of the Organization Administrator
 *  dashboard hierarchy. Uses the caller's own RLS-scoped client for the
 *  authorization lookup itself (organization_admins' self-read policy is
 *  sufficient) and the admin client only to resolve organization names --
 *  organizations is already readable by any toolkit-authorized Guide, but
 *  an Organization Administrator is a separate identity who may hold no
 *  Guide authorization at all, so this doesn't assume that policy covers
 *  them. */
export default async function OrgAdminIndexPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/org-admin");

  const orgIds = await listAdministeredOrganizationIds(supabase, user.id);

  if (orgIds.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <p className="label mb-3">Organization Administration</p>
        <h1 className="font-serif text-4xl text-ink">My Organizations</h1>
        <p className="mt-4 text-muted">
          You aren&rsquo;t currently authorized to administer any AVAIA organization.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name, org_type")
    .in("id", orgIds)
    .order("name");

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="label mb-3">Organization Administration</p>
      <h1 className="font-serif text-4xl text-ink">My Organizations</h1>
      <p className="mt-3 text-muted">
        You can administer participation here &mdash; private AVAIA conversations remain with the
        Host and their authorized AVAIA Guide.
      </p>

      <div className="mt-8 space-y-3">
        {(orgs ?? []).map((o) => (
          <Link
            key={o.id}
            href={`/org-admin/${o.id}`}
            className="block rounded-lg border border-rule bg-white/[0.04] px-5 py-4 transition-colors hover:border-seal"
          >
            <p className="font-serif text-lg text-ink">{o.name}</p>
            <p className="mt-1 text-xs text-muted capitalize">{o.org_type.replace("_", " ")}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
