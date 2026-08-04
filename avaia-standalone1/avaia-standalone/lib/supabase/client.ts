"use client";

/**
 * Browser Supabase client (RLS-respecting). Uses the publishable ("anon") key —
 * safe in the browser because every table has Row-Level Security (see
 * supabase/schema.sql). Session is stored in cookies by @supabase/ssr.
 *
 * flowType: "pkce" — this project's Supabase Auth issues PKCE-style `?code=`
 * magic links regardless of client config, so the client must actually run
 * PKCE to generate and store the code_verifier signInWithOtp() needs;
 * app/auth/callback/page.tsx's exchangeCodeForSession(code) call depends on
 * it. (Previously set to "implicit," which never generates a verifier at
 * all — every link click failed with "PKCE code verifier not found in
 * storage," not a lost/misplaced verifier but one that was never created.)
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
