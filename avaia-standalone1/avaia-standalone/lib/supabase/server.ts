/**
 * Server Supabase client (RLS-respecting, cookie-bound session). For Server
 * Components, Route Handlers, and middleware-adjacent code — reads/writes the
 * auth session cookie via next/headers so `auth.uid()` policies work
 * server-side. The setAll try/catch is the documented @supabase/ssr pattern:
 * Server Components can't set cookies (middleware handles refresh).
 */

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context — safe to ignore; middleware refreshes.
          }
        },
      },
    }
  );
}
