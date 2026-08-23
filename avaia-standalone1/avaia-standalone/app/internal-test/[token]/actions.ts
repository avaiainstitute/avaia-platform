"use server";

/**
 * TEMPORARY — Free IAP / Anonymous Auth validation route.
 * Not linked from anywhere in the public app. Protected by TEST_TOKEN as
 * the dynamic [token] segment (see page.tsx) -- a 256-bit random value,
 * not derived from anything guessable, known only via this chat. Delete
 * this whole app/internal-test directory once validation is complete;
 * never merge it to main.
 *
 * Deliberately uses ONLY the anonymous test user's own authenticated
 * session for every read/write below (signInAnonymously / setSession),
 * never SUPABASE_SERVICE_ROLE_KEY -- the point is to exercise real RLS
 * as that user would experience it, not to bypass it. Service-role is
 * reserved for the separate, explicit cleanup step after validation.
 */

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createJourney, createConversation } from "@/lib/engine/conversation";
import { TEST_TOKEN } from "./token";

const SESSION_COOKIE = "avaia_test_session";
const USER_ID_COOKIE = "avaia_test_user_id";
const RESULT_COOKIE = "avaia_test_result";
const ROUTE_PATH = `/internal-test/${TEST_TOKEN}`;
const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: ROUTE_PATH,
  maxAge: 3600,
};

type StoredSession = { access_token: string; refresh_token: string };

type Identity = { id: string; email: string | null; isAnonymous: boolean };

type TestResult = {
  error?: string;
  userId?: string;
  email?: string | null;
  isAnonymous?: boolean;
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

/** Server actions have no `window`, so unlike SaveProgressForm.tsx this
 *  reads the actual incoming request's own Host header instead --
 *  resolves to whichever domain (preview or production) this request
 *  genuinely came in on, exactly like window.location.origin would. */
function currentOrigin(): string {
  return `https://${headers().get("host")}`;
}

/** Restores the anonymous (or since-converted) session from the stored
 *  cookie, if any and still valid. getUser() always re-fetches the
 *  current record from Supabase's auth server (not just the JWT's
 *  original claims), so email/isAnonymous reflect the latest state --
 *  including after an email-confirmation link has been clicked in a
 *  separate browser tab. Returns null (does NOT create a new identity)
 *  when there's nothing to restore -- callers decide whether to sign in. */
async function restoreSession(
  client: ReturnType<typeof anonClient>,
  jar: ReturnType<typeof cookies>
): Promise<Identity | null> {
  const stored = jar.get(SESSION_COOKIE)?.value;
  if (!stored) return null;
  try {
    const { access_token, refresh_token } = JSON.parse(stored) as StoredSession;
    const { error } = await client.auth.setSession({ access_token, refresh_token });
    if (error) return null;
    const { data } = await client.auth.getUser();
    if (!data.user) return null;
    return {
      id: data.user.id,
      email: data.user.email ?? null,
      isAnonymous: !!data.user.is_anonymous,
    };
  } catch {
    return null;
  }
}

/** Idempotent, and fails closed: a fresh anonymous identity is only ever
 *  created when there is truly no prior state at all (no session cookie,
 *  no recorded user id -- i.e. the very first run in a clean browser).
 *  Any later failure to restore the existing session (expired token,
 *  invalidated by the email-confirmation flow, etc.) stops with a clear
 *  error naming the known test user id -- it never silently creates a
 *  second identity. This is the one thing last round's harness got
 *  wrong: it fell back to signInAnonymously() on any restore failure. */
export async function runTest(token: string) {
  if (token !== TEST_TOKEN) redirect("/");

  const jar = cookies();
  const client = anonClient();

  const knownUserId = jar.get(USER_ID_COOKIE)?.value ?? null;
  const hasStoredSession = !!jar.get(SESSION_COOKIE)?.value;

  let identity: Identity | null = null;

  if (hasStoredSession) {
    identity = await restoreSession(client, jar);
    if (!identity) {
      setResult(jar, {
        error: knownUserId
          ? `Could not restore the existing test session for user ${knownUserId} (likely expired, or invalidated by the email-confirmation step). Stopping -- not creating a new identity.`
          : "Could not restore the existing test session, and no known test user id is on record. Stopping -- not creating a new identity.",
        userId: knownUserId ?? undefined,
      });
      redirect(ROUTE_PATH);
    }
  } else if (knownUserId) {
    // A user id is on record but its session cookie is gone -- this is
    // a restore failure too, not a first run. Never fall through to a
    // fresh sign-in here.
    setResult(jar, {
      error: `No session on file for the known test user ${knownUserId}. Stopping -- not creating a new identity.`,
      userId: knownUserId,
    });
    redirect(ROUTE_PATH);
  } else {
    // Truly the first run: nothing stored yet in this browser.
    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.session || !data.user) {
      setResult(jar, { error: error?.message ?? "Anonymous sign-in returned no session." });
      redirect(ROUTE_PATH);
    }
    identity = {
      id: data.user!.id,
      email: data.user!.email ?? null,
      isAnonymous: !!data.user!.is_anonymous,
    };
    jar.set(
      SESSION_COOKIE,
      JSON.stringify({
        access_token: data.session!.access_token,
        refresh_token: data.session!.refresh_token,
      }),
      COOKIE_OPTS
    );
  }

  if (!identity) redirect(ROUTE_PATH);

  const userId = identity.id;
  jar.set(USER_ID_COOKIE, userId, COOKIE_OPTS);

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

  const existingRaw = jar.get(RESULT_COOKIE)?.value;
  const base: TestResult = existingRaw ? JSON.parse(existingRaw) : {};

  setResult(jar, {
    ...base,
    error: undefined,
    userId,
    email: identity.email,
    isAnonymous: identity.isAnonymous,
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
  const knownUserId = jar.get(USER_ID_COOKIE)?.value ?? null;
  const identity = await restoreSession(client, jar);

  if (!identity) {
    setResult(jar, {
      error: knownUserId
        ? `Could not restore the existing test session for user ${knownUserId}. Not attaching an email to an unverified session -- run the test again from a clean state first.`
        : "No active test session. Run the test first.",
      userId: knownUserId ?? undefined,
    });
    redirect(ROUTE_PATH);
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect(ROUTE_PATH);

  const { error } = await client.auth.updateUser(
    { email },
    { emailRedirectTo: `${currentOrigin()}/auth/callback` }
  );

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
