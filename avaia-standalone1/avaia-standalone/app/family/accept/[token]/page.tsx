"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/** Where a Family invite link lands. Requires the visitor be signed in as
 *  the exact email the invite was sent to -- acceptFamilyInvite() checks
 *  this server-side regardless of what this page does, but the page also
 *  checks it up front so a signed-in-as-someone-else visitor gets a clear
 *  explanation instead of a confusing server error. */
export default function AcceptFamilyInvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setLoading(false);
    });
  }, []);

  async function accept() {
    setAccepting(true);
    setError("");
    try {
      const res = await fetch("/api/family/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not accept this invite.");
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-prose px-5 py-24">
        <p className="text-muted">One moment…</p>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="mx-auto max-w-prose px-5 py-24">
        <p className="label mb-3">Family Membership</p>
        <h1 className="font-serif text-3xl text-ink">You&rsquo;re in.</h1>
        <p className="mt-4 text-muted">
          You now have AVAIA Membership access through this Family plan. Your own AVAIA account,
          Journey, and Workbook stay exactly as private as they&rsquo;ve always been.
        </p>
        <Link
          href="/journey"
          className="mt-8 inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Continue Your Journey
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-prose px-5 py-24">
      <p className="label mb-3">Family Membership</p>
      <h1 className="font-serif text-3xl text-ink">You&rsquo;ve been invited to a Family AVAIA Membership.</h1>
      <p className="mt-4 text-muted">
        Joining gives you AVAIA Membership access under this Family plan. It does not share your
        conversations, Journey, or Workbook with anyone else on the plan — including whoever
        invited you.
      </p>

      {!email ? (
        <div className="mt-8">
          <p className="text-sm text-muted">Sign in (or create a free account) with the email address this invite was sent to, then come back to this link.</p>
          <Link
            href={`/sign-in?from=${encodeURIComponent(`/family/accept/${token}`)}`}
            className="mt-4 inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Sign In
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <p className="text-sm text-muted">Signed in as <span className="text-ink">{email}</span>.</p>
          <button
            type="button"
            onClick={accept}
            disabled={accepting}
            className="mt-4 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {accepting ? "Accepting…" : "Accept Invitation"}
          </button>
          {error && <p className="mt-3 text-sm text-[#e0857d]">{error}</p>}
        </div>
      )}
    </div>
  );
}
