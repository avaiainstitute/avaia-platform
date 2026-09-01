import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ExperienceDetail, {
  type ComponentAvailabilityItem,
  type RelatedClass,
} from "@/components/ExperienceDetail";
import DefyingGriefCurriculum from "@/components/DefyingGriefCurriculum";
import type { Experience } from "@/lib/experiences";
import type { ExperienceSection } from "@/lib/experience-sections";
import { TOOL_REGISTRY, type ToolKey, type ToolStatus } from "@/lib/toolkit";

export const dynamic = "force-dynamic";

/** Admin-only draft preview of the Experience Detail architecture --
 *  not nested under /toolkit, since that layout gates on role='guide'
 *  specifically and would incorrectly block an admin who isn't also a
 *  Guide (app/toolkit/layout.tsx:26). Renders through the exact same
 *  shared ExperienceDetail component the eventual Guide-facing route
 *  will use against published-only data -- this page's own real
 *  security is the "experiences admin all" / "experience sections
 *  admin all" RLS policies (same pattern already used on classes and
 *  experience_classes); the role check below exists so a non-admin
 *  gets a clean redirect instead of a silently empty page, matching
 *  the toolkit layout's own practice. */

const STATUS_LABEL: Record<ToolStatus, string> = {
  installed: "Available Now",
  "specified-not-installed": "Specified, Not Yet Installed",
  "not-yet-specified": "Not Yet Available",
};

export default async function AdminExperiencePreviewPage({
  params,
}: {
  params: { experienceId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/experiences");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const { data: experienceRow } = await supabase
    .from("experiences")
    .select("*")
    .eq("id", params.experienceId)
    .maybeSingle();
  if (!experienceRow) notFound();
  const experience = experienceRow as Experience;

  const { data: sectionRows } = await supabase
    .from("experience_sections")
    .select("*")
    .eq("experience_id", experience.id);
  const sections = (sectionRows as ExperienceSection[]) ?? [];

  const { data: junctionRows } = await supabase
    .from("experience_classes")
    .select("class_id, classes(id, title, family)")
    .eq("experience_id", experience.id);
  const relatedClasses: RelatedClass[] = (junctionRows ?? [])
    .map((r: any) => r.classes)
    .filter(Boolean)
    .map((c: any) => ({ id: c.id, title: c.title, family: c.family }));

  const componentAvailability: ComponentAvailabilityItem[] = experience.components.map(
    (key) => {
      const tool = TOOL_REGISTRY.find((t) => t.key === (key as ToolKey));
      const status: ToolStatus = tool?.status ?? "not-yet-specified";
      return {
        key: key as ToolKey,
        label: tool?.label ?? key,
        status,
        statusLabel: STATUS_LABEL[status],
      };
    }
  );

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6 text-sm text-muted">
        Admin draft preview — not visible to ordinary Guides. This renders the
        same shared component the eventual Guide-facing route will use.
      </p>
      {experience.components.includes("defying-grief") ? (
        <DefyingGriefCurriculum
          experience={experience}
          sections={sections}
          componentAvailability={componentAvailability}
          relatedClasses={relatedClasses}
        />
      ) : (
        <ExperienceDetail
          experience={experience}
          sections={sections}
          componentAvailability={componentAvailability}
          relatedClasses={relatedClasses}
        />
      )}
    </div>
  );
}
