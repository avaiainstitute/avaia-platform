import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { submitToolkitSupportItem, getGuideFacingToolkitItems } from "@/lib/ops/toolkit-stewardship";
import { SUPPORT_CATEGORIES, type SupportCategory } from "@/lib/toolkit-stewardship";
import { TOOL_REGISTRY, type ToolKey } from "@/lib/toolkit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Toolkit Stewardship's one candidate/Guide-facing surface: a signed-in
// Guide may file a support item about a Toolkit resource, and see their
// own items' status/resolution. Mirrors app/api/share/route.ts's own
// auth shape. Never exposes another Guide's items, assignee identity, or
// internal routing notes -- see toGuideFacingSupportView's own comment.

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const items = await getGuideFacingToolkitItems(supabase, user.id);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const toolKey = body?.toolKey as ToolKey | undefined;
  const category = body?.category as SupportCategory | undefined;
  const description: string = (body?.description ?? "").toString().trim();
  const affectedResource: string | null = body?.affectedResource ? String(body.affectedResource) : null;

  if (!toolKey || !TOOL_REGISTRY.some((t) => t.key === toolKey)) {
    return NextResponse.json({ error: "Unknown Toolkit item." }, { status: 400 });
  }
  if (!category || !SUPPORT_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "Description is required." }, { status: 400 });
  }

  const result = await submitToolkitSupportItem(supabase, { hostId: user.id, toolKey, category, description, affectedResource });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: result.id });
}
