import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { validateVirtueTag, isValidSecondaryLoss, JOURNEY_STAGES, PROGRAM_KEYS } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const title: string = (body?.title ?? "").toString().trim();
  const greatIdea: string = (body?.greatIdea ?? "").toString().trim();
  const overview: string = (body?.overview ?? "").toString().trim();
  const contentType: string = body?.contentType;
  if (!title || !greatIdea || !overview) {
    return NextResponse.json({ error: "Title, Great Idea, and overview are required." }, { status: 400 });
  }
  if (contentType !== "avaia-owned" && contentType !== "external-resource") {
    return NextResponse.json({ error: "Invalid content type." }, { status: 400 });
  }

  const virtues = Array.isArray(body?.virtues)
    ? (body.virtues as Array<{ family: string; element: string | null }>)
        .map((v) => validateVirtueTag(v.family, v.element))
        .filter((v): v is NonNullable<typeof v> => v !== null)
    : [];
  const secondaryLosses = Array.isArray(body?.secondaryLosses)
    ? (body.secondaryLosses as string[]).filter((l) => isValidSecondaryLoss(l))
    : [];
  const journeyStages = Array.isArray(body?.journeyStages)
    ? (body.journeyStages as string[]).filter((s) => JOURNEY_STAGES.includes(s as any))
    : [];
  const programs = Array.isArray(body?.programs)
    ? (body.programs as string[]).filter((p) => PROGRAM_KEYS.includes(p as any))
    : [];
  const tags = Array.isArray(body?.tags)
    ? (body.tags as string[]).map((t) => t.trim()).filter(Boolean)
    : [];

  const { data: row, error } = await supabase
    .from("library_entries")
    .insert({
      title,
      great_idea: greatIdea,
      overview,
      virtues,
      secondary_losses: secondaryLosses,
      journey_stages: journeyStages,
      programs,
      content_type: contentType,
      body: contentType === "avaia-owned" ? (body?.body ?? null) : null,
      external_url: contentType === "external-resource" ? (body?.externalUrl ?? null) : null,
      external_author: contentType === "external-resource" ? (body?.externalAuthor ?? null) : null,
      external_description:
        contentType === "external-resource" ? (body?.externalDescription ?? null) : null,
      status: body?.status === "published" ? "published" : "draft",
      visibility: body?.visibility === "public" ? "public" : "member",
      tags,
      editor_id: user.id,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not create the entry." }, { status: 500 });
  }
  return NextResponse.json({ entry: row });
}
