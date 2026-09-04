"use client";

import { useState } from "react";

type MembershipPlan = "monthly" | "annual";

/** Starts Checkout for a NEW Family Membership plan -- mirrors
 *  MembershipCheckoutButton exactly, pointed at /api/stripe/family-checkout
 *  instead. Kept as its own component (rather than a prop branch on the
 *  Individual button) so the two purchase flows stay visibly separate --
 *  Family Membership is a distinct plan, not a variant of Individual. */
export default function FamilyCheckoutButton({
  plan = "monthly",
  label = "Start Family Membership",
}: {
  plan?: MembershipPlan;
  label?: string;
} = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/family-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "Could not start checkout.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Redirecting…" : label}
      </button>
      {error && <p className="mt-3 text-sm text-[#e0857d]">{error}</p>}
    </div>
  );
}
