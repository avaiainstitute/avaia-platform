import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Agent 5 (Pink Shoelace <-> AVAIA Connection), Automation Blueprint Phase
// 4. Read-only cross-reference by email between Pink Shoelace's own
// contact/participation submissions and real AVAIA Host accounts.
// Deliberately conservative, per the owner's own instruction: this never
// merges any record, never emails or otherwise contacts anyone
// automatically, and never writes to any table -- it only ever returns a
// list for the founder digest to display for Dorian's own, later, human
// judgment.

export type PinkAvaiaConnection = {
  pinkName: string;
  pinkEmail: string;
  pinkSource: "pink_contact_submissions" | "pink_participation_interest";
  hostId: string;
};

type AuthUserRow = { id: string; email: string | null; created_at: string };
type PinkRow = { name: string; email: string; created_at: string };

async function listAllAuthUsers(admin: ReturnType<typeof createAdminClient>): Promise<AuthUserRow[]> {
  const perPage = 1000;
  const all: AuthUserRow[] = [];
  // Bounded loop (50 pages = 50,000 accounts) so a runaway response can
  // never hang this cron; stops as soon as a page comes back short.
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) break;
    for (const u of data.users) all.push({ id: u.id, email: u.email ?? null, created_at: u.created_at });
    if (data.users.length < perPage) break;
  }
  return all;
}

/** A connection is only ever reported once: on the day the NEWER side of
 *  the pair first appears (a fresh Pink submission matching an existing
 *  Host, or a newly-created Host matching an existing Pink submission),
 *  bounded by `sinceIso` (the founder digest's own existing 24-hour
 *  window). This avoids needing a separate dedup-tracking table while
 *  still never repeating the same connection in tomorrow's digest. */
export async function getPinkAvaiaConnections(sinceIso: string): Promise<PinkAvaiaConnection[]> {
  const admin = createAdminClient();
  const sinceMs = new Date(sinceIso).getTime();

  const [{ data: pinkContacts }, { data: pinkParticipants }, hostUsers] = await Promise.all([
    admin.from("pink_contact_submissions").select("name, email, created_at"),
    admin.from("pink_participation_interest").select("name, email, created_at"),
    listAllAuthUsers(admin),
  ]);

  const hostByEmail = new Map<string, AuthUserRow>();
  for (const u of hostUsers) {
    if (u.email) hostByEmail.set(u.email.toLowerCase(), u);
  }

  const seen = new Set<string>();
  const connections: PinkAvaiaConnection[] = [];

  const consider = (rows: PinkRow[] | null, source: PinkAvaiaConnection["pinkSource"]) => {
    for (const row of rows ?? []) {
      const email = (row.email ?? "").toLowerCase();
      if (!email || seen.has(email)) continue;
      const host = hostByEmail.get(email);
      if (!host) continue;
      const pinkIsNew = new Date(row.created_at).getTime() >= sinceMs;
      const hostIsNew = new Date(host.created_at).getTime() >= sinceMs;
      if (!pinkIsNew && !hostIsNew) continue;
      seen.add(email);
      connections.push({ pinkName: row.name, pinkEmail: row.email, pinkSource: source, hostId: host.id });
    }
  };

  consider(pinkContacts as PinkRow[], "pink_contact_submissions");
  consider(pinkParticipants as PinkRow[], "pink_participation_interest");
  return connections;
}
