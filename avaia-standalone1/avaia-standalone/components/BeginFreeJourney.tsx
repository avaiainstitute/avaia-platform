"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** The Free IAP entry action. Deliberately a click, not something that
 *  fires on page load -- identity creation must be a deliberate visitor
 *  action, never a side effect of merely loading /journey (crawlers,
 *  prefetch, accidental revisits must not spawn anonymous identities).
 *  On success, router.refresh() re-runs the Server Component with the
 *  session cookie the browser client just set, falling straight into
 *  the existing consent -> auto-provision path, unchanged. */
export default function BeginFreeJourney() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBegin() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      setError(
        "Something went wrong starting your Journey. Please try again, or sign in with an email instead."
      );
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleBegin}
        disabled={loading}
        className="inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Starting…" : "Begin your Individual Awareness Profile"}
      </button>
      {error && (
        <p className="mt-3 text-sm text-muted">
          {error}{" "}
          <a href="/sign-in?from=/journey" className="underline hover:text-seal">
            Sign in instead
          </a>
        </p>
      )}
    </div>
  );
}
