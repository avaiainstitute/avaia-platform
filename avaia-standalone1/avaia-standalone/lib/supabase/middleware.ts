/**
 * Session refresh for middleware — the documented @supabase/ssr pattern.
 * Rotates the auth cookie so `auth.uid()` keeps working across requests.
 *
 * Guarded: if Supabase env vars aren't configured yet, it's a no-op, so the
 * static reference pages keep working before the engine's keys are set.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response; // Supabase not configured — skip.

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Touch the user to refresh the token if it's near expiry.
  await supabase.auth.getUser();

  return response;
}
