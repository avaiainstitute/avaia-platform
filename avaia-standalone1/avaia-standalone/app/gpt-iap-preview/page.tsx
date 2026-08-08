import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConversation } from "@/lib/engine/conversation";
import CopyCodeBox from "./CopyCodeBox";

// PROOF OF CONCEPT — isolated from the real /journey IAP flow entirely. Does
// not modify it, does not share a code path with it.
//
// ChatGPT's ?q= prefill was tested and disproven — it never delivered the
// opening message into this GPT's conversation (confirmed: AVAIA's launch
// log showed a correctly-built token and URL, but the resulting ChatGPT
// conversation had no trace of it). Replaced with the simplest working
// alternative: show the code, let the Host copy it, they paste it as their
// own first message. The GPT's existing instruction ("if the Host's first
// message begins with AVAIA_SESSION_TOKEN:...") already handles this
// exactly as written — it never cared how the message arrived. Nothing
// about the GPT, its Action, its schema, or the ingestion endpoint changes.
//
// Flow: click "Begin IAP in ChatGPT" -> AVAIA creates the conversation +
// token (unchanged) -> this same page re-renders showing the code to copy
// and a plain (un-parameterized) link to open the GPT -> Host pastes the
// code as their first message -> GPT stores it silently -> normal IAP
// conversation, untouched -> referral Action submits back to AVAIA,
// unchanged.

const IAP_GPT_URL =
  "https://chatgpt.com/g/g-6a2cc069e6688191b02bff51c3067c6a-individual-awareness-profile-iap-gpt";

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours — one sitting's worth of headroom

export const dynamic = "force-dynamic";

// Two confirmed real-conversation tests (with two different trigger
// instructions) proved the model never actually attempted the Action call
// with the original 32-character token — the request never once reached
// AVAIA, even though the Builder Preview test proved the Action itself
// works fine when explicitly invoked. That points at the model failing to
// reliably hold and reproduce a long random string across a full
// conversation, not at timing or instruction wording. A short numeric code
// is dramatically more reliable for a model to carry verbatim across many
// turns. This needs no change on the GPT side at all — its instruction
// only cares that the Host's first message starts with
// "AVAIA_SESSION_TOKEN:" followed by a value; the value's length and shape
// were never part of that contract.
function generateShortCode(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1000000;
  return n.toString().padStart(6, "0");
}

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

  const convo = await createConversation(supabase, user.id, "iap");

  const admin = createAdminClient();
  let token = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateShortCode();
    const { error: sessionError } = await admin.from("gpt_handoff_sessions").insert({
      host_id: user.id,
      stage: "iap",
      token: candidate,
      conversation_id: convo.id,
      expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    });
    if (!sessionError) {
      token = candidate;
      break;
    }
    // Only retry on a unique-constraint collision (rare, 1-in-a-million
    // space); any other error should surface, not loop silently.
    if (!sessionError.message.includes("duplicate") && !sessionError.message.includes("unique")) {
      throw new Error(sessionError.message);
    }
  }
  if (!token) throw new Error("Could not generate a unique code after 5 attempts.");

  redirect(`/gpt-iap-preview?token=${encodeURIComponent(token)}`);
}

export default async function GptIapPreviewPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
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

  if (searchParams?.token) {
    const code = `AVAIA_SESSION_TOKEN:${searchParams.token}`;
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <p className="label mb-3">One more step</p>
        <h1 className="font-serif text-4xl text-ink">Copy this, then open the GPT</h1>
        <ol className="mt-6 space-y-2 text-lg text-muted">
          <li>1. Copy the code below.</li>
          <li>2. Open the GPT.</li>
          <li>3. Paste it as your very first message, then continue normally.</li>
        </ol>

        <CopyCodeBox value={code} />

        <div className="mt-8">
          <a
            href={IAP_GPT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Open IAP GPT
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      <p className="label mb-3">Proof of concept — GPT-IAP handoff</p>
      <h1 className="font-serif text-4xl text-ink">Begin IAP in ChatGPT</h1>
      <p className="mt-4 text-lg text-muted">
        This launches the actual IAP custom GPT, running in ChatGPT — not AVAIA&rsquo;s own
        conversation engine. When the GPT finishes and generates your referral, it&rsquo;s sent
        back to this AVAIA account automatically and IAP will show complete.
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
