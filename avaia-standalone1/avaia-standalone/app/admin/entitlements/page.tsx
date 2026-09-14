import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Entitlements, AVAIA Admin" };
export const dynamic = "force-dynamic";

// Automation audit finding #2.6. Read-only -- this page never grants,
// revokes, or edits anything, it only answers "is this person a member,"
// "did this Family plan actually get created," and "how many
// certification payments exist" without going into Supabase Studio or
// Stripe directly. entitlements/family_memberships/family_members have no
// self-serve RLS policy for an admin role (unlike guide_certification_
// payments, which already has one from 0062), so every read here
// deliberately uses the service-role client, gated by the same
// profiles.role === 'admin' check every other admin page already uses.

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/entitlements");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
}

async function resolveEmailsByHostId(admin: ReturnType<typeof createAdminClient>, hostIds: string[]): Promise<Map<string, string>> {
  const emailById = new Map<string, string>();
  const remaining = new Set(hostIds);
  if (remaining.size === 0) return emailById;
  for (let page = 1; page <= 20 && remaining.size > 0; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (!data || data.users.length === 0) break;
    for (const u of data.users) {
      if (u.email && remaining.has(u.id)) {
        emailById.set(u.id, u.email);
        remaining.delete(u.id);
      }
    }
    if (data.users.length < 1000) break;
  }
  return emailById;
}

export default async function AdminEntitlementsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: individualRows }, { data: familyRows }, { data: familyMemberRows }, { data: paymentRows }] =
    await Promise.all([
      admin
        .from("entitlements")
        .select("id, host_id, status, source, created_at")
        .eq("status", "active")
        .eq("source", "individual")
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("family_memberships")
        .select("id, owner_host_id, plan, status, extra_seat_quantity, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      admin.from("family_members").select("family_membership_id, status").neq("status", "removed"),
      admin
        .from("guide_certification_payments")
        .select("id, host_id, amount_cents, currency, paid_at")
        .order("paid_at", { ascending: false })
        .limit(50),
    ]);

  const individual = individualRows ?? [];
  const families = familyRows ?? [];
  const members = familyMemberRows ?? [];
  const payments = paymentRows ?? [];

  const memberCountByFamily = new Map<string, number>();
  for (const m of members) {
    memberCountByFamily.set(m.family_membership_id, (memberCountByFamily.get(m.family_membership_id) ?? 0) + 1);
  }

  const hostIds = Array.from(
    new Set([
      ...individual.map((r) => r.host_id),
      ...families.map((r) => r.owner_host_id),
      ...payments.map((r) => r.host_id),
    ])
  );
  const emailById = await resolveEmailsByHostId(admin, hostIds);

  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin" className="label hover:text-seal">
          ← Back to Admin
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">Entitlements</h1>
      <p className="mt-4 text-lg text-muted">
        Read-only. Individual and Family Membership access, and Certified AVAIA Guide Program
        payments, in one place instead of Supabase Studio or Stripe directly.
      </p>

      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Active Individual Entitlements ({individual.length})</p>
        {individual.length === 0 ? (
          <p className="text-muted">None.</p>
        ) : (
          <div className="space-y-2">
            {individual.map((r) => (
              <div key={r.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-3 text-sm">
                <span className="text-ink">{emailById.get(r.host_id) ?? r.host_id}</span>
                <span className="ml-3 text-muted">since {new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Family Memberships ({families.length})</p>
        {families.length === 0 ? (
          <p className="text-muted">None.</p>
        ) : (
          <div className="space-y-2">
            {families.map((f) => (
              <div key={f.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-ink">{emailById.get(f.owner_host_id) ?? f.owner_host_id}</span>
                  <span className="label text-muted">{f.status}</span>
                </div>
                <p className="mt-1 text-muted">
                  {f.plan}, {memberCountByFamily.get(f.id) ?? 0} member(s)
                  {f.extra_seat_quantity > 0 ? `, ${f.extra_seat_quantity} extra seat(s) billed` : ""} -- since{" "}
                  {new Date(f.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Certified AVAIA Guide Program Payments ({payments.length})</p>
        {payments.length === 0 ? (
          <p className="text-muted">None.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-3 text-sm">
                <span className="text-ink">{emailById.get(p.host_id) ?? p.host_id}</span>
                <span className="ml-3 text-muted">
                  {(p.amount_cents / 100).toFixed(2)} {p.currency.toUpperCase()}, paid{" "}
                  {new Date(p.paid_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
