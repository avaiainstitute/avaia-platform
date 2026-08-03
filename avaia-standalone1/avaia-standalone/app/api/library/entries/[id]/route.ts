import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { validateVirtueTag, isValidSecondaryLoss, JOURNEY_STAGES, PROGRAM_KEYS } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (typeof body?.title === "string") updates.title = body.title.trim();
  if (typeof body?.greatIdea === "string") updates.great_idea = body.greatIdea.trim();
  if (typeof body?.overview === "string") updates.overview = body.overview.trim();
  if (body?.contentType === "avaia-owned" || body?.contentType === "external-resource") {
    updates.content_type = body.contentType;
  }
  if ("body" in (body ?? {})) updates.body = body.body ?? null;
  if ("externalUrl" in (body ?? {})) updates.external_url = body.externalUrl ?? null;
  if ("externalAuthor" in (body ?? {})) updates.external_author = body.externalAuthor ?? null;
  if ("externalDescription" in (body ?? {})) updates.external_description = body.externalDescription ?? null;

  if (Array.isArray(body?.virtues)) {
    updates.virtues = (body.virtues as Array<{ family: string; element: string | null }>)
      .map((v) => validateVirtueTag(v.family, v.element))
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }
  if (Array.isArray(body?.secondaryLosses)) {
    updates.secondary_losses = (body.secondaryLosses as string[]).filter((l) => isValidSecondaryLoss(l));
  }
  if (Array.isArray(body?.journeyStages)) {
    updates.journey_stages = (body.journeyStages as string[]).filter((s) => JOURNEY_STAGES.includes(s as any));
  }
  if (Array.isArray(body?.programs)) {
    updates.programs = (body.programs as string[]).filter((p) => PROGRAM_KEYS.includes(p as any));
  }
  if (Array.isArray(body?.tags)) {
    updates.tags = (body.tags as string[]).map((t) => t.trim()).filter(Boolean);
  }
  if (body?.status === "draft" || body?.status === "published" || body?.status === "archived") {
    updates.status = body.status;
  }
  if (body?.visibility === "public" || body?.visibility === "member") {
    updates.visibility = body.visibility;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const { data: row, error } = await supabase
    .from("library_entries")
    .update(updates)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not update the entry." }, { status: 500 });
  }
  return NextResponse.json({ entry: row });
}
