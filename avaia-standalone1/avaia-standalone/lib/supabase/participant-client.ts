"use client";

/**
 * A Supabase browser client used ONLY by app/room-access/[token]/page.tsx --
 * the participant's private-processing session inside a Shared Room.
 *
 * Deliberately NOT lib/supabase/client.ts: that client stores its session in
 * cookies shared by the whole browser, which is exactly what a Guide-facing
 * tab in the same browser also reads. Opening a private-access link in a
 * second tab of the same browser the Guide is signed into would silently
 * hand the participant's session cookies to (or overwrite them with) the
 * Guide's own signed-in state -- the opposite of the privacy boundary this
 * flow exists to create.
 *
 * This client instead stores its session under its own storageKey in
 * localStorage, isolated from the SSR cookie session and from any other
 * Supabase client instance. Same origin, same physical browser if needed --
 * still two independent auth states that never interact. Session is
 * established once, client-side, via verifyOtp() using the token_hash
 * handed over by /api/room-access/consume (see that route) -- never a
 * cookie exchange, never anything the Guide's own session touches.
 */
import { createClient } from "@supabase/supabase-js";

let cached: ReturnType<typeof createClient> | null = null;

export function createParticipantClient() {
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storageKey: "avaia-room-participant-auth",
        persistSession: true,
        autoRefreshToken: true,
        flowType: "implicit",
      },
    }
  );
  return cached;
}
