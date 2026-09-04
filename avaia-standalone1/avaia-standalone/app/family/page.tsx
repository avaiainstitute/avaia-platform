"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Membership = {
  id: string;
  plan: "monthly" | "annual";
  status: "active" | "canceled";
  extra_seat_quantity: number;
};

type Member = {
  id: string;
  invited_email: string;
  is_owner: boolean;
  is_extra_seat: boolean;
  status: "invited" | "active" | "removed";
};

const FAMILY_INCLUDED_SEATS = 5;

/** The Family plan owner's roster management page. Governing rule: this
 *  page shows WHO has access and WHETHER they've accepted -- it never
 *  shows or links to any member's Journey, Workbook, or conversation
 *  content. That boundary isn't a UI choice here; family_members' RLS
 *  (migration 0054) makes it structurally true regardless of what this
 *  page tries to render -- there is no query this page could run that
 *  would return another member's story content. */
export default function FamilyPage() {
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      window.location.replace("/sign-in?from=/family");
      return;
    }
    const { data: fm } = await supabase
      .from("family_memberships")
      .select("id, plan, status, extra_seat_quantity")
      .eq("owner_host_id", data.user.id)
      .eq("status", "active")
      .maybeSingle();
    setMembership(fm as Membership | null);
    if (fm) {
      const { data: roster } = await supabase
        .from("family_members")
        .select("id, invited_email, is_owner, is_extra_seat, status")
        .eq("family_membership_id", fm.id)
        .neq("status", "removed")
        .order("invited_at", { ascending: true });
      setMembers((roster as Member[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setInviting(true);
    try {
      const res = await fetch("/api/family/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send the invite.");
      setNotice(`Invited ${email}.`);
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setInviting(false);
    }
  }

  async function remove(memberId: string, label: string) {
    if (!window.confirm(`Remove ${label} from this Family plan? Their AVAIA access from this plan will end immediately. Their own Journey and Workbook are never affected.`)) return;
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/family/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not remove this member.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-prose px-5 py-24">
        <p className="text-muted">One moment…</p>
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="mx-auto max-w-prose px-5 py-24">
        <p className="label mb-3">Family Membership</p>
        <h1 className="font-serif text-3xl text-ink">You don&rsquo;t have a Family Membership yet.</h1>
        <p className="mt-4 text-muted">
          Family Membership gives up to {FAMILY_INCLUDED_SEATS} people their own AVAIA access under one
          payment — each person still keeps their own private account, Journey, and Workbook.
        </p>
        <Link
          href="/membership"
          className="mt-8 inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          See Membership Options
        </Link>
      </div>
    );
  }

  const occupied = members.filter((m) => m.status !== "removed").length;
  const priceLabel = membership.plan === "annual" ? "$490/year" : "$49/month";

  return (
    <div className="mx-auto max-w-prose px-5 py-24">
      <p className="mb-6">
        <Link href="/account" className="label hover:text-seal">← Back to your Account</Link>
      </p>
      <p className="label mb-3">Family Membership</p>
      <h1 className="font-serif text-4xl text-ink">Your Family Plan</h1>
      <p className="mt-4 text-lg text-muted">
        {priceLabel}, {occupied} of {FAMILY_INCLUDED_SEATS} included seats used
        {membership.extra_seat_quantity > 0
          ? ` (plus ${membership.extra_seat_quantity} additional member${membership.extra_seat_quantity === 1 ? "" : "s"})`
          : ""}
        .
      </p>
      <p className="mt-2 text-sm text-muted">
        Each person on this plan keeps their own private AVAIA account, Journey, and Workbook. You
        manage who has access — you never see anyone else&rsquo;s conversations or Workbook.
      </p>

      <section className="mt-12 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <p className="label mb-3 text-muted">Roster</p>
        <ul className="space-y-3">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 border-b border-rule pb-3 last:border-0 last:pb-0">
              <div>
                <p className="text-ink">{m.invited_email}</p>
                <p className="text-xs text-muted">
                  {m.is_owner ? "Plan owner" : m.status === "invited" ? "Invited — waiting to accept" : "Active member"}
                  {m.is_extra_seat ? " · additional seat" : ""}
                </p>
              </div>
              {!m.is_owner && (
                <button
                  type="button"
                  onClick={() => remove(m.id, m.invited_email)}
                  className="label text-[#e0857d] hover:opacity-80"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <p className="label mb-3 text-muted">Invite a Family Member</p>
        <p className="text-sm text-muted">
          The 6th and further members bill separately at $7/month or $70/year each, matching your
          plan&rsquo;s billing interval.
        </p>
        <form onSubmit={invite} className="mt-4 flex flex-wrap gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="their@email.com"
            className="min-w-[240px] flex-1 rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
          />
          <button
            type="submit"
            disabled={inviting}
            className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {inviting ? "Sending…" : "Send Invite"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-[#e0857d]">{error}</p>}
        {notice && <p className="mt-3 text-sm text-ink">{notice}</p>}
      </section>
    </div>
  );
}
