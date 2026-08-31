import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Guided Journeys — AVAIA" };
export const dynamic = "force-dynamic";

/** Lists this Guide's own active Host invitations (Phase E.4). Uses
 *  guide_journey_access's existing self-read RLS ("guide journey access
 *  guide select"), so an invitation still shows honestly even if this
 *  specific Journey has since become unreadable (e.g. it turns out to be
 *  Youth, which the invite flow already prevents but this stays a defensive
 *  check, not an assumption) -- shown as "Not currently accessible" rather
 *  than silently disappearing. This page itself is gated one level up, in
 *  app/guided-journeys/layout.tsx, on active certification + Guided
 *  Journey Facilitation authorization -- not Toolkit authorization. */
export default async function GuidedJourneysPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/guided-journeys");

  const { data: guidedJourneyAccessRows } = await supabase
    .from("guide_journey_access")
    .select("id, journey_id, granted_at")
    .eq("guide_id", user.id)
    .is("revoked_at", null)
    .order("granted_at", { ascending: false });
  const guidedJourneyAccess = guidedJourneyAccessRows ?? [];
  const grantedJourneyIds = guidedJourneyAccess.map((a) => a.journey_id);

  let readableJourneysData: { id: string; program: string; started_at: string }[] | null = null;
  if (grantedJourneyIds.length > 0) {
    const result = await supabase
      .from("journeys")
      .select("id, program, started_at")
      .in("id", grantedJourneyIds);
    readableJourneysData = result.data;
  }
  const readableJourneyById = new Map((readableJourneysData ?? []).map((j) => [j.id, j]));

  return (
    <div>
      <p className="label mb-3">Guided Journeys</p>
      <h1 className="font-serif text-4xl text-ink">Host-invited facilitation.</h1>
      <p className="mt-4 text-lg text-muted">
        Host-owned Journeys you have been invited to facilitate. You can read what the Host has
        shared; you do not own the Journey, the Table, or the record.
      </p>

      {guidedJourneyAccess.length === 0 ? (
        <p className="mt-10 text-muted">No Guided Journey invitations yet.</p>
      ) : (
        <div className="mt-8 space-y-2">
          {guidedJourneyAccess.map((a) => {
            const journey = readableJourneyById.get(a.journey_id);
            return (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3"
              >
                <div>
                  <p className="text-ink">
                    {journey
                      ? `${journey.program === "defying-grief" ? "Defying Grief" : "General"} Journey`
                      : "Guided Journey"}
                  </p>
                  <p className="text-xs text-muted">
                    Started {new Date(journey?.started_at ?? a.granted_at).toLocaleDateString()}
                  </p>
                </div>
                {journey ? (
                  <Link
                    href={`/guided-journeys/${journey.id}`}
                    prefetch={false}
                    className="rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
                  >
                    View Journey
                  </Link>
                ) : (
                  <span className="label text-muted">Not currently accessible</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
