"use client";

import { useState } from "react";

export default function ConfirmConsentButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function onConfirm() {
    setState("submitting");
    setError("");
    try {
      const res = await fetch("/api/consent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not confirm.");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="mt-8 rounded-lg border border-seal/40 bg-seal/[0.06] p-6">
        <p className="font-serif text-xl text-ink">Thank you — participation is confirmed.</p>
        <p className="mt-2 text-sm text-muted">You can close this page.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={onConfirm}
        disabled={state === "submitting"}
        className="rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "submitting" ? "Confirming…" : "I am this participant's parent or guardian. I consent."}
      </button>
      {error && <p className="mt-3 text-sm text-[#e0857d]">{error}</p>}
    </div>
  );
}
