"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }
  return (
    <button onClick={signOut} className="label hover:text-seal">
      Sign out
    </button>
  );
}
