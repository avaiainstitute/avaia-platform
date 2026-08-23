"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

/** Attaches an email to the current (anonymous) session -- the same
 *  updateUser({ email }) mechanism validated end-to-end this session
 *  via the temporary internal test route: the confirmation link, once
 *  clicked, converts the identity in place (same auth.users.id), so
 *  the profile/Journey/conversation already attached to it carry over
 *  unchanged. This is deliberately its own form, entirely separate
 *  from the membership/checkout CTA it's rendered alongside -- saving
 *  progress and becoming a paying Member are two different asks. */
export default function SaveProgressForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/auth/callback` }
    );
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <p className="text-sm text-muted">
        Check your inbox at {email} for a confirmation link to finish saving your progress.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="min-w-[220px] flex-1 rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="shrink-0 rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal disabled:opacity-60"
      >
        {status === "loading" ? "Saving…" : "Save my progress"}
      </button>
      {status === "error" && message && <p className="w-full text-sm text-red-700">{message}</p>}
    </form>
  );
}
