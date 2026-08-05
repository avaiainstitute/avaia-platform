"use client";

import { createClient } from "@/lib/supabase/client";

/** Hard-navigates via window.location — see the matching note in
 *  app/auth/callback/page.tsx. A soft router.replace()+router.refresh() here
 *  risks serving a stale, still-authenticated cached page after sign-out,
 *  same class of issue as the sign-in-side stale-cache problems. */
export default function SignOutButton() {
  async function signOut() {
    await createClient().auth.signOut();
    window.location.replace("/");
  }
  return (
    <button onClick={signOut} className="label hover:text-seal">
      Sign out
    </button>
  );
}
