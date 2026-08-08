import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createConversation } from "@/lib/engine/conversation";

// PROOF OF CONCEPT — isolated from the real /journey IAP flow entirely. Does
// not modify it, does not share a code path with it.
//
// Now that identity is established via real OAuth (see app/oauth/authorize
// and app/api/oauth/token), there's nothing left to copy or paste. Click
// "Begin IAP in ChatGPT" -> AVAIA creates the conversation, exactly as
// before -> the GPT opens directly, no parameters, no code. The first time
// the model needs to submit a referral, ChatGPT itself prompts the Host to
// connect their AVAIA account through the OAuth consent screen — handled
// entirely by ChatGPT's own UI, not by this page.

const IAP_GPT_URL =
  "https://chatgpt.com/g/g-6a2cc069e6688191b02bff51c3067c6a-individual-awareness-profile-iap-gpt";

export const dynamic = "force-dynamic";

async function beginIapHandoff() {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/gpt-iap-preview");

  const { data: profile } = await supabase
    .from("profiles")
    .select("consent_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");

  await createConversation(supabase, user.id, "iap");

  redirect(IAP_GPT_URL);
}

export default async function GptIapPreviewPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      <p className="label mb-3">Proof of concept — GPT-IAP handoff</p>
      <h1 className="font-serif text-4xl text-ink">Begin IAP in ChatGPT</h1>
      <p className="mt-4 text-lg text-muted">
        This launches the actual IAP custom GPT, running in ChatGPT — not AVAIA&rsquo;s own
        conversation engine. The first time it needs to submit your referral, ChatGPT will ask
        you to connect your AVAIA account — after that, it&rsquo;s automatic and IAP will show
        complete in your workbook.
      </p>
      <form action={beginIapHandoff} className="mt-8">
        <button
          type="submit"
          className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Begin IAP in ChatGPT
        </button>
      </form>
    </div>
  );
}
