import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFYING_GRIEF_PROGRAM_NAME } from "@/lib/defying-grief";

export const metadata = { title: "Defying Grief — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

/** Same email-lookup pattern used in app/toolkit/page.tsx -- kept local to
 *  each start action rather than factored out, to avoid touching the
 *  original, working /api/share route. */
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

/** Defying Grief in the Guide Toolkit is not a separate implementation --
 *  it's the exact same installed IAP/CAT/InnerCompass tools, just started
 *  with program: "defying-grief" instead of "general", the same way
 *  app/defying-grief/page.tsx's beginDefyingGriefWorkshop threads program
 *  through for a self-serve Host. systemPromptFor(stage, program) (frozen,
 *  untouched) is what actually layers in the Audacity framing at CAT. */
async function startDefyingGriefSession(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!name) redirect("/toolkit/defying-grief");

  const linkedHostId = email ? await findHostIdByEmail(email) : null;

  const { data: participant, error: participantError } = await supabase
    .from("guide_participants")
    .insert({ guide_id: user.id, name, email: email || null, linked_host_id: linkedHostId })
    .select("id")
    .single();
  if (participantError || !participant) redirect("/toolkit/defying-grief");

  const { data: session, error: sessionError } = await supabase
    .from("guide_sessions")
    .insert({ guide_id: user.id, participant_id: participant.id, tool: "iap", program: "defying-grief" })
    .select("id")
    .single();
  if (sessionError || !session) redirect("/toolkit/defying-grief");

  redirect(`/toolkit/iap/${session.id}`);
}

export default async function ToolkitDefyingGriefPage() {
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
      <h1 className="font-serif text-4xl text-ink">{DEFYING_GRIEF_PROGRAM_NAME}</h1>
      <p className="mt-4 text-lg text-muted">
        The same Individual Awareness Profile, Conversations Across Time, and InnerCompass
        Toolkit tools, threaded with the Defying Grief framing -- Audacity enters at CAT, exactly
        as it does for a self-serve Host. Nothing about the underlying engine is different.
      </p>

      <form action={startDefyingGriefSession} className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
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
        <button
          type="submit"
          className="mt-4 rounded-md bg-[#c1502e] px-5 py-2.5 font-sans text-sm font-semibold text-[#0c0503] transition-shadow hover:shadow-[0_0_24px_rgba(193,80,46,0.4)]"
        >
          Begin Defying Grief
        </button>
      </form>
    </div>
  );
}
