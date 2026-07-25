"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Establishes the cookie session when the Host lands from a magic-link email
 * (implicit flow puts the tokens in the URL hash). Instantiating the browser
 * client runs detectSessionInUrl; on SIGNED_IN we refresh so the server sees
 * the new session. Mounted once in the root layout.
 */
export default function SupabaseSessionSync() {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    // Only wire up if Supabase is configured.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if ((event === "SIGNED_IN" || event === "SIGNED_OUT") && !handled.current) {
        handled.current = true;
        router.refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  return null;
}
