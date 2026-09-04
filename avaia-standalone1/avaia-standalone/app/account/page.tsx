"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * The safe migration path for AVAIA's existing passwordless Hosts (item 5
 * of the member-auth close-out): supabase.auth.updateUser({ password })
 * against an ALREADY-AUTHENTICATED session sets a password on THIS SAME
 * account -- it is an update, never a sign-up, so there is no way for it
 * to create a second Host identity. This is deliberately the only path
 * AVAIA offers for setting a password (the other place it's ever touched,
 * /reset-password, is reached only via a Supabase recovery link that
 * already proved account ownership the same way). No "current password"
 * field is asked for, on purpose -- Supabase's own updateUser doesn't
 * require one; the live session already is the proof of identity, exactly
 * as it is for every other authenticated action in AVAIA. Reachable for
 * every signed-in Host regardless of age -- setting your own account's
 * password is an ordinary account-security action, not a story-content
 * access, so it needs no guardian-consent gate the way Journey content
 * does.
 */
type FamilyStatus =
  | { kind: "none" }
  | { kind: "owner"; memberCount: number }
  | { kind: "member"; ownerEmail: string | null };

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [family, setFamily] = useState<FamilyStatus>({ kind: "none" });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.replace("/sign-in?from=/account");
        return;
      }
      setEmail(data.user.email ?? null);

      // Family status -- self-read RLS only, see migration 0054. An owner
      // sees their own plan's member count; a member sees only that
      // they're on a plan (never who else is on it).
      const { data: ownedPlan } = await supabase
        .from("family_memberships")
        .select("id")
        .eq("owner_host_id", data.user.id)
        .eq("status", "active")
        .maybeSingle();
      if (ownedPlan) {
        const { count } = await supabase
          .from("family_members")
          .select("id", { count: "exact", head: true })
          .eq("family_membership_id", ownedPlan.id)
          .neq("status", "removed");
        setFamily({ kind: "owner", memberCount: count ?? 0 });
      } else {
        const { data: myMembership } = await supabase
          .from("family_members")
          .select("id")
          .eq("host_id", data.user.id)
          .eq("status", "active")
          .maybeSingle();
        if (myMembership) setFamily({ kind: "member", ownerEmail: null });
      }

      setLoading(false);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    if (password.length < 6) {
      setError("Your password needs to be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSaved(true);
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-prose px-5 py-24">
        <p className="text-muted">One moment…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-prose px-5 py-24">
      <p className="mb-6">
        <Link href="/journey" className="label hover:text-seal">← Back to your Journey</Link>
      </p>
      <p className="label mb-3">Account</p>
      <h1 className="font-serif text-4xl text-ink">Your AVAIA Account</h1>
      <p className="mt-4 text-lg text-muted">
        Signed in as <span className="text-ink">{email}</span>.
      </p>

      {family.kind === "owner" && (
        <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          <p className="label mb-2 text-muted">Family Membership</p>
          <p className="text-sm text-muted">
            You manage a Family Membership — {family.memberCount} member{family.memberCount === 1 ? "" : "s"} on
            the plan. Each person keeps their own private AVAIA account, Journey, and Workbook.
          </p>
          <Link href="/family" className="mt-3 inline-block label text-seal hover:opacity-80">
            Manage Family Plan →
          </Link>
        </section>
      )}
      {family.kind === "member" && (
        <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          <p className="label mb-2 text-muted">Family Membership</p>
          <p className="text-sm text-muted">
            You&rsquo;re a member of a Family AVAIA Membership. Your account, Journey, and Workbook
            stay private — the plan owner never sees your conversations.
          </p>
        </section>
      )}

      <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <p className="label mb-2 text-muted">Password</p>
        <p className="text-sm text-muted">
          Set a password so you can sign in with email and password next time, instead of
          retrieving a code every time. You can still use an emailed code whenever you&rsquo;d
          rather — setting a password doesn&rsquo;t remove that option.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="label block" htmlFor="password">New password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
          />
          <label className="label block" htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save Password"}
          </button>
          {error && <p className="text-sm text-[#e0857d]">{error}</p>}
          {saved && <p className="text-sm text-ink">Password saved.</p>}
        </form>
      </section>
    </div>
  );
}
