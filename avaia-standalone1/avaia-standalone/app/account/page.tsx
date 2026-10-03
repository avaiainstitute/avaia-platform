"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { GuideCertificationView } from "@/lib/certification-status-view";

/**
 * The safe migration path for AVAIA's existing passwordless Hosts (item 5
 * of the member-auth close-out): supabase.auth.updateUser({ password })
 * against an ALREADY-AUTHENTICATED session sets a password on THIS SAME
 * account, it is an update, never a sign-up, so there is no way for it
 * to create a second Host identity. This is deliberately the only path
 * AVAIA offers for setting a password (the other place it's ever touched,
 * /reset-password, is reached only via a Supabase recovery link that
 * already proved account ownership the same way). No "current password"
 * field is asked for, on purpose, Supabase's own updateUser doesn't
 * require one; the live session already is the proof of identity, exactly
 * as it is for every other authenticated action in AVAIA. Reachable for
 * every signed-in Host regardless of age, setting your own account's
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
  const [certification, setCertification] = useState<GuideCertificationView | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.replace("/sign-in?from=/account");
        return;
      }
      setEmail(data.user.email ?? null);

      // Family status, self-read RLS only, see migration 0054. An owner
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

      // A Certified Guide's own certification status (renewal period, CE,
      // Ethics, renewal fee). Lives here because this page stays reachable
      // when a certification is inactive and the Toolkit is not. Anyone
      // without a certification gets { status: null } and sees nothing.
      try {
        const res = await fetch("/api/guide/certification-status");
        if (res.ok) {
          const body = (await res.json()) as { status: GuideCertificationView | null };
          setCertification(body.status ?? null);
        }
      } catch {
        // The certification section is simply omitted if this can't load.
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

      {certification && (
        <section
          id="guide-certification"
          className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm"
        >
          <p className="label mb-2 text-muted">Certified AVAIA Guide</p>
          <p className="font-serif text-xl text-ink">{certification.lifecycleLabel}</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="label text-muted">Certified</dt>
              <dd className="mt-1 text-ink">{certification.certifiedOn}</dd>
            </div>
            {certification.inactive ? (
              <div>
                <dt className="label text-muted">Inactive for</dt>
                <dd className="mt-1 text-ink">
                  {certification.inactive.monthsInactive} month{certification.inactive.monthsInactive === 1 ? "" : "s"}
                  {certification.inactive.windowOpen
                    ? `, reactivation available until ${certification.inactive.reactivationWindowEndsOn}`
                    : `, the reactivation window ended ${certification.inactive.reactivationWindowEndsOn}`}
                </dd>
              </div>
            ) : (
              certification.periodEndsOn && (
                <div>
                  <dt className="label text-muted">Current period ends</dt>
                  <dd className="mt-1 text-ink">
                    {certification.periodEndsOn}
                    {certification.daysRemaining !== null &&
                      (certification.daysRemaining > 0
                        ? `, ${certification.daysRemaining} day${certification.daysRemaining === 1 ? "" : "s"} remaining`
                        : ", the period has ended")}
                  </dd>
                </div>
              )
            )}
            <div>
              <dt className="label text-muted">Continuing education this period</dt>
              <dd className="mt-1 text-ink">
                {certification.ce.approved} of {certification.ce.required} approved credits
                {certification.ce.pending > 0 ? ` (${certification.ce.pending} more awaiting approval)` : ""}
              </dd>
            </div>
            <div>
              <dt className="label text-muted">Ethics</dt>
              <dd className="mt-1 text-ink">{certification.ethicsText}</dd>
            </div>
            <div>
              <dt className="label text-muted">{certification.inactive ? "Reactivation fee" : "Renewal fee"}</dt>
              <dd className="mt-1 text-ink">{certification.paymentText}</dd>
            </div>
          </dl>
          {certification.nextSteps.length > 0 && (
            <div className="mt-4 border-t border-rule pt-4">
              <p className="label mb-2 text-muted">What is needed</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                {certification.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-4 text-xs text-muted">
            Renewal needs all of it, approved continuing education, any required Ethics coursework, the
            annual fee, and good standing. Any one of these alone is not renewal, and AVAIA confirms every
            renewal. A certification that is not renewed becomes inactive, it is never deleted.
          </p>
        </section>
      )}

      {family.kind === "owner" && (
        <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          <p className="label mb-2 text-muted">Family Membership</p>
          <p className="text-sm text-muted">
            You manage a Family Membership, {family.memberCount} member{family.memberCount === 1 ? "" : "s"} on
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
            stay private, the plan owner never sees your conversations.
          </p>
        </section>
      )}

      <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <p className="label mb-2 text-muted">Password</p>
        <p className="text-sm text-muted">
          Set a password so you can sign in with email and password next time, instead of
          retrieving a code every time. You can still use an emailed code whenever you&rsquo;d
          rather, setting a password doesn&rsquo;t remove that option.
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
