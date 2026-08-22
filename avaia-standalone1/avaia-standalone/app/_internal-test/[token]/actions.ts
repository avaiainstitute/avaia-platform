"use server";

/**
 * TEMPORARY — Free IAP / Anonymous Auth validation route.
 * Not linked from anywhere in the public app. Protected by TEST_TOKEN as
 * the dynamic [token] segment (see page.tsx) -- a 256-bit random value,
 * not derived from anything guessable, known only via this chat. Delete
 * this whole app/_internal-test directory once validation is complete;
 * never merge it to main.
 *
 * Deliberately uses ONLY the anonymous test user's own authenticated
 * session for every read/write below (signInAnonymously / setSession),
 * never SUPABASE_SERVICE_ROLE_KEY -- the point is to exercise real RLS
 * as that user would experience it, not to bypass it. Service-role is
 * reserved for the separate, explicit cleanup step after validation.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createJourney, createConversation } from "@/lib/engine/conversation";

export const TEST_TOKEN = "1ed455593d4a080a728e19ce86dcd8a326f0e6831373e5cbdb6b56b82dc40060";

const SESSION_COOKIE = "avaia_test_session";
const RESULT_COOKIE = "avaia_test_result";
const ROUTE_PATH = `/_internal-test/${TEST_TOKEN}`;
const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: ROUTE_PATH,
  maxAge: 3600,
};

type StoredSession = { access_token: string; refresh_token: string };

type TestResult = {
  error?: string;
  userId?: string;
  profileFound?: boolean;
  role?: string | null;
  membershipStatus?: string | null;
  journeyId?: string;
  journeyReused?: boolean;
  conversationId?: string;
  conversationReused?: boolean;
  rlsCrossUserBlocked?: boolean;
  ranAt?: string;
  emailAttachAttempted?: boolean;
  emailAttachOutcome?: string;
};

function anonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function setResult(jar: ReturnType<typeof cookies>, result: TestResult) {
  jar.set(RESULT_COOKIE, JSON.stringify(result), COOKIE_OPTS);
}

/** Restores the anonymous session from the stored cookie, if any and
 *  still valid. Returns null (does NOT create a new identity) when
 *  there's nothing to restore -- callers decide whether to sign in. */
async function restoreSession(
  client: ReturnType<typeof anonClient>,
  jar: ReturnType<typeof cookies>
): Promise<string | null> {
  const stored = jar.get(SESSION_COOKIE)?.value;
  if (!stored) return null;
  try {
    const { access_token, refresh_token } = JSON.parse(stored) as StoredSession;
    const { error } = await client.auth.setSession({ access_token, refresh_token });
    if (error) return null;
    const { data } = await client.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Idempotent: reuses the existing test identity/Journey/conversation
 *  (via the session cookie) if this has already run once, rather than
 *  creating new ones on every click, refresh, or repeated submit. */
export async function runTest(token: string) {
  if (token !== TEST_TOKEN) redirect("/");

  const jar = cookies();
  const client = anonClient();

  let userId = await restoreSession(client, jar);

  if (!userId) {
    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.session || !data.user) {
      setResult(jar, { error: error?.message ?? "Anonymous sign-in returned no session." });
      redirect(ROUTE_PATH);
    }
    userId = data.user!.id;
    jar.set(
      SESSION_COOKIE,
      JSON.stringify({
        access_token: data.session!.access_token,
        refresh_token: data.session!.refresh_token,
      }),
      COOKIE_OPTS
    );
  }

  const { data: profile } = await client
    .from("profiles")
    .select("role, membership_status")
    .eq("id", userId)
    .maybeSingle();

  let journeyId: string;
  let journeyReused = false;
  const { data: existingJourney } = await client
    .from("journeys")
    .select("id")
    .eq("host_id", userId)
    .limit(1)
    .maybeSingle();
  if (existingJourney) {
    journeyId = existingJourney.id as string;
    journeyReused = true;
  } else {
    journeyId = await createJourney(client, userId, "general");
  }

  let conversationId: string;
  let conversationReused = false;
  const { data: existingConvo } = await client
    .from("conversations")
    .select("id")
    .eq("journey_id", journeyId)
    .limit(1)
    .maybeSingle();
  if (existingConvo) {
    conversationId = existingConvo.id as string;
    conversationReused = true;
  } else {
    const convo = await createConversation(client, userId, "iap", undefined, "general", journeyId);
    conversationId = convo.id;
  }

  // Proves RLS still restricts this anonymous user to its own rows --
  // any row here would mean another Host's data leaked, so an empty
  // result is the PASS condition.
  const { data: foreignRows } = await client
    .from("conversations")
    .select("id")
    .neq("host_id", userId)
    .limit(1);

  setResult(jar, {
    userId,
    profileFound: !!profile,
    role: profile?.role ?? null,
    membershipStatus: profile?.membership_status ?? null,
    journeyId,
    journeyReused,
    conversationId,
    conversationReused,
    rlsCrossUserBlocked: !foreignRows || foreignRows.length === 0,
    ranAt: new Date().toISOString(),
  });

  redirect(ROUTE_PATH);
}

export async function attachTestEmail(token: string, formData: FormData) {
  if (token !== TEST_TOKEN) redirect("/");

  const jar = cookies();
  const client = anonClient();
  const userId = await restoreSession(client, jar);

  if (!userId) {
    setResult(jar, { error: "No active test session. Run the test first." });
    redirect(ROUTE_PATH);
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect(ROUTE_PATH);

  const { error } = await client.auth.updateUser({ email });

  const existingRaw = jar.get(RESULT_COOKIE)?.value;
  const base: TestResult = existingRaw ? JSON.parse(existingRaw) : {};
  setResult(jar, {
    ...base,
    emailAttachAttempted: true,
    emailAttachOutcome: error
      ? `Supabase rejected the request: ${error.message}`
      : "Supabase accepted the request. Check the inbox for the address just submitted.",
  });

  redirect(ROUTE_PATH);
}
