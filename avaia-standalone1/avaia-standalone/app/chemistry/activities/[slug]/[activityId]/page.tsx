import { notFound } from "next/navigation";
import { getActivitySet } from "@/lib/chemistry-activities";
import ActivitySheet from "@/components/activities/ActivitySheet";
import PrintToolbar from "@/components/activities/PrintToolbar";
import { sceneFor } from "@/components/activities/ColoringScenes";
import { TracePage, DrawYourselfPage, NoticePage } from "@/components/activities/OtherPages";
import { puzzleFor } from "@/components/activities/Puzzles";

export function generateMetadata({ params }: { params: { slug: string; activityId: string } }) {
  const set = getActivitySet(params.slug);
  const page = set?.pages.find((p) => p.id === params.activityId);
  return { title: page ? `${page.title} | AVAIA` : "Chemistry Activity | AVAIA" };
}

export default function ActivitySheetPage({ params }: { params: { slug: string; activityId: string } }) {
  const set = getActivitySet(params.slug);
  if (!set) notFound();
  const page = set.pages.find((p) => p.id === params.activityId);
  if (!page) notFound();

  let content: React.ReactNode = null;
  let instructions: string | undefined;

  switch (page.kind) {
    case "coloring": {
      const Scene = sceneFor(set.elementSlug);
      instructions = set.sceneCaption;
      content = Scene ? <Scene /> : <p className="text-center text-muted">Scene not available.</p>;
      break;
    }
    case "trace":
      content = <TracePage set={set} />;
      break;
    case "draw-yourself":
      content = <DrawYourselfPage set={set} />;
      break;
    case "notice":
      content = <NoticePage set={set} />;
      break;
    case "puzzle":
      content = puzzleFor(set);
      break;
  }

  return (
    <div className="px-5 py-10">
      <PrintToolbar backHref={`/chemistry/activities/${set.elementSlug}`} backLabel={`${set.elementName} Activities`} />
      <ActivitySheet set={set} pageTitle={page.title} instructions={instructions}>
        {content}
      </ActivitySheet>
    </div>
  );
}
