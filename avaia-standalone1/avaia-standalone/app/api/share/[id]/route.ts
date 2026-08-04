import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Revoke a grant. RLS ("shared_access owner manage") already restricts this
 *  to the owner, but we check explicitly too so a not-found/not-yours grant
 *  returns a clear 404 rather than a silent no-op update. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: grant } = await supabase
    .from("shared_access")
    .select("id, owner_id, revoked_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!grant || grant.owner_id !== user.id) {
    return NextResponse.json({ error: "Grant not found." }, { status: 404 });
  }
  if (grant.revoked_at) {
    return NextResponse.json({ status: "already-revoked" });
  }

  const { error } = await supabase
    .from("shared_access")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: "Could not revoke access." }, { status: 500 });

  return NextResponse.json({ status: "revoked" });
}
