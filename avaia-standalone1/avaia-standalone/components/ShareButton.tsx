"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ShareScope } from "@/lib/sharing";

export default function ShareButton({
  scope,
  conversationId,
  label,
}: {
  scope: ShareScope;
  conversationId?: string;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<"granted" | "invited" | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, conversationId, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not share.");
      setResult(data.status);
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setResult(null);
        }}
        className="rounded-md border border-rule px-3 py-1.5 font-sans text-xs text-muted transition-colors hover:border-seal hover:text-ink"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-rule bg-white/[0.04] p-4 backdrop-blur-sm">
      {result ? (
        <div>
          <p className="text-sm text-ink">
            {result === "granted"
              ? "Access granted — they can see it the next time they sign in."
              : "That email doesn't have an AVAIA account yet — an invite was sent. Access activates automatically once they sign up."}
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 text-xs text-muted hover:text-ink"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Recipient's email"
            className="min-w-[14rem] flex-1 rounded-md border border-rule bg-white/[0.04] px-3 py-1.5 text-sm text-ink outline-none placeholder:text-muted focus:border-seal"
          />
          <button
            type="submit"
            disabled={sending}
            className="rounded-md bg-seal px-4 py-1.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? "Sharing…" : "Share"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={sending}
            className="text-xs text-muted hover:text-ink"
          >
            Cancel
          </button>
          {error && <p className="w-full text-sm text-[#e0857d]">{error}</p>}
        </form>
      )}
    </div>
  );
}
