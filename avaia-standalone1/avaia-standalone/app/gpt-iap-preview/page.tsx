import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConversation } from "@/lib/engine/conversation";

// PROOF OF CONCEPT — isolated from the real /journey IAP flow entirely. Does
// not modify it, does not share a code path with it. Visiting this page:
//   1. confirms the Host is signed in and has consented (same gate /journey
//      already applies — not new policy, just reused);
//   2. creates a conversations row exactly the way /journey does today
//      (lib/engine/conversation.ts's createConversation, unchanged);
//   3. mints a single-use, short-lived token and stores it in
//      gpt_handoff_sessions via the service-role client (this table has no
//      client-readable RLS policies at all — bearer secret, not a normal row);
//   4. redirects straight to the real IAP custom GPT, with the token
//      embedded as the opening prefilled message so the GPT can carry it
//      silently and hand it back with the referral.
//
// The GPT conversation itself is completely untouched by any of this.

const IAP_GPT_URL =
  "https://chatgpt.com/g/g-6a2cc069e6688191b02bff51c3067c6a-individual-awareness-profile-iap-gpt";

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours — one sitting's worth of headroom

export const dynamic = "force-dynamic";

export default async function GptIapPreviewPage() {
  const supabase = createClient();
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  // TEMPORARY DEBUG — server-side only, visible in Vercel's function logs,
  // not shown to the Host. Remove once the sign-in issue is diagnosed.
  const allCookieNames = cookies()
    .getAll()
    .map((c) => c.name);
  console.log("[gpt-iap-preview debug]", {
    cookieCount: allCookieNames.length,
    cookieNames: allCookieNames,
    supabaseAuthCookieNames: allCookieNames.filter((n) => n.startsWith("sb-")),
    hasUser: !!user,
    getUserError: getUserError
      ? { name: getUserError.name, message: getUserError.message, status: getUserError.status }
      : null,
    envConfigured: {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <p className="label mb-3">Sign in required</p>
        <h1 className="font-serif text-4xl text-ink">This is a proof-of-concept link</h1>
        <p className="mt-4 text-lg text-muted">
          Sign in to AVAIA first, then visit this page again.
        </p>
      </div>
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("consent_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <p className="label mb-3">Something&rsquo;s wrong</p>
        <h1 className="font-serif text-4xl text-ink">We couldn&rsquo;t load your profile</h1>
        <p className="mt-3 text-xs text-muted/70">Details: {profileError.message}</p>
      </div>
    );
  }

  if (!profile?.consent_at) redirect("/welcome");

  // Same conversation-creation path /journey already uses — no new logic here.
  const convo = await createConversation(supabase, user.id, "iap");

  const token = randomBytes(24).toString("base64url");
  const admin = createAdminClient();
  const { error: sessionError } = await admin.from("gpt_handoff_sessions").insert({
    host_id: user.id,
    stage: "iap",
    token,
    conversation_id: convo.id,
    expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
  });

  if (sessionError) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <p className="label mb-3">Something&rsquo;s wrong</p>
        <h1 className="font-serif text-4xl text-ink">Could not start the handoff session</h1>
        <p className="mt-3 text-xs text-muted/70">Details: {sessionError.message}</p>
      </div>
    );
  }

  const openingMessage = `AVAIA_SESSION_TOKEN:${token}`;
  redirect(`${IAP_GPT_URL}?q=${encodeURIComponent(openingMessage)}`);
}
