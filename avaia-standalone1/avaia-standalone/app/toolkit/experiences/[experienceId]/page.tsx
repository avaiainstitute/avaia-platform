import { notFound, redirect } from "next/navigation";
import Link from "next/link";
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

const STATUS_LABEL: Record<ToolStatus, string> = {
  installed: "Available Now",
  "specified-not-installed": "Specified, Not Yet Installed",
  "not-yet-specified": "Not Yet Available",
};

/** Guide-facing Experience detail -- the route the admin-only draft
 *  preview (app/admin/experiences/[experienceId]/page.tsx) was always
 *  meant to be previewing. Reads through the signed-in Guide's own
 *  RLS-bound client, so "experiences guide read" / "experience sections
 *  guide read" (both gated on guide_platform_authorizations, capability
 *  'toolkit' -- see migration 0031) are the real enforcement, not this
 *  page; sits inside /toolkit, so app/toolkit/layout.tsx's own Toolkit
 *  authorization gate applies before this even runs. Renders through the
 *  exact same shared ExperienceDetail component the admin route uses --
 *  no separate rendering path, no content duplicated. */
export default async function ToolkitExperienceDetailPage({
  params,
}: {
  params: { experienceId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

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
    <div>
      <p className="mb-6">
        <Link href="/toolkit/experiences" prefetch={false} className="label hover:text-seal">
          ← Back to Experiences
        </Link>
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
