import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUnsungHeroesConversation } from "@/lib/engine/unsung-heroes";
import { UNSUNG_HEROES_PATH_LABEL, type UnsungHeroesPath } from "@/lib/engine/prompts";

export const metadata = { title: "Unsung Heroes — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

const PATHS = Object.keys(UNSUNG_HEROES_PATH_LABEL) as UnsungHeroesPath[];

async function findHostIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

/** Unsung Heroes runs on its own engine (lib/engine/unsung-heroes.ts) --
 *  fully separate tables, not the IAP/CAT/InnerCompass conversation engine
 *  at all. Reused exactly as-is; the only new thing is creating the
 *  conversation under the Guide's account and tracking it via
 *  guide_sessions, same posture as the Journey tools. Unlike IAP, the path
 *  has to be chosen before the conversation can be created at all, so
 *  participant + session + conversation are all created in one action here
 *  rather than lazily on first load. */
async function startUnsungHeroesSession(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const path = String(formData.get("path") ?? "") as UnsungHeroesPath;
  if (!name || !PATHS.includes(path)) redirect("/toolkit/unsung-heroes");

  const linkedHostId = email ? await findHostIdByEmail(email) : null;

  const { data: participant, error: participantError } = await supabase
    .from("guide_participants")
    .insert({ guide_id: user.id, name, email: email || null, linked_host_id: linkedHostId })
    .select("id")
    .single();
  if (participantError || !participant) redirect("/toolkit/unsung-heroes");

  const convo = await createUnsungHeroesConversation(supabase, user.id, path);

  const { data: session, error: sessionError } = await supabase
    .from("guide_sessions")
    .insert({
      guide_id: user.id,
      participant_id: participant.id,
      tool: "unsung-heroes",
      conversation_id: convo.id,
    })
    .select("id")
    .single();
  if (sessionError || !session) redirect("/toolkit/unsung-heroes");

  redirect(`/toolkit/unsung-heroes/${session.id}`);
}

export default async function ToolkitUnsungHeroesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Programs</p>
      <h1 className="font-serif text-4xl text-ink">Unsung Heroes</h1>
      <p className="mt-4 text-lg text-muted">
        A short, guided conversation to help a participant name a quiet act of virtue — one they
        witnessed, one they received, or one they&rsquo;re hoping to grow into.
      </p>

      <form action={startUnsungHeroesSession} className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label mb-2 block" htmlFor="name">
              Participant name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
          <div>
            <label className="label mb-2 block" htmlFor="email">
              Email (optional — links to their AVAIA account if they have one)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="label mb-2">Path</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PATHS.map((p, i) => (
              <label
                key={p}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-rule bg-white/[0.03] px-4 py-3"
              >
                <input type="radio" name="path" value={p} defaultChecked={i === 0} required />
                <span className="text-sm text-ink">{UNSUNG_HEROES_PATH_LABEL[p]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="mt-5 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Begin Unsung Heroes
        </button>
      </form>
    </div>
  );
}
