import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { acceptFamilyInvite } from "@/lib/family-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Accepts a pending Family invite. Requires the caller be signed in as
 *  the exact person the invite was sent to -- acceptFamilyInvite() itself
 *  checks the signed-in email against the invited address. */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token) return NextResponse.json({ error: "Missing invite token." }, { status: 400 });

  const admin = createAdminClient();
  const result = await acceptFamilyInvite(admin, token, user.id, user.email ?? null);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
