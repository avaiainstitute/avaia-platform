import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The guardian's own confirming action -- no login required, matching
 *  app/consent/[token]/page.tsx (a guardian never has an AVAIA account).
 *  Calls the narrow SECURITY DEFINER function confirm_pending_consent
 *  (migration 0043), which can only ever flip one specific pending row to
 *  active; nothing else in the schema is reachable through this route.
 *  Captures a best-effort IP as part of the consent record -- evidence,
 *  not verification; this route makes no identity claim about who
 *  actually clicked. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token: string | undefined = body?.token;
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;

  const supabase = createClient();
  const { data, error } = await supabase.rpc("confirm_pending_consent", {
    p_token: token,
    p_ip: ip,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json(
      { error: "This link is no longer active. It may have already been confirmed." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
