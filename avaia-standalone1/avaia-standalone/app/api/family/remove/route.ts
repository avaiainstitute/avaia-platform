import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeFamilyMember } from "@/lib/family-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Removes a family member -- callable by the plan owner (removing
 *  someone else) or by the member themselves (leaving). Authorization is
 *  re-verified inside removeFamilyMember() itself, not here. */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const memberId = typeof body?.memberId === "string" ? body.memberId : "";
  if (!memberId) return NextResponse.json({ error: "Missing member id." }, { status: 400 });

  const admin = createAdminClient();
  const result = await removeFamilyMember(admin, user.id, memberId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
