import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Readable names for the items Dorian sees: the account's email (so an item is
 *  actionable without a lookup), falling back to the id. Metadata only. Looks up
 *  only the ids it is given. */
export async function hostLabels(hostIds: string[]): Promise<(hostId: string) => string> {
  const admin = createAdminClient();
  const emailByHost = new Map<string, string>();
  await Promise.all(
    Array.from(new Set(hostIds)).map(async (id) => {
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        if (data?.user?.email) emailByHost.set(id, data.user.email);
      } catch {
        // fall back to the id
      }
    })
  );
  return (hostId: string) => emailByHost.get(hostId) ?? `Host ${hostId}`;
}
