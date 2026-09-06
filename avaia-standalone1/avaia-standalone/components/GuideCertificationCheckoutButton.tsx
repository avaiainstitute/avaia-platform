"use client";

import { useState } from "react";

export default function GuideCertificationCheckoutButton({ disabled }: { disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    if (loading || disabled) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout-guide-certification", { method: "POST" });
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
        disabled={loading || disabled}
        className="inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Redirecting…" : "Pay $4,500 and Enroll"}
      </button>
      {error && <p className="mt-3 text-sm text-[#e0857d]">{error}</p>}
    </div>
  );
}
