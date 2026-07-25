"use client";

/**
 * Browser Supabase client (RLS-respecting). Uses the publishable ("anon") key —
 * safe in the browser because every table has Row-Level Security (see
 * supabase/schema.sql). Session is stored in cookies by @supabase/ssr.
 *
 * flowType: "implicit" — the magic-link email lands on the app with the session
 * tokens in the URL hash; the browser client detects them (detectSessionInUrl),
 * writes the cookie session, and cleans the URL. This mirrors the CCR platform
 * and works regardless of which browser opened the link.
 */

import { createBrowserClient } from "@supabase/ssr";

let cached: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (cached) return cached;
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit" } }
  );
  return cached;
}
