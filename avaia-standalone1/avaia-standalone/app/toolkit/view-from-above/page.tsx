import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VIEW_FROM_ABOVE_CLASSES, getViewFromAboveClass } from "@/lib/view-from-above";

export const metadata = { title: "View From Above — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

/** Same email-lookup pattern as /toolkit/defying-grief's own start action. */
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

/** The Guide-facing starter for View From Above -- closes the gap found
 *  during this task's own required verification: the ten classes were
 *  readable as Toolkit curriculum (ViewFromAboveClass.tsx), but a Guide
 *  had no way to actually open a class-anchored private AVAIA
 *  conversation for a participant, unlike Defying Grief's own
 *  /toolkit/defying-grief. This is not a second implementation -- it's
 *  the exact same installed IAP tool, started with
 *  program: "view-from-above" and class_context: <slug> instead of
 *  "general", the same way Defying Grief threads program through.
 *  class_context is display/continuity only (Preparation, Guide's
 *  Record) -- see migration 0058's own comment; systemPromptFor's
 *  VIEW_FROM_ABOVE_CONTEXT clause is deliberately generic, not
 *  class-specific, so the Guide's own live delivery of the class's
 *  shared teaching (from its Experience page) is what actually carries
 *  the class-specific content -- this tool only opens the private
 *  conversation that follows it. */
async function startViewFromAboveSession(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const slug = String(formData.get("slug") ?? "");
  const cls = getViewFromAboveClass(slug);
  if (!cls) redirect("/toolkit/view-from-above");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!name) redirect("/toolkit/view-from-above");

  const linkedHostId = email ? await findHostIdByEmail(email) : null;

  const { data: participant, error: participantError } = await supabase
    .from("guide_participants")
    .insert({ guide_id: user.id, name, email: email || null, linked_host_id: linkedHostId })
    .select("id")
    .single();
  if (participantError || !participant) redirect("/toolkit/view-from-above");

  const { data: session, error: sessionError } = await supabase
    .from("guide_sessions")
    .insert({
      guide_id: user.id,
      participant_id: participant.id,
      tool: "iap",
      program: "view-from-above",
      class_context: slug,
    })
    .select("id")
    .single();
  if (sessionError || !session) redirect("/toolkit/view-from-above");

  redirect(`/toolkit/iap/${session.id}`);
}

export default async function ToolkitViewFromAbovePage({
  searchParams,
}: {
  searchParams?: { class?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const preselected = searchParams?.class && getViewFromAboveClass(searchParams.class) ? searchParams.class : "";

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Programs</p>
      <h1 className="font-serif text-4xl text-ink">View From Above</h1>
      <p className="mt-4 text-lg text-muted">
        Select a class, teach its shared teaching, questions, and Chemistry activity live (see
        each class's full curriculum at{" "}
        <Link href="/toolkit/experiences" className="text-ink underline decoration-rule underline-offset-2 hover:text-seal">
          Experiences
        </Link>
        ), then open a private AVAIA conversation for a participant here — the same Individual
        Awareness Profile every Host uses, threaded with this class's context.
      </p>

      <form action={startViewFromAboveSession} className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <label className="label mb-2 block" htmlFor="slug">
          Class
        </label>
        <select
          id="slug"
          name="slug"
          required
          defaultValue={preselected}
          className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
        >
          <option value="" disabled>
            Choose one of the ten classes…
          </option>
          {VIEW_FROM_ABOVE_CLASSES.map((c, i) => (
            <option key={c.slug} value={c.slug}>
              {i + 1}. {c.title} — {c.virtueFamily}
            </option>
          ))}
        </select>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
          className="mt-4 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Begin Private Conversation
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Facilitating a group instead of one person? Open a{" "}
        <Link href="/toolkit/rooms" className="text-ink underline decoration-rule underline-offset-2 hover:text-seal">
          Shared Room
        </Link>{" "}
        for the group's shared conversation, teach the class live from its Experience page, then
        use this same form to start each participant's own private conversation afterward.
      </p>
    </div>
  );
}
