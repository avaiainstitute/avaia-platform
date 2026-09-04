import "server-only";
import { createClient as createRawClient } from "@supabase/supabase-js";

/**
 * A request-scoped, RLS-respecting Supabase client authenticated by a raw
 * access token instead of the cookie session lib/supabase/server.ts reads.
 * Needed for exactly one thing: the Shared Room private-access flow (see
 * app/api/room-access/*), where the caller is a participant whose session
 * lives in an isolated, non-cookie client (lib/supabase/participant-client.ts)
 * specifically so it never touches the Guide's own cookie-based session in
 * the same browser. Every RLS policy this client hits evaluates auth.uid()
 * as the token's own subject -- the same self-only policies every other
 * Host's data already relies on, unchanged. Using the anon key (not the
 * service-role key) is what keeps this RLS-respecting rather than an admin
 * bypass -- the caller only ever gets back what auth.uid() = host_id (etc.)
 * already allows for their own token.
 */
export function createClientForBearerToken(accessToken: string) {
  return createRawClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }
  );
}

/** Extracts and validates the bearer token from a Request, returning the
 *  authenticated user id and a client scoped to their own identity, or
 *  null if the token is missing/invalid. */
export async function authenticateBearer(
  request: Request
): Promise<{ userId: string; supabase: ReturnType<typeof createClientForBearerToken> } | null> {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const supabase = createClientForBearerToken(token);
  // Pass the token explicitly rather than relying on the client's internal
  // session state (there is none -- persistSession/autoRefreshToken are
  // both off) or on the global Authorization header reaching the auth
  // client the same way it reaches PostgREST. getUser(jwt) is the
  // documented, guaranteed-correct way to validate a specific token.
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return null;
  return { userId: user.id, supabase };
}
