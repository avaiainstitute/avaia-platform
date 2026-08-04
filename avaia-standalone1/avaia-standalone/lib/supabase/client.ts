"use client";

/**
 * Browser Supabase client (RLS-respecting). Uses the publishable ("anon") key —
 * safe in the browser because every table has Row-Level Security (see
 * supabase/schema.sql). Session is stored in cookies by @supabase/ssr.
 *
 * flowType: "pkce" — set explicitly for clarity, though @supabase/ssr's
 * createBrowserClient (confirmed by reading the installed 0.5.2 source) always
 * forces flowType "pkce" and detectSessionInUrl true regardless of what's
 * passed here; neither can actually be overridden through this option. That
 * matters for app/auth/callback/page.tsx: since detectSessionInUrl can't be
 * turned off, merely constructing this client (here, or via
 * SupabaseSessionSync in the root layout) already triggers Supabase's own
 * automatic exchange of whatever's in the URL. The callback page relies on
 * that automatic exchange and only waits for its result — it must never call
 * setSession()/exchangeCodeForSession() itself, which would race the
 * automatic one for the same single-use code and reliably lose.
 */

import { createBrowserClient } from "@supabase/ssr";

let cached: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (cached) return cached;
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "pkce" } }
  );
  return cached;
}
