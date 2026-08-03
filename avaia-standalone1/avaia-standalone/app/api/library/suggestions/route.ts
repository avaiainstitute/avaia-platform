import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const title: string = (body?.title ?? "").toString().trim();
  const whyRelevant: string = (body?.whyRelevant ?? "").toString().trim();
  if (!title || !whyRelevant) {
    return NextResponse.json({ error: "Title and why it's relevant are required." }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("library_suggestions")
    .insert({
      submitted_by: user.id,
      title,
      author: body?.author || null,
      link: body?.link || null,
      description: body?.description || null,
      why_relevant: whyRelevant,
      suggested_virtue_family: body?.suggestedVirtueFamily || null,
      suggested_virtue_name: body?.suggestedVirtueName || null,
      suggested_secondary_loss: body?.suggestedSecondaryLoss || null,
      suggested_program: body?.suggestedProgram || null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not submit the suggestion." }, { status: 500 });
  }
  return NextResponse.json({ suggestion: row });
}
