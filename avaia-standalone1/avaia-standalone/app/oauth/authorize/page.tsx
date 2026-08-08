import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// PROOF OF CONCEPT — AVAIA acting as a minimal OAuth 2.0 authorization-code
// provider for exactly one client: the IAP custom GPT's Action. Replaces
// the copy-paste code handoff entirely. The Host consents here, once;
// nothing about their identity depends on a value the model has to
// remember and reproduce later.
//
// GPT_OAUTH_REDIRECT_URI must be set to the exact callback URL ChatGPT's
// GPT Builder shows once OAuth is selected as the Action's auth type — that
// value is controlled by OpenAI, not something AVAIA can predict.

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes — just long enough for the redirect round trip

export const dynamic = "force-dynamic";

type OAuthParams = {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  scope?: string;
  state?: string;
};

async function approve(formData: FormData) {
  "use server";

  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const code = randomBytes(24).toString("base64url");
  const admin = createAdminClient();
  await admin.from("oauth_authorization_codes").insert({
    code,
    host_id: user.id,
    client_id: clientId,
    redirect_uri: redirectUri,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });

  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  redirect(target.toString());
}

async function deny(formData: FormData) {
  "use server";

  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");

  const target = new URL(redirectUri);
  target.searchParams.set("error", "access_denied");
  if (state) target.searchParams.set("state", state);
  redirect(target.toString());
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      <p className="label mb-3">Something&rsquo;s wrong</p>
      <h1 className="font-serif text-4xl text-ink">Can&rsquo;t complete this connection</h1>
      <p className="mt-4 text-lg text-muted">{message}</p>
    </div>
  );
}

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams?: OAuthParams;
}) {
  const params: OAuthParams = {
    response_type: searchParams?.response_type,
    client_id: searchParams?.client_id,
    redirect_uri: searchParams?.redirect_uri,
    scope: searchParams?.scope,
    state: searchParams?.state,
  };

  if (params.response_type !== "code") {
    return <ErrorScreen message="Unsupported response_type." />;
  }
  if (!params.client_id || params.client_id !== process.env.GPT_OAUTH_CLIENT_ID) {
    return <ErrorScreen message="Unrecognized client." />;
  }
  if (!params.redirect_uri) {
    return <ErrorScreen message="Missing redirect_uri." />;
  }
  const allowedRedirect = process.env.GPT_OAUTH_REDIRECT_URI;
  if (!allowedRedirect || params.redirect_uri !== allowedRedirect) {
    return (
      <ErrorScreen
        message={`redirect_uri is not recognized. The exact value ChatGPT just sent was: ${params.redirect_uri} — set GPT_OAUTH_REDIRECT_URI to exactly that value in Vercel.`}
      />
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Deliberately does NOT chain a ?redirect= back through sign-in — that
  // more complex URL caused Supabase's magic-link redirect to fall back to
  // its Site URL (production) instead of matching this preview's allowlist
  // entry. A flat, simple message costs one manual step but can't trigger
  // that failure mode.
  if (!user) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <p className="label mb-3">Sign in required</p>
        <h1 className="font-serif text-4xl text-ink">Sign in to AVAIA first</h1>
        <p className="mt-4 text-lg text-muted">
          Sign in, then go back to ChatGPT and try connecting your account again.
        </p>
        <a
          href="/sign-in"
          className="mt-8 inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Sign in
        </a>
      </div>
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("consent_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return <ErrorScreen message={profileError.message} />;
  }
  if (!profile?.consent_at) {
    redirect("/welcome");
  }

  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      <p className="label mb-3">Connect ChatGPT</p>
      <h1 className="font-serif text-4xl text-ink">
        Allow the IAP GPT to submit to your AVAIA account?
      </h1>
      <p className="mt-4 text-lg text-muted">
        This lets the Individual Awareness Profile GPT send your completed referral back to your
        AVAIA workbook automatically, once, when you finish. It doesn&rsquo;t give it access to
        anything else in your account.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <form action={approve}>
          <input type="hidden" name="client_id" value={params.client_id} />
          <input type="hidden" name="redirect_uri" value={params.redirect_uri} />
          <input type="hidden" name="state" value={params.state ?? ""} />
          <button
            type="submit"
            className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Allow
          </button>
        </form>
        <form action={deny}>
          <input type="hidden" name="redirect_uri" value={params.redirect_uri} />
          <input type="hidden" name="state" value={params.state ?? ""} />
          <button
            type="submit"
            className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Deny
          </button>
        </form>
      </div>
    </div>
  );
}
