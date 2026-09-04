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
 * Deliberately sessionStorage, not localStorage: localStorage is scoped to
 * the ORIGIN, not the tab -- shared by every tab of avaiainstitute.com,
 * including the Guide's own /toolkit tab open in the same browser. A
 * distinct storageKey there would still isolate it from the SSR cookie
 * session, but it would sit somewhere the Guide's own tab could read via
 * plain devtools (localStorage.getItem(...)), same origin, no exploit
 * required -- exactly the "adversarial/direct access" case this boundary
 * has to hold against. sessionStorage is scoped to the individual browsing
 * context (this tab/window only) -- even on the exact same device, in the
 * exact same browser, a different tab has its own independent
 * sessionStorage that this one's writes never reach. That's what actually
 * makes "open this on the participant's own device, or in a private/
 * incognito window" a belt-and-suspenders instruction rather than the only
 * thing standing between the Guide and this session.
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
        storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
        storageKey: "avaia-room-participant-auth",
        persistSession: true,
        autoRefreshToken: true,
        flowType: "implicit",
      },
    }
  );
  return cached;
}
