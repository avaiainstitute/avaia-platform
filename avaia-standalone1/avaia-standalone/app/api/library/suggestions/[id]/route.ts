import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { validateVirtueTag } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin review of a pending suggestion. Approving never publishes directly —
 *  it creates a draft library_entries row (content_type = 'external-resource')
 *  that an admin still edits and publishes deliberately, matching "Suggestions
 *  never auto-publish." */
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
  const action = body?.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'." }, { status: 400 });
  }

  const { data: suggestion } = await supabase
    .from("library_suggestions")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!suggestion) return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
  if (suggestion.status !== "pending") {
    return NextResponse.json({ error: "Already reviewed." }, { status: 409 });
  }

  let createdEntryId: string | null = null;
  if (action === "approve") {
    const virtueTag = suggestion.suggested_virtue_family
      ? validateVirtueTag(suggestion.suggested_virtue_family, suggestion.suggested_virtue_name)
      : null;

    const { data: entry, error: entryError } = await supabase
      .from("library_entries")
      .insert({
        title: suggestion.title,
        great_idea: suggestion.title,
        overview: suggestion.description || suggestion.why_relevant,
        virtues: virtueTag ? [virtueTag] : [],
        secondary_losses: suggestion.suggested_secondary_loss ? [suggestion.suggested_secondary_loss] : [],
        programs: suggestion.suggested_program ? [suggestion.suggested_program] : [],
        content_type: "external-resource",
        external_url: suggestion.link,
        external_author: suggestion.author,
        external_description: suggestion.description,
        status: "draft",
        visibility: "member",
        editor_id: user.id,
      })
      .select("id")
      .single();
    if (entryError) {
      return NextResponse.json({ error: "Could not create the entry from this suggestion." }, { status: 500 });
    }
    createdEntryId = entry.id;
  }

  const { error: updateError } = await supabase
    .from("library_suggestions")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: body?.reviewNotes || null,
    })
    .eq("id", params.id);
  if (updateError) {
    return NextResponse.json({ error: "Could not update the suggestion." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, entryId: createdEntryId });
}
