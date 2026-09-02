import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Youth Programs — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

type Organization = { id: string; name: string; org_type: string };
type Program = {
  id: string;
  name: string;
  delivery_context: "group_workshop" | "school_organization";
  delivery_format: string | null;
  status: string;
  organization_id: string | null;
  starts_at: string | null;
  created_at: string;
};

const CONTEXT_LABEL: Record<Program["delivery_context"], string> = {
  group_workshop: "Group / workshop",
  school_organization: "School / organization",
};

/** Real, first-class program/group entity -- the piece a single labeled
 *  "group/workshop" field on an individual session could never actually
 *  be: something a Guide creates once and registers many participants
 *  into. See migration 0043's own header for why this is new rather than
 *  reusing Classes/Experiences (content containers, not delivery-instance
 *  entities). Organization creation is folded into this same form rather
 *  than a separate CRUD flow -- typing a new name creates one; picking an
 *  existing one from the list reuses it, so a school running multiple
 *  programs only registers its identity once. */
async function createProgram(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const name = String(formData.get("name") ?? "").trim();
  const deliveryContext = String(formData.get("deliveryContext") ?? "");
  const deliveryFormat = String(formData.get("deliveryFormat") ?? "").trim() || null;
  const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
  const sessionNotes = String(formData.get("sessionNotes") ?? "").trim() || null;
  const existingOrgId = String(formData.get("existingOrganizationId") ?? "").trim() || null;
  const newOrgName = String(formData.get("newOrganizationName") ?? "").trim();
  const newOrgContactName = String(formData.get("newOrganizationContactName") ?? "").trim() || null;
  const newOrgContactEmail = String(formData.get("newOrganizationContactEmail") ?? "").trim() || null;

  if (!name || (deliveryContext !== "group_workshop" && deliveryContext !== "school_organization")) {
    redirect("/toolkit/youth-defying-grief/programs?error=" + encodeURIComponent("Name and context are required."));
  }

  let organizationId = existingOrgId;
  if (deliveryContext === "school_organization" && !organizationId && newOrgName) {
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: newOrgName,
        org_type: "school",
        contact_name: newOrgContactName,
        contact_email: newOrgContactEmail,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (orgError || !org) {
      redirect(
        "/toolkit/youth-defying-grief/programs?error=" +
          encodeURIComponent(orgError?.message ?? "Could not create the organization.")
      );
    }
    organizationId = org.id;
  }

  const { data: program, error: programError } = await supabase
    .from("youth_programs")
    .insert({
      guide_id: user.id,
      name,
      delivery_context: deliveryContext,
      organization_id: deliveryContext === "school_organization" ? organizationId : null,
      delivery_format: deliveryFormat,
      starts_at: startsAtRaw ? new Date(startsAtRaw).toISOString() : null,
      session_notes: sessionNotes,
    })
    .select("id")
    .single();
  if (programError || !program) {
    redirect(
      "/toolkit/youth-defying-grief/programs?error=" +
        encodeURIComponent(programError?.message ?? "Could not create the program.")
    );
  }

  redirect(`/toolkit/youth-defying-grief/programs/${program.id}`);
}

export default async function YouthProgramsPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const [{ data: programsData }, { data: orgsData }, { data: formatRows }] = await Promise.all([
    supabase
      .from("youth_programs")
      .select("*")
      .eq("guide_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("organizations").select("id, name, org_type").order("name"),
    supabase
      .from("experience_sections")
      .select("title, experiences!inner(title)")
      .eq("section_type", "format_variant")
      .eq("experiences.title", "The Things We Lose After the Loss — Youth"),
  ]);

  const programs = (programsData as Program[]) ?? [];
  const organizations = (orgsData as Organization[]) ?? [];
  const formatOptions = ((formatRows as { title: string }[] | null) ?? []).map((r) => r.title);

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit/youth-defying-grief" className="label hover:text-seal">
          ← Back to Youth Defying Grief
        </Link>
      </p>
      <p className="label mb-3">Programs</p>
      <h1 className="font-serif text-4xl text-ink">Youth Programs</h1>
      <p className="mt-4 text-lg text-muted">
        A group, workshop, or school program you run -- register participants, track guardian
        consent and Youth assent per person, and see who&rsquo;s cleared to participate, without
        exposing anyone&rsquo;s private conversation.
      </p>

      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {searchParams.error}
        </p>
      )}

      {programs.length > 0 && (
        <section className="mt-10">
          <p className="label mb-3 text-muted">Your Programs</p>
          <div className="space-y-2">
            {programs.map((p) => (
              <Link
                key={p.id}
                href={`/toolkit/youth-defying-grief/programs/${p.id}`}
                className="block rounded-lg border border-rule bg-white/[0.04] px-5 py-4 transition-colors hover:border-seal"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-serif text-lg text-ink">{p.name}</p>
                  <span className="label text-muted">{p.status}</span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {CONTEXT_LABEL[p.delivery_context]}
                  {p.delivery_format ? ` · ${p.delivery_format}` : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <p className="label mb-3 text-muted">Create a Program</p>
        <form action={createProgram}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label mb-2 block" htmlFor="name">
                Program name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="e.g. Fall Workshop — Riverside Middle School"
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
            </div>
            <div>
              <label className="label mb-2 block" htmlFor="deliveryFormat">
                Delivery format
              </label>
              <select
                id="deliveryFormat"
                name="deliveryFormat"
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              >
                <option value="" className="bg-[#05060b]">
                  Not yet decided
                </option>
                {formatOptions.map((f) => (
                  <option key={f} value={f} className="bg-[#05060b]">
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="mt-5">
            <legend className="label mb-2">Delivery context</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-rule bg-white/[0.03] px-4 py-3">
                <input type="radio" name="deliveryContext" value="group_workshop" defaultChecked required />
                <span className="text-sm text-ink">Group / workshop</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-rule bg-white/[0.03] px-4 py-3">
                <input type="radio" name="deliveryContext" value="school_organization" />
                <span className="text-sm text-ink">School / organization</span>
              </label>
            </div>
          </fieldset>

          <div className="mt-5 rounded-md border border-rule bg-white/[0.03] p-4">
            <p className="label mb-2">Sponsoring organization (only for school/organization context)</p>
            {organizations.length > 0 && (
              <select
                name="existingOrganizationId"
                className="mb-3 w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              >
                <option value="" className="bg-[#05060b]">
                  — Create a new organization below —
                </option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id} className="bg-[#05060b]">
                    {o.name}
                  </option>
                ))}
              </select>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                name="newOrganizationName"
                type="text"
                placeholder="New organization name"
                className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
              <input
                name="newOrganizationContactName"
                type="text"
                placeholder="Contact name"
                className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
              <input
                name="newOrganizationContactEmail"
                type="email"
                placeholder="Contact email"
                className="rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label mb-2 block" htmlFor="startsAt">
                Start date (optional)
              </label>
              <input
                id="startsAt"
                name="startsAt"
                type="date"
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
            </div>
            <div>
              <label className="label mb-2 block" htmlFor="sessionNotes">
                Session structure / notes (optional)
              </label>
              <input
                id="sessionNotes"
                name="sessionNotes"
                type="text"
                placeholder="e.g. Four weekly sessions, Thursdays 3:30–4:30"
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-6 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Create Program
          </button>
        </form>
      </section>
    </div>
  );
}
